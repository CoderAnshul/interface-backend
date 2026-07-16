import mongoose from 'mongoose';

const PageBannerSchema = new mongoose.Schema({
  pageKey: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true
  },
  badge: {
    text: { type: String, trim: true },
    iconName: { type: String, trim: true }
  },
  title: {
    main: { type: String, required: true, trim: true },
    accent: { type: String, trim: true },
    sub: { type: String, trim: true }
  },
  description: {
    type: String,
    trim: true
  },
  primaryCTA: {
    text: { type: String, trim: true },
    link: { type: String, trim: true }
  },
  secondaryCTA: {
    text: { type: String, trim: true },
    link: { type: String, trim: true }
  },
  image: {
    src: { type: String, required: true },
    alt: { type: String, trim: true }
  },
  tags: {
    top: { type: String, trim: true },
    bottom: { type: String, trim: true }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const PageBanner = mongoose.model('PageBanner', PageBannerSchema);
export default PageBanner;
