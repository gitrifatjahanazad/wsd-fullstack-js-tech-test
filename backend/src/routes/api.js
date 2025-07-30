/**
 * @fileoverview API routes for task management and analytics
 * @module routes/api
 */

import express from 'express';
import Task from '../models/Task.js';
import Export from '../models/Export.js';
import AnalyticsService from '../services/analyticsService.js';
import ExportService from '../services/exportService.js';
import { redisClient } from '../config/redis.js';

const router = express.Router();

/**
 * Socket handlers reference for real-time updates
 * @type {Object|null}
 */
let socketHandlers = null;

/**
 * Sets socket handlers for broadcasting real-time updates
 * @param {Object} handlers - Socket handler object with broadcast methods
 * @example
 * setSocketHandlers(socketHandlers);
 */
export const setSocketHandlers = (handlers) => {
  socketHandlers = handlers;
};

/**
 * GET /tasks - Retrieve tasks with pagination, filtering, and sorting
 * @name GetTasks
 * @function
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=10] - Number of tasks per page
 * @param {string} [req.query.status] - Filter by task status
 * @param {string} [req.query.priority] - Filter by task priority
 * @param {string} [req.query.search] - Text search in title and description
 * @param {string} [req.query.dateFrom] - Filter tasks created from date
 * @param {string} [req.query.dateTo] - Filter tasks created to date
 * @param {string} [req.query.completedDateFrom] - Filter tasks completed from date
 * @param {string} [req.query.completedDateTo] - Filter tasks completed to date
 * @param {string} [req.query.sortBy=createdAt] - Field to sort by
 * @param {string} [req.query.sortOrder=desc] - Sort order (asc/desc)
 * @returns {Object} Paginated tasks with metadata
 */
router.get('/tasks', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      priority,
      search,
      dateFrom,
      dateTo,
      completedDateFrom,
      completedDateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Validate pagination parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'Page must be a positive integer'
      });
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        message: 'Limit must be an integer between 1 and 100'
      });
    }

    // Validate status filter
    if (status && status !== 'all' && !['pending', 'in-progress', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be one of: pending, in-progress, completed, all'
      });
    }

    // Validate priority filter
    if (priority && priority !== 'all' && !['low', 'medium', 'high'].includes(priority)) {
      return res.status(400).json({
        success: false,
        message: 'Priority must be one of: low, medium, high, all'
      });
    }

    // Validate search parameter
    if (search && search.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be 100 characters or less'
      });
    }

    // Validate date parameters
    if (dateFrom && isNaN(Date.parse(dateFrom))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid dateFrom format'
      });
    }

    if (dateTo && isNaN(Date.parse(dateTo))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid dateTo format'
      });
    }

    if (completedDateFrom && isNaN(Date.parse(completedDateFrom))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid completedDateFrom format'
      });
    }

    if (completedDateTo && isNaN(Date.parse(completedDateTo))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid completedDateTo format'
      });
    }

    // Validate sorting parameters
    const validSortFields = ['createdAt', 'updatedAt', 'title', 'priority', 'status'];
    if (!validSortFields.includes(sortBy)) {
      return res.status(400).json({
        success: false,
        message: `SortBy must be one of: ${validSortFields.join(', ')}`
      });
    }

    if (!['asc', 'desc'].includes(sortOrder)) {
      return res.status(400).json({
        success: false,
        message: 'SortOrder must be either asc or desc'
      });
    }

    const query = {};

    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    // Priority filter
    if (priority && priority !== 'all') {
      query.priority = priority;
    }

    // Text search filter
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Date range filters
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        query.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        query.createdAt.$lte = new Date(dateTo);
      }
    }

    // Completed date range filters
    if (completedDateFrom || completedDateTo) {
      query.completedAt = {};
      if (completedDateFrom) {
        query.completedAt.$gte = new Date(completedDateFrom);
      }
      if (completedDateTo) {
        query.completedAt.$lte = new Date(completedDateTo);
      }
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const tasks = await Task.find(query)
      .sort(sort)
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .lean() // Use lean queries for better performance
      .exec();

    const total = await Task.countDocuments(query);

    res.json({
      success: true,
      data: {
        tasks,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        },
        filters: {
          status,
          priority,
          search,
          dateFrom,
          dateTo,
          completedDateFrom,
          completedDateTo
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /tasks/:id - Retrieve a specific task by ID with Redis caching
 * @name GetTaskById
 * @function
 * @param {string} req.params.id - Task ID
 * @returns {Object} Task data or 404 if not found
 */
router.get('/tasks/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task ID format'
      });
    }

    const cacheKey = `task:${id}`;
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      return res.json({
        success: true,
        data: JSON.parse(cached)
      });
    }

    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    await redisClient.setex(cacheKey, 300, JSON.stringify(task));

    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /tasks - Create a new task
 * @name CreateTask
 * @function
 * @param {Object} req.body - Task data
 * @param {string} req.body.title - Task title (required)
 * @param {string} [req.body.description] - Task description
 * @param {string} [req.body.priority] - Task priority
 * @param {number} [req.body.estimatedTime] - Estimated completion time
 * @returns {Object} Created task with success message
 */
router.post('/tasks', async (req, res, next) => {
  try {
    const { title, description, priority, estimatedTime } = req.body;

    // Input validation
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Title is required and must be a non-empty string'
      });
    }

    if (title.trim().length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Title must be 200 characters or less'
      });
    }

    if (description && typeof description !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Description must be a string'
      });
    }

    if (description && description.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Description must be 1000 characters or less'
      });
    }

    if (priority && !['low', 'medium', 'high'].includes(priority)) {
      return res.status(400).json({
        success: false,
        message: 'Priority must be one of: low, medium, high'
      });
    }

    if (estimatedTime && (!Number.isInteger(estimatedTime) || estimatedTime < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Estimated time must be a non-negative integer'
      });
    }

    const task = new Task({
      title: title.trim(),
      description: description ? description.trim() : description,
      priority,
      estimatedTime
    });

    await task.save();

    await AnalyticsService.invalidateCache();

    // Broadcast real-time update
    if (socketHandlers) {
      socketHandlers.broadcastTaskUpdate('created', task);
    }

    res.status(201).json({
      success: true,
      data: task,
      message: 'Task created successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /tasks/:id - Update an existing task
 * @name UpdateTask
 * @function
 * @param {string} req.params.id - Task ID to update
 * @param {Object} req.body - Updated task data
 * @returns {Object} Updated task data or 404 if not found
 */
router.put('/tasks/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Validate MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task ID format'
      });
    }

    // Input validation for updates
    if (updates.title !== undefined) {
      if (!updates.title || typeof updates.title !== 'string' || updates.title.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Title must be a non-empty string'
        });
      }
      if (updates.title.trim().length > 200) {
        return res.status(400).json({
          success: false,
          message: 'Title must be 200 characters or less'
        });
      }
      updates.title = updates.title.trim();
    }

    if (updates.description !== undefined) {
      if (updates.description && typeof updates.description !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Description must be a string'
        });
      }
      if (updates.description && updates.description.length > 1000) {
        return res.status(400).json({
          success: false,
          message: 'Description must be 1000 characters or less'
        });
      }
      if (updates.description) {
        updates.description = updates.description.trim();
      }
    }

    if (updates.priority !== undefined && !['low', 'medium', 'high'].includes(updates.priority)) {
      return res.status(400).json({
        success: false,
        message: 'Priority must be one of: low, medium, high'
      });
    }

    if (updates.status !== undefined && !['pending', 'in-progress', 'completed'].includes(updates.status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be one of: pending, in-progress, completed'
      });
    }

    if (updates.estimatedTime !== undefined && (!Number.isInteger(updates.estimatedTime) || updates.estimatedTime < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Estimated time must be a non-negative integer'
      });
    }

    // Set completedAt when status changes to completed
    if (updates.status === 'completed') {
      updates.completedAt = new Date();
    } else if (updates.status && updates.status !== 'completed') {
      updates.completedAt = null;
    }

    const task = await Task.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    await redisClient.del(`task:${id}`);
    await AnalyticsService.invalidateCache();

    // Broadcast real-time update
    if (socketHandlers) {
      socketHandlers.broadcastTaskUpdate('updated', task);
    }

    res.json({
      success: true,
      data: task,
      message: 'Task updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /tasks/:id - Delete a task by ID
 * @name DeleteTask
 * @function
 * @param {string} req.params.id - Task ID to delete
 * @returns {Object} Success message or 404 if not found
 */
router.delete('/tasks/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task ID format'
      });
    }

    const task = await Task.findByIdAndDelete(id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    await redisClient.del(`task:${id}`);
    await AnalyticsService.invalidateCache();

    // Broadcast real-time update
    if (socketHandlers) {
      socketHandlers.broadcastTaskUpdate('deleted', task);
    }

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /analytics - Retrieve comprehensive task analytics
 * @name GetAnalytics
 * @function
 * @returns {Object} Complete analytics data including metrics and charts
 */
router.get('/analytics', async (req, res, next) => {
  try {
    const metrics = await AnalyticsService.getTaskMetrics();

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /exports - Create a new export job
 * @name CreateExport
 * @function
 * @param {Object} req.body - Export options
 * @param {string} req.body.format - Export format ('csv' or 'json')
 * @param {Object} [req.body.filters] - Filters to apply
 * @returns {Object} Created export job
 */
router.post('/exports', async (req, res, next) => {
  try {
    const { format, filters = {} } = req.body;

    if (!format || !['csv', 'json'].includes(format)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid export format. Must be "csv" or "json"'
      });
    }

    // Check for cached export
    const cachedExport = await ExportService.getCachedExport(filters, format);
    if (cachedExport) {
      return res.json({
        success: true,
        data: cachedExport,
        message: 'Export retrieved from cache'
      });
    }

    // Create new export
    const exportJob = await ExportService.createExport({ format, filters }, socketHandlers);

    res.status(201).json({
      success: true,
      data: exportJob,
      message: 'Export job created successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /exports - Get export history with pagination
 * @name GetExports
 * @function
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number
 * @param {number} [req.query.limit=10] - Items per page
 * @returns {Object} Paginated export history
 */
router.get('/exports', async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    // Validate pagination parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'Page must be a positive integer'
      });
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        message: 'Limit must be an integer between 1 and 100'
      });
    }

    const result = await ExportService.getExportHistory({ page: pageNum, limit: limitNum });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /exports/:id - Get specific export details
 * @name GetExport
 * @function
 * @param {string} req.params.id - Export ID
 * @returns {Object} Export details
 */
router.get('/exports/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid export ID format'
      });
    }

    const exportJob = await Export.findById(id);

    if (!exportJob) {
      return res.status(404).json({
        success: false,
        message: 'Export not found'
      });
    }

    res.json({
      success: true,
      data: exportJob
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /exports/:id/download - Download export file
 * @name DownloadExport
 * @function
 * @param {string} req.params.id - Export ID
 * @returns {File} Export file download
 */
router.get('/exports/:id/download', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid export ID format'
      });
    }

    const fileInfo = await ExportService.getExportFile(id);

    // Set appropriate headers
    res.setHeader('Content-Type', fileInfo.format === 'csv' ? 'text/csv' : 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${fileInfo.fileName}"`);

    // Send file
    res.sendFile(fileInfo.filePath);
  } catch (error) {
    if (error.message === 'Export not found' || error.message === 'Export not completed' || error.message === 'Export file no longer available') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
});

/**
 * GET /health - Health check endpoint
 * @name HealthCheck
 * @function
 * @returns {Object} API health status and timestamp
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString()
  });
});

export default router;
