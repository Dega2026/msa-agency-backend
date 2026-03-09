const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    siteTitle: {
      type: String,
      required: true,
      default: 'MSA Agency',
      trim: true,
    },
    footerSignature: {
      type: String,
      required: true,
      trim: true,
    },
    footer_sig_en: {
      type: String,
      required: true,
      trim: true,
      default:
        "2026 MSA Agency. Engineered & Designed by <a href='../profiles/amr.html' class='founder-sig'>Amr Eladly</a>",
    },
    footer_sig_ar: {
      type: String,
      required: true,
      trim: true,
      default:
        "2026 وكالة MSA. تم التصميم والهندسة بواسطة <a href='../profiles/amr.html' class='founder-sig'>م. عمرو العدلي</a>",
    },
    founder_title: {
      type: String,
      default: 'Founder & Chief Architect',
      trim: true,
    },
    globalAlert: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'settings',
  }
);

module.exports = mongoose.model('Settings', settingsSchema);