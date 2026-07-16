import mongoose from 'mongoose';

const subServiceSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  desc: { type: String, trim: true },
  items: [{ type: String, trim: true }]
}, { _id: true });

const serviceCategorySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, unique: true, lowercase: true },
    badge: { type: String, trim: true },
    description: { type: String, trim: true },
    colorScheme: {
      type: String,
      enum: ['blue', 'rose', 'emerald', 'purple', 'orange', 'teal', 'indigo', 'yellow'],
      default: 'blue'
    },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    subServices: [subServiceSchema]
  },
  { timestamps: true }
);

export default mongoose.model('ServiceCategory', serviceCategorySchema);
