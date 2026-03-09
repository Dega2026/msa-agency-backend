const mongoose = require('mongoose');

const intelligenceUnitSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['strategy', 'creative', 'analytics', 'automation', 'news'],
      required: true,
    },
    ownerRole: {
      type: String,
      enum: ['Founder', 'Strategist', 'Creative', 'Analyst', 'News'],
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'draft', 'archived'],
      default: 'active',
    },
    kpi: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'intelligence_units',
  }
);

module.exports = mongoose.model('IntelligenceUnit', intelligenceUnitSchema);
