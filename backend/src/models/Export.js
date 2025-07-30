/**
 * @fileoverview Export model definition for tracking export history
 * @module models/Export
 */

import mongoose from 'mongoose';

/**
 * Mongoose schema for Export documents
 * @typedef {Object} ExportSchema
 * @property {string} format - Export format: 'csv' or 'json'
 * @property {Object} filters - Applied filters during export
 * @property {number} recordCount - Number of records exported
 * @property {string} status - Export status: 'pending', 'processing', 'completed', 'failed'
 * @property {string} filePath - Path to generated export file
 * @property {string} fileName - Generated file name
 * @property {Date} createdAt - Export creation timestamp
 * @property {Date} completedAt - Export completion timestamp
 * @property {string} error - Error message if export failed
 */
const exportSchema = new mongoose.Schema({
  format: {
    type: String,
    enum: ['csv', 'json'],
    required: true,
    index: true
  },
  filters: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  recordCount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  filePath: {
    type: String
  },
  fileName: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  completedAt: {
    type: Date
  },
  error: {
    type: String
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
exportSchema.index({ status: 1, createdAt: -1 });
exportSchema.index({ createdAt: -1 });

/**
 * Pre-save middleware to set completedAt when status changes to completed/failed
 */
exportSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    if ((this.status === 'completed' || this.status === 'failed') && !this.completedAt) {
      this.completedAt = new Date();
    }
  }
  next();
});

/**
 * Export model for managing export documents in MongoDB
 * @type {mongoose.Model}
 */
const Export = mongoose.model('Export', exportSchema);

export default Export;
