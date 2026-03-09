const mongoose = require('mongoose');

const successSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    technicalDetails: {
      type: String,
      default: '',
      trim: true,
    },
    lang: {
      type: String,
      enum: ['en', 'ar'],
      default: 'en',
      required: true,
    },
    category: {
      type: String,
      enum: ['News', 'Model_A', 'Model_B', 'Model_C'],
      default: 'News',
      required: true,
    },
    published: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'success_gallery',
  }
);

module.exports = mongoose.model('Success', successSchema);
