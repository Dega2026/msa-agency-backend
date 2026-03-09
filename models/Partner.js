const mongoose = require('mongoose');

const partnerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    logoUrl: {
      type: String,
      required: true,
      trim: true,
    },
    websiteUrl: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'partners',
  }
);

module.exports = mongoose.model('Partner', partnerSchema);
