/**
 * @fileoverview Export file cleanup job for managing disk space
 * @module jobs/exportCleanup
 */

import fs from 'fs/promises';
import path from 'path';
import Export from '../models/Export.js';

/**
 * Cleanup job for removing old export files and database records
 * @class ExportCleanupJob
 */
class ExportCleanupJob {
  /**
   * Runs the cleanup process
   * @static
   * @async
   * @param {Object} options - Cleanup options
   * @param {number} [options.retentionDays=7] - Days to retain exports
   * @param {boolean} [options.dryRun=false] - If true, only logs what would be deleted
   * @returns {Promise<Object>} Cleanup results
   */
  static async run(options = {}) {
    const {
      retentionDays = 7,
      dryRun = false
    } = options;

    console.log(`🧹 Starting export cleanup job (retention: ${retentionDays} days, dry run: ${dryRun})`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const results = {
      exportRecordsDeleted: 0,
      filesDeleted: 0,
      spaceSaved: 0,
      errors: []
    };

    try {
      // Find old exports
      const oldExports = await Export.find({
        createdAt: { $lt: cutoffDate },
        status: { $in: ['completed', 'failed'] }
      }).lean();

      console.log(`📋 Found ${oldExports.length} old export records to process`);

      for (const exportRecord of oldExports) {
        try {
          // Delete file if it exists
          if (exportRecord.filePath) {
            try {
              const stats = await fs.stat(exportRecord.filePath);
              results.spaceSaved += stats.size;

              if (!dryRun) {
                await fs.unlink(exportRecord.filePath);
              }

              results.filesDeleted++;
              console.log(`🗑️  ${dryRun ? '[DRY RUN] Would delete' : 'Deleted'} file: ${exportRecord.fileName} (${this.formatBytes(stats.size)})`);
            } catch (fileError) {
              if (fileError.code !== 'ENOENT') {
                console.warn(`⚠️  Failed to delete file ${exportRecord.filePath}:`, fileError.message);
                results.errors.push(`File deletion failed: ${exportRecord.filePath}`);
              }
            }
          }

          // Delete database record
          if (!dryRun) {
            await Export.findByIdAndDelete(exportRecord._id);
          }

          results.exportRecordsDeleted++;

        } catch (error) {
          console.error(`❌ Error processing export ${exportRecord._id}:`, error);
          results.errors.push(`Export processing failed: ${exportRecord._id}`);
        }
      }

      // Clean up empty directories
      await this.cleanupEmptyDirectories(dryRun);

      console.log('✅ Export cleanup completed:');
      console.log(`   - Export records processed: ${results.exportRecordsDeleted}`);
      console.log(`   - Files processed: ${results.filesDeleted}`);
      console.log(`   - Space saved: ${this.formatBytes(results.spaceSaved)}`);
      console.log(`   - Errors: ${results.errors.length}`);

      if (results.errors.length > 0) {
        console.log('❌ Errors encountered:');
        results.errors.forEach(error => console.log(`   - ${error}`));
      }

    } catch (error) {
      console.error('💥 Export cleanup job failed:', error);
      results.errors.push(`Job failed: ${error.message}`);
    }

    return results;
  }

  /**
   * Cleans up empty export directories
   * @static
   * @async
   * @param {boolean} dryRun - If true, only logs what would be deleted
   * @returns {Promise<void>}
   */
  static async cleanupEmptyDirectories(dryRun = false) {
    try {
      const exportDir = path.join(process.cwd(), 'exports');

      const entries = await fs.readdir(exportDir, { withFileTypes: true }).catch(() => []);
      const directories = entries.filter(entry => entry.isDirectory());

      for (const dir of directories) {
        const dirPath = path.join(exportDir, dir.name);

        try {
          const dirContents = await fs.readdir(dirPath);

          if (dirContents.length === 0) {
            if (!dryRun) {
              await fs.rmdir(dirPath);
            }
            console.log(`🗂️  ${dryRun ? '[DRY RUN] Would remove' : 'Removed'} empty directory: ${dir.name}`);
          }
        } catch (error) {
          console.warn(`⚠️  Failed to process directory ${dirPath}:`, error.message);
        }
      }
    } catch (error) {
      console.warn('⚠️  Directory cleanup failed:', error.message);
    }
  }

  /**
   * Formats bytes into human readable format
   * @static
   * @param {number} bytes - Number of bytes
   * @returns {string} Formatted string
   */
  static formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Schedules periodic cleanup
   * @static
   * @param {Object} options - Schedule options
   * @param {number} [options.intervalHours=24] - Hours between cleanup runs
   * @param {number} [options.retentionDays=7] - Days to retain exports
   * @returns {NodeJS.Timeout} Timer reference
   */
  static schedule(options = {}) {
    const {
      intervalHours = 24,
      retentionDays = 7
    } = options;

    console.log(`⏰ Scheduling export cleanup every ${intervalHours} hours`);

    return setInterval(async () => {
      try {
        await this.run({ retentionDays });
      } catch (error) {
        console.error('💥 Scheduled cleanup failed:', error);
      }
    }, intervalHours * 60 * 60 * 1000);
  }

  /**
   * Gets cleanup statistics without performing cleanup
   * @static
   * @async
   * @param {number} [retentionDays=7] - Days to retain exports
   * @returns {Promise<Object>} Statistics
   */
  static async getCleanupStats(retentionDays = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const stats = {
      totalExports: 0,
      oldExports: 0,
      estimatedSpaceSaved: 0,
      oldestExport: null,
      newestExport: null
    };

    try {
      // Get total export count
      stats.totalExports = await Export.countDocuments();

      // Get old exports
      const oldExports = await Export.find({
        createdAt: { $lt: cutoffDate },
        status: { $in: ['completed', 'failed'] }
      }).lean();

      stats.oldExports = oldExports.length;

      // Calculate estimated space savings
      for (const exportRecord of oldExports) {
        if (exportRecord.filePath) {
          try {
            const stat = await fs.stat(exportRecord.filePath);
            stats.estimatedSpaceSaved += stat.size;
          } catch {
            // File might not exist, ignore
          }
        }
      }

      // Get date range
      const dateRange = await Export.aggregate([
        {
          $group: {
            _id: null,
            oldestExport: { $min: '$createdAt' },
            newestExport: { $max: '$createdAt' }
          }
        }
      ]);

      if (dateRange.length > 0) {
        stats.oldestExport = dateRange[0].oldestExport;
        stats.newestExport = dateRange[0].newestExport;
      }

    } catch (error) {
      console.error('Error getting cleanup stats:', error);
    }

    return stats;
  }
}

export default ExportCleanupJob;
