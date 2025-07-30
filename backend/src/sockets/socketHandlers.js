/**
 * @fileoverview Socket.IO event handlers for real-time communication
 * @module sockets/SocketHandlers
 */

import AnalyticsService from '../services/analyticsService.js';

/**
 * Handles Socket.IO connections and real-time events
 * @class SocketHandlers
 */
class SocketHandlers {
  /**
   * Creates SocketHandlers instance and sets up event listeners
   * @param {Object} io - Socket.IO server instance
   */
  constructor(io) {
    this.io = io;
    this.setupEventHandlers();
  }

  /**
   * Sets up Socket.IO event handlers for client connections
   * @private
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);

      socket.on('join-analytics', () => {
        socket.join('analytics');
        console.log(`📊 Client ${socket.id} joined analytics room`);
      });

      socket.on('join-exports', () => {
        socket.join('exports');
        console.log(`📤 Client ${socket.id} joined exports room`);
      });

      socket.on('request-analytics', async () => {
        try {
          const metrics = await AnalyticsService.getTaskMetrics();
          socket.emit('analytics-update', metrics);
        } catch (error) {
          console.error('Error sending analytics update:', error);
          socket.emit('analytics-error', { message: 'Failed to get analytics data' });
        }
      });

      socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Broadcasts analytics updates to all connected clients in analytics room
   * @async
   * @returns {Promise<void>}
   */
  async broadcastAnalyticsUpdate() {
    try {
      const metrics = await AnalyticsService.getTaskMetrics();
      this.io.to('analytics').emit('analytics-update', metrics);
    } catch (error) {
      console.error('Error broadcasting analytics update:', error);
    }
  }

  /**
   * Broadcasts task updates to all connected clients
   * @param {string} action - Action performed (created, updated, deleted)
   * @param {Object} task - Task data
   */
  broadcastTaskUpdate(action, task) {
    this.io.emit('task-update', {
      action,
      task,
      timestamp: new Date().toISOString()
    });

    this.broadcastAnalyticsUpdate();
  }

  /**
   * Broadcasts notifications to all connected clients
   * @param {string} message - Notification message
   * @param {string} [type='info'] - Notification type (info, warning, error)
   */
  broadcastNotification(message, type = 'info') {
    this.io.emit('notification', {
      message,
      type,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcasts export updates to all connected clients in exports room
   * @param {string} status - Export status (processing, completed, failed)
   * @param {Object} exportJob - Export job data
   * @param {Object} [metadata={}] - Additional metadata (progress, etc.)
   */
  broadcastExportUpdate(status, exportJob, metadata = {}) {
    const updateData = {
      exportId: exportJob._id,
      status,
      format: exportJob.format,
      recordCount: exportJob.recordCount,
      timestamp: new Date().toISOString(),
      ...metadata
    };

    // Send to exports room for detailed updates
    this.io.to('exports').emit('export-update', updateData);

    // Send notification to all clients for important status changes
    if (status === 'completed') {
      this.broadcastNotification(
        `✅ Export completed: ${exportJob.recordCount} records exported as ${exportJob.format.toUpperCase()}`,
        'success'
      );
    } else if (status === 'failed') {
      this.broadcastNotification(
        `❌ Export failed: ${exportJob.error || 'Unknown error'}`,
        'error'
      );
    }
  }

  /**
   * Checks metrics against thresholds and sends notifications if exceeded
   * @async
   * @param {Object} metrics - Analytics metrics object
   * @returns {Promise<void>}
   */
  async checkMetricThresholds(metrics) {
    if (metrics.completionRate < 50) {
      this.broadcastNotification(
        `⚠️ Task completion rate has dropped to ${metrics.completionRate}%`,
        'warning'
      );
    }

    if (metrics.tasksByStatus.pending > 20) {
      this.broadcastNotification(
        `📋 High number of pending tasks: ${metrics.tasksByStatus.pending}`,
        'info'
      );
    }

    if (metrics.tasksByPriority.high > 10) {
      this.broadcastNotification(
        `🔥 High priority tasks need attention: ${metrics.tasksByPriority.high}`,
        'warning'
      );
    }
  }
}

export default SocketHandlers;
