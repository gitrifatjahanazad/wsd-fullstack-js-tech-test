/**
 * @fileoverview Export service for generating task exports in various formats
 * @module services/ExportService
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import Task from '../models/Task.js';
import Export from '../models/Export.js';
import { redisClient } from '../config/redis.js';

/**
 * Service class for handling task data exports
 * @class ExportService
 */
class ExportService {
  /**
   * Creates a new export job and processes it
   * @static
   * @async
   * @param {Object} options - Export options
   * @param {string} options.format - Export format ('csv' or 'json')
   * @param {Object} options.filters - Filters to apply to the export
   * @param {Object} socketHandlers - Socket handlers for real-time updates
   * @returns {Promise<Object>} Export job object
   */
  static async createExport(options, socketHandlers = null) {
    const { format, filters = {} } = options;

    // Create export record
    const exportJob = new Export({
      format,
      filters,
      status: 'pending'
    });

    await exportJob.save();

    // Process export asynchronously
    this.processExport(exportJob._id, socketHandlers).catch(error => {
      console.error('Export processing failed:', error);
    });

    return exportJob;
  }

  /**
   * Processes an export job
   * @static
   * @async
   * @param {string} exportId - Export job ID
   * @param {Object} socketHandlers - Socket handlers for real-time updates
   * @returns {Promise<void>}
   */
  static async processExport(exportId, socketHandlers = null) {
    try {
      const exportJob = await Export.findById(exportId);
      if (!exportJob) {
        throw new Error('Export job not found');
      }

      // Update status to processing
      exportJob.status = 'processing';
      await exportJob.save();

      // Broadcast status update with progress
      if (socketHandlers) {
        socketHandlers.broadcastExportUpdate('processing', exportJob, { progress: 0 });
      }

      // Build query from filters
      const query = this.buildQueryFromFilters(exportJob.filters);

      // Use aggregation pipeline for very large datasets (>10k records)
      const estimatedCount = await Task.countDocuments(query);

      let tasks;
      if (estimatedCount > 10000) {
        // Use aggregation pipeline for memory efficiency with large datasets
        tasks = await this.getTasksWithAggregation(query);
      } else {
        // Use regular query for smaller datasets
        tasks = await Task.find(query)
          .sort({ createdAt: -1 })
          .lean()
          .exec();
      }

      exportJob.recordCount = tasks.length;

      // Generate file
      const fileName = this.generateFileName(exportJob.format, exportJob.filters);
      const filePath = path.join(process.cwd(), 'exports', fileName);

      // Ensure exports directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Generate export file with progress updates
      if (exportJob.format === 'csv') {
        await this.generateCSV(tasks, filePath, exportJob, socketHandlers);
      } else if (exportJob.format === 'json') {
        await this.generateJSON(tasks, filePath, exportJob, socketHandlers);
      }

      // Update export job
      exportJob.status = 'completed';
      exportJob.filePath = filePath;
      exportJob.fileName = fileName;
      await exportJob.save();

      // Cache the export result
      const cacheKey = this.generateCacheKey(exportJob.filters, exportJob.format);
      await redisClient.setex(cacheKey, 3600, JSON.stringify({
        exportId: exportJob._id,
        fileName,
        recordCount: exportJob.recordCount,
        createdAt: exportJob.createdAt
      }));

      // Broadcast completion
      if (socketHandlers) {
        socketHandlers.broadcastExportUpdate('completed', exportJob);
      }

    } catch (error) {
      console.error('Export processing error:', error);

      // Update export job with error
      const exportJob = await Export.findById(exportId);
      if (exportJob) {
        exportJob.status = 'failed';
        exportJob.error = error.message;
        await exportJob.save();

        // Broadcast failure
        if (socketHandlers) {
          socketHandlers.broadcastExportUpdate('failed', exportJob);
        }
      }
    }
  }

  /**
   * Gets tasks using MongoDB aggregation pipeline for large datasets
   * @static
   * @async
   * @param {Object} query - MongoDB query object
   * @returns {Promise<Array>} Array of task documents
   */
  static async getTasksWithAggregation(query) {
    const pipeline = [
      { $match: query },
      { $sort: { createdAt: -1 } },
      {
        $project: {
          _id: 1,
          title: 1,
          description: 1,
          status: 1,
          priority: 1,
          createdAt: 1,
          updatedAt: 1,
          completedAt: 1,
          estimatedTime: 1,
          actualTime: 1
        }
      }
    ];

    return await Task.aggregate(pipeline).exec();
  }

  /**
   * Builds MongoDB query from filter parameters
   * @static
   * @param {Object} filters - Filter parameters
   * @returns {Object} MongoDB query object
   */
  static buildQueryFromFilters(filters) {
    const query = {};

    // Status filter
    if (filters.status && filters.status !== 'all') {
      query.status = filters.status;
    }

    // Priority filter
    if (filters.priority && filters.priority !== 'all') {
      query.priority = filters.priority;
    }

    // Date range filter
    if (filters.dateFrom || filters.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) {
        query.createdAt.$gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        query.createdAt.$lte = new Date(filters.dateTo);
      }
    }

    // Text search filter
    if (filters.search) {
      query.$or = [
        { title: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } }
      ];
    }

    // Completion date filter
    if (filters.completedDateFrom || filters.completedDateTo) {
      query.completedAt = {};
      if (filters.completedDateFrom) {
        query.completedAt.$gte = new Date(filters.completedDateFrom);
      }
      if (filters.completedDateTo) {
        query.completedAt.$lte = new Date(filters.completedDateTo);
      }
    }

    return query;
  }

  /**
   * Generates CSV file from tasks data with streaming for large datasets
   * @static
   * @async
   * @param {Array} tasks - Array of task documents
   * @param {string} filePath - Output file path
   * @param {Object} exportJob - Export job for progress updates
   * @param {Object} socketHandlers - Socket handlers for real-time updates
   * @returns {Promise<void>}
   */
  static async generateCSV(tasks, filePath, exportJob = null, socketHandlers = null) {
    const headers = [
      'ID',
      'Title',
      'Description',
      'Status',
      'Priority',
      'Created At',
      'Updated At',
      'Completed At',
      'Estimated Time (minutes)',
      'Actual Time (minutes)'
    ];

    // Use streaming for large datasets to avoid memory issues
    const writeStream = await fs.open(filePath, 'w');

    // Write headers
    await writeStream.write(headers.join(',') + '\n');

    // Process tasks in batches to manage memory with progress updates
    const batchSize = 1000;
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      let batchContent = '';

      for (const task of batch) {
        const row = [
          `"${task._id}"`,
          `"${this.escapeCsvField(task.title)}"`,
          `"${this.escapeCsvField(task.description || '')}"`,
          `"${task.status}"`,
          `"${task.priority}"`,
          `"${task.createdAt instanceof Date ? task.createdAt.toISOString() : new Date(task.createdAt).toISOString()}"`,
          `"${task.updatedAt instanceof Date ? task.updatedAt.toISOString() : new Date(task.updatedAt).toISOString()}"`,
          `"${task.completedAt ? (task.completedAt instanceof Date ? task.completedAt.toISOString() : new Date(task.completedAt).toISOString()) : ''}"`,
          `"${task.estimatedTime || ''}"`,
          `"${task.actualTime || ''}"`
        ];
        batchContent += row.join(',') + '\n';
      }

      await writeStream.write(batchContent);

      // Send progress update
      if (exportJob && socketHandlers && tasks.length > 1000) {
        const progress = Math.min(95, Math.round(((i + batchSize) / tasks.length) * 100));
        socketHandlers.broadcastExportUpdate('processing', exportJob, { progress });
      }
    }

    await writeStream.close();
  }

  /**
   * Generates JSON file from tasks data with streaming for large datasets
   * @static
   * @async
   * @param {Array} tasks - Array of task documents
   * @param {string} filePath - Output file path
   * @returns {Promise<void>}
   */
  static async generateJSON(tasks, filePath) {
    const writeStream = await fs.open(filePath, 'w');

    // Write opening structure
    const metadata = {
      exportedAt: new Date().toISOString(),
      totalRecords: tasks.length,
      format: 'json'
    };

    await writeStream.write('{\n');
    await writeStream.write(`  "metadata": ${JSON.stringify(metadata, null, 2).replace(/\n/g, '\n  ')},\n`);
    await writeStream.write('  "tasks": [\n');

    // Process tasks in batches
    const batchSize = 1000;
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);

      for (let j = 0; j < batch.length; j++) {
        const task = batch[j];
        const taskData = {
          id: task._id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
          completedAt: task.completedAt,
          estimatedTime: task.estimatedTime,
          actualTime: task.actualTime
        };

        const isLast = (i + j) === (tasks.length - 1);
        const taskJson = JSON.stringify(taskData, null, 2)
          .replace(/\n/g, '\n    '); // Indent for array items

        await writeStream.write(`    ${taskJson}${isLast ? '' : ','}\n`);
      }
    }

    await writeStream.write('  ]\n');
    await writeStream.write('}\n');

    await writeStream.close();
  }

  /**
   * Escapes CSV field content
   * @static
   * @param {string} field - Field content to escape
   * @returns {string} Escaped field content
   */
  static escapeCsvField(field) {
    if (typeof field !== 'string') return '';
    return field.replace(/"/g, '""');
  }

  /**
   * Generates unique filename for export
   * @static
   * @param {string} format - Export format
   * @param {Object} filters - Applied filters
   * @returns {string} Generated filename
   */
  static generateFileName(format, filters) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filterSuffix = Object.keys(filters).length > 0 ? '-filtered' : '';
    return `tasks-export-${timestamp}${filterSuffix}.${format}`;
  }

  /**
   * Generates cache key for export
   * @static
   * @param {Object} filters - Applied filters
   * @param {string} format - Export format
   * @returns {string} Cache key
   */
  static generateCacheKey(filters, format) {
    const filterStr = JSON.stringify(filters);
    const hash = crypto.createHash('md5').update(filterStr).digest('hex');
    return `export:${format}:${hash}`;
  }

  /**
   * Gets export history with pagination
   * @static
   * @async
   * @param {Object} options - Pagination options
   * @returns {Promise<Object>} Paginated export history
   */
  static async getExportHistory(options = {}) {
    const { page = 1, limit = 10 } = options;

    const exports = await Export.find()
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Export.countDocuments();

    return {
      exports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Gets export file for download
   * @static
   * @async
   * @param {string} exportId - Export ID
   * @returns {Promise<Object>} Export file info
   */
  static async getExportFile(exportId) {
    const exportJob = await Export.findById(exportId);

    if (!exportJob) {
      throw new Error('Export not found');
    }

    if (exportJob.status !== 'completed') {
      throw new Error('Export not completed');
    }

    if (!exportJob.filePath) {
      throw new Error('Export file not found');
    }

    // Check if file exists
    try {
      await fs.access(exportJob.filePath);
    } catch {
      throw new Error('Export file no longer available');
    }

    return {
      filePath: exportJob.filePath,
      fileName: exportJob.fileName,
      format: exportJob.format,
      recordCount: exportJob.recordCount
    };
  }

  /**
   * Checks if export with same filters exists in cache
   * @static
   * @async
   * @param {Object} filters - Filter parameters
   * @param {string} format - Export format
   * @returns {Promise<Object|null>} Cached export info or null
   */
  static async getCachedExport(filters, format) {
    try {
      const cacheKey = this.generateCacheKey(filters, format);
      const cached = await redisClient.get(cacheKey);

      if (cached) {
        const exportInfo = JSON.parse(cached);
        const exportJob = await Export.findById(exportInfo.exportId);

        if (exportJob && exportJob.status === 'completed') {
          return exportJob;
        }
      }

      return null;
    } catch (error) {
      console.error('Cache check error:', error);
      return null;
    }
  }
}

export default ExportService;
