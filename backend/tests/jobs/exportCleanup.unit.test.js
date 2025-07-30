import { test, describe, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';

// Mock dependencies
const mockExport = {
  find: mock.fn(),
  countDocuments: mock.fn(),
  findByIdAndDelete: mock.fn(),
  aggregate: mock.fn()
};

const mockFs = {
  stat: mock.fn(),
  unlink: mock.fn(),
  readdir: mock.fn(),
  rmdir: mock.fn()
};

// Mock modules
mock.module('../../../src/models/Export.js', () => ({
  default: mockExport
}));

mock.module('fs/promises', () => mockFs);

describe('ExportCleanupJob Unit Tests', () => {
  let ExportCleanupJob;
  let originalConsoleLog;
  let originalConsoleError;
  let originalConsoleWarn;

  beforeEach(async () => {
    // Import the module after mocking
    ExportCleanupJob = (await import('../../src/jobs/exportCleanup.js')).default;
    
    // Mock console methods
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalConsoleWarn = console.warn;
    console.log = mock.fn();
    console.error = mock.fn();
    console.warn = mock.fn();

    // Reset all mocks
    mock.reset();
    mockExport.find.mock.resetCalls();
    mockExport.countDocuments.mock.resetCalls();
    mockExport.findByIdAndDelete.mock.resetCalls();
    mockExport.aggregate.mock.resetCalls();
    mockFs.stat.mock.resetCalls();
    mockFs.unlink.mock.resetCalls();
    mockFs.readdir.mock.resetCalls();
    mockFs.rmdir.mock.resetCalls();
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  describe('run method', () => {
    test('should run cleanup with default options', async () => {
      const mockExportRecord = {
        _id: 'export123',
        filePath: '/test/export.csv',
        fileName: 'test-export.csv',
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) // 8 days ago
      };

      mockExport.find.mock.mockImplementationOnce(() => ({
        lean: mock.fn(() => Promise.resolve([mockExportRecord]))
      }));

      mockFs.stat.mock.mockImplementationOnce(() => Promise.resolve({ size: 1024 }));
      mockFs.unlink.mock.mockImplementationOnce(() => Promise.resolve());
      mockExport.findByIdAndDelete.mock.mockImplementationOnce(() => Promise.resolve());
      mockFs.readdir.mock.mockImplementationOnce(() => Promise.resolve([]));

      const results = await ExportCleanupJob.run();

      assert.strictEqual(results.exportRecordsDeleted, 1);
      assert.strictEqual(results.filesDeleted, 1);
      assert.strictEqual(results.spaceSaved, 1024);
      assert.strictEqual(results.errors.length, 0);
      assert(mockExport.findByIdAndDelete.mock.calls.length === 1);
    });

    test('should handle dry run mode', async () => {
      const mockExportRecord = {
        _id: 'export123',
        filePath: '/test/export.csv',
        fileName: 'test-export.csv'
      };

      mockExport.find.mock.mockImplementationOnce(() => ({
        lean: mock.fn(() => Promise.resolve([mockExportRecord]))
      }));

      mockFs.stat.mock.mockImplementationOnce(() => Promise.resolve({ size: 2048 }));
      mockFs.readdir.mock.mockImplementationOnce(() => Promise.resolve([]));

      const results = await ExportCleanupJob.run({ dryRun: true });

      assert.strictEqual(results.exportRecordsDeleted, 1);
      assert.strictEqual(results.filesDeleted, 1);
      assert.strictEqual(results.spaceSaved, 2048);
      
      // Should not actually delete in dry run
      assert(mockFs.unlink.mock.calls.length === 0);
      assert(mockExport.findByIdAndDelete.mock.calls.length === 0);
    });

    test('should handle file not found errors gracefully', async () => {
      const mockExportRecord = {
        _id: 'export123',
        filePath: '/nonexistent/export.csv',
        fileName: 'test-export.csv'
      };

      mockExport.find.mock.mockImplementationOnce(() => ({
        lean: mock.fn(() => Promise.resolve([mockExportRecord]))
      }));

      const fileError = new Error('File not found');
      fileError.code = 'ENOENT';
      mockFs.stat.mock.mockImplementationOnce(() => Promise.reject(fileError));
      mockExport.findByIdAndDelete.mock.mockImplementationOnce(() => Promise.resolve());
      mockFs.readdir.mock.mockImplementationOnce(() => Promise.resolve([]));

      const results = await ExportCleanupJob.run();

      assert.strictEqual(results.exportRecordsDeleted, 1);
      assert.strictEqual(results.filesDeleted, 0);
      assert.strictEqual(results.errors.length, 0);
    });

    test('should handle other file errors', async () => {
      const mockExportRecord = {
        _id: 'export123',
        filePath: '/test/export.csv',
        fileName: 'test-export.csv'
      };

      mockExport.find.mock.mockImplementationOnce(() => ({
        lean: mock.fn(() => Promise.resolve([mockExportRecord]))
      }));

      mockFs.stat.mock.mockImplementationOnce(() => Promise.resolve({ size: 1024 }));
      mockFs.unlink.mock.mockImplementationOnce(() => Promise.reject(new Error('Permission denied')));
      mockExport.findByIdAndDelete.mock.mockImplementationOnce(() => Promise.resolve());
      mockFs.readdir.mock.mockImplementationOnce(() => Promise.resolve([]));

      const results = await ExportCleanupJob.run();

      assert.strictEqual(results.exportRecordsDeleted, 1);
      assert.strictEqual(results.errors.length, 1);
      assert(results.errors[0].includes('File deletion failed'));
    });

    test('should handle custom retention days', async () => {
      mockExport.find.mock.mockImplementationOnce(() => ({
        lean: mock.fn(() => Promise.resolve([]))
      }));
      mockFs.readdir.mock.mockImplementationOnce(() => Promise.resolve([]));

      await ExportCleanupJob.run({ retentionDays: 14 });

      // Verify the correct date filter was used
      const findCall = mockExport.find.mock.calls[0];
      const filter = findCall[0];
      
      assert(filter.createdAt.$lt instanceof Date);
      // Should be 14 days ago (approximately)
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const timeDiff = Math.abs(filter.createdAt.$lt.getTime() - fourteenDaysAgo.getTime());
      assert(timeDiff < 60000); // Within 1 minute
    });
  });

  describe('cleanupEmptyDirectories method', () => {
    test('should clean up empty directories', async () => {
      const mockDirEntry = {
        name: 'empty-dir',
        isDirectory: () => true
      };

      mockFs.readdir.mock.mockImplementationOnce(() => Promise.resolve([mockDirEntry]));
      mockFs.readdir.mock.mockImplementationOnce(() => Promise.resolve([])); // Empty directory
      mockFs.rmdir.mock.mockImplementationOnce(() => Promise.resolve());

      await ExportCleanupJob.cleanupEmptyDirectories();

      assert(mockFs.rmdir.mock.calls.length === 1);
    });

    test('should not remove non-empty directories', async () => {
      const mockDirEntry = {
        name: 'non-empty-dir',
        isDirectory: () => true
      };

      mockFs.readdir.mock.mockImplementationOnce(() => Promise.resolve([mockDirEntry]));
      mockFs.readdir.mock.mockImplementationOnce(() => Promise.resolve(['file.txt'])); // Non-empty directory

      await ExportCleanupJob.cleanupEmptyDirectories();

      assert(mockFs.rmdir.mock.calls.length === 0);
    });

    test('should handle dry run mode', async () => {
      const mockDirEntry = {
        name: 'empty-dir',
        isDirectory: () => true
      };

      mockFs.readdir.mock.mockImplementationOnce(() => Promise.resolve([mockDirEntry]));
      mockFs.readdir.mock.mockImplementationOnce(() => Promise.resolve([])); // Empty directory

      await ExportCleanupJob.cleanupEmptyDirectories(true);

      assert(mockFs.rmdir.mock.calls.length === 0);
    });
  });

  describe('formatBytes method', () => {
    test('should format bytes correctly', () => {
      assert.strictEqual(ExportCleanupJob.formatBytes(0), '0 Bytes');
      assert.strictEqual(ExportCleanupJob.formatBytes(1024), '1 KB');
      assert.strictEqual(ExportCleanupJob.formatBytes(1024 * 1024), '1 MB');
      assert.strictEqual(ExportCleanupJob.formatBytes(1024 * 1024 * 1024), '1 GB');
      assert.strictEqual(ExportCleanupJob.formatBytes(1536), '1.5 KB');
    });
  });

  describe('schedule method', () => {
    test('should schedule cleanup job', () => {
      const originalSetInterval = global.setInterval;
      global.setInterval = mock.fn(() => 'timer-id');

      const timer = ExportCleanupJob.schedule({ intervalHours: 12, retentionDays: 5 });

      assert.strictEqual(timer, 'timer-id');
      assert(global.setInterval.mock.calls.length === 1);
      
      const [callback, interval] = global.setInterval.mock.calls[0];
      assert.strictEqual(interval, 12 * 60 * 60 * 1000); // 12 hours in ms
      assert(typeof callback === 'function');

      global.setInterval = originalSetInterval;
    });
  });

  describe('getCleanupStats method', () => {
    test('should return cleanup statistics', async () => {
      const mockOldExport = {
        _id: 'export123',
        filePath: '/test/export.csv',
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
      };

      mockExport.countDocuments.mock.mockImplementationOnce(() => Promise.resolve(10));
      mockExport.find.mock.mockImplementationOnce(() => ({
        lean: mock.fn(() => Promise.resolve([mockOldExport]))
      }));
      mockFs.stat.mock.mockImplementationOnce(() => Promise.resolve({ size: 2048 }));
      mockExport.aggregate.mock.mockImplementationOnce(() => Promise.resolve([{
        _id: null,
        oldestExport: new Date('2024-01-01'),
        newestExport: new Date('2024-12-01')
      }]));

      const stats = await ExportCleanupJob.getCleanupStats(7);

      assert.strictEqual(stats.totalExports, 10);
      assert.strictEqual(stats.oldExports, 1);
      assert.strictEqual(stats.estimatedSpaceSaved, 2048);
      assert(stats.oldestExport instanceof Date);
      assert(stats.newestExport instanceof Date);
    });

    test('should handle missing files in stats calculation', async () => {
      const mockOldExport = {
        _id: 'export123',
        filePath: '/nonexistent/export.csv'
      };

      mockExport.countDocuments.mock.mockImplementationOnce(() => Promise.resolve(5));
      mockExport.find.mock.mockImplementationOnce(() => ({
        lean: mock.fn(() => Promise.resolve([mockOldExport]))
      }));
      mockFs.stat.mock.mockImplementationOnce(() => Promise.reject(new Error('File not found')));
      mockExport.aggregate.mock.mockImplementationOnce(() => Promise.resolve([]));

      const stats = await ExportCleanupJob.getCleanupStats();

      assert.strictEqual(stats.totalExports, 5);
      assert.strictEqual(stats.oldExports, 1);
      assert.strictEqual(stats.estimatedSpaceSaved, 0);
      assert.strictEqual(stats.oldestExport, null);
      assert.strictEqual(stats.newestExport, null);
    });
  });
});