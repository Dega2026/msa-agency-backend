const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    planId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    title_en: {
      type: String,
      required: true,
      trim: true,
    },
    title_ar: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    discountPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    features_en: {
      type: [String],
      default: [],
    },
    features_ar: {
      type: [String],
      default: [],
    },
    isSpecialOffer: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'plans',
  }
);

module.exports = mongoose.model('Plan', planSchema);
