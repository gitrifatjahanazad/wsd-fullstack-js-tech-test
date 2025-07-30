/**
 * @fileoverview Unit tests for ExportService
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import ExportService from '../../src/services/exportService.js';
import Export from '../../src/models/Export.js';

describe('ExportService', () => {
  describe('buildQueryFromFilters', () => {
    it('should build empty query for no filters', () => {
      const query = ExportService.buildQueryFromFilters({});
      assert.deepStrictEqual(query, {});
    });

    it('should build query with status filter', () => {
      const filters = { status: 'completed' };
      const query = ExportService.buildQueryFromFilters(filters);
      assert.deepStrictEqual(query, { status: 'completed' });
    });

    it('should ignore "all" status filter', () => {
      const filters = { status: 'all' };
      const query = ExportService.buildQueryFromFilters(filters);
      assert.deepStrictEqual(query, {});
    });

    it('should build query with priority filter', () => {
      const filters = { priority: 'high' };
      const query = ExportService.buildQueryFromFilters(filters);
      assert.deepStrictEqual(query, { priority: 'high' });
    });

    it('should build query with text search', () => {
      const filters = { search: 'test' };
      const query = ExportService.buildQueryFromFilters(filters);
      assert.deepStrictEqual(query, {
        $or: [
          { title: { $regex: 'test', $options: 'i' } },
          { description: { $regex: 'test', $options: 'i' } }
        ]
      });
    });

    it('should build query with date range', () => {
      const filters = {
        dateFrom: '2023-01-01',
        dateTo: '2023-12-31'
      };
      const query = ExportService.buildQueryFromFilters(filters);
      assert.deepStrictEqual(query, {
        createdAt: {
          $gte: new Date('2023-01-01'),
          $lte: new Date('2023-12-31')
        }
      });
    });

    it('should build query with completion date range', () => {
      const filters = {
        completedDateFrom: '2023-01-01',
        completedDateTo: '2023-12-31'
      };
      const query = ExportService.buildQueryFromFilters(filters);
      assert.deepStrictEqual(query, {
        completedAt: {
          $gte: new Date('2023-01-01'),
          $lte: new Date('2023-12-31')
        }
      });
    });

    it('should build complex query with multiple filters', () => {
      const filters = {
        status: 'completed',
        priority: 'high',
        search: 'important',
        dateFrom: '2023-01-01'
      };
      const query = ExportService.buildQueryFromFilters(filters);
      assert.deepStrictEqual(query, {
        status: 'completed',
        priority: 'high',
        $or: [
          { title: { $regex: 'important', $options: 'i' } },
          { description: { $regex: 'important', $options: 'i' } }
        ],
        createdAt: {
          $gte: new Date('2023-01-01')
        }
      });
    });
  });

  describe('escapeCsvField', () => {
    it('should handle empty string', () => {
      const result = ExportService.escapeCsvField('');
      assert.strictEqual(result, '');
    });

    it('should handle null/undefined', () => {
      assert.strictEqual(ExportService.escapeCsvField(null), '');
      assert.strictEqual(ExportService.escapeCsvField(undefined), '');
    });

    it('should escape double quotes', () => {
      const result = ExportService.escapeCsvField('Hello "world"');
      assert.strictEqual(result, 'Hello ""world""');
    });

    it('should handle text without quotes', () => {
      const result = ExportService.escapeCsvField('Hello world');
      assert.strictEqual(result, 'Hello world');
    });
  });

  describe('generateFileName', () => {
    it('should generate filename with format', () => {
      const filename = ExportService.generateFileName('csv', {});
      assert.ok(filename.endsWith('.csv'));
      assert.ok(filename.startsWith('tasks-export-'));
    });

    it('should add filtered suffix when filters are present', () => {
      const filename = ExportService.generateFileName('json', { status: 'completed' });
      assert.ok(filename.includes('-filtered'));
      assert.ok(filename.endsWith('.json'));
    });

    it('should not add filtered suffix when no filters', () => {
      const filename = ExportService.generateFileName('csv', {});
      assert.ok(!filename.includes('-filtered'));
    });
  });

  describe('generateCacheKey', () => {
    it('should generate consistent cache key for same inputs', () => {
      const filters = { status: 'completed', priority: 'high' };
      const key1 = ExportService.generateCacheKey(filters, 'csv');
      const key2 = ExportService.generateCacheKey(filters, 'csv');
      assert.strictEqual(key1, key2);
    });

    it('should generate different cache keys for different filters', () => {
      const filters1 = { status: 'completed' };
      const filters2 = { status: 'pending' };
      const key1 = ExportService.generateCacheKey(filters1, 'csv');
      const key2 = ExportService.generateCacheKey(filters2, 'csv');
      assert.notStrictEqual(key1, key2);
    });

    it('should generate different cache keys for different formats', () => {
      const filters = { status: 'completed' };
      const key1 = ExportService.generateCacheKey(filters, 'csv');
      const key2 = ExportService.generateCacheKey(filters, 'json');
      assert.notStrictEqual(key1, key2);
    });

    it('should include format in cache key', () => {
      const filters = {};
      const csvKey = ExportService.generateCacheKey(filters, 'csv');
      const jsonKey = ExportService.generateCacheKey(filters, 'json');
      assert.ok(csvKey.includes('csv'));
      assert.ok(jsonKey.includes('json'));
    });
  });
});