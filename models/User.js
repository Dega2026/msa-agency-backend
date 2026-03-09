const mongoose = require('mongoose');

const roles = [
  'Founder',
  'Strategist',
  'Creative',
  'Analyst',
  'News',
  'Growth_Manager',
  'Operations',
];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: roles,
      default: 'Strategist',
      required: true,
    },
    permissions: {
      type: [String],
      default: [],
    },
    profilePath: {
      type: String,
      default: '/profiles/index.html',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model('User', userSchema);
