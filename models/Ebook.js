import mongoose from "mongoose";

const { Schema } = mongoose;

const ebookSchema = new Schema({
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, trim: true },
    thumbnail: { type: String, trim: true },
    previewFile: { type: String, trim: true }, // URL or path to preview (e.g., first few pages)
    fullFile: { type: String, trim: true },    // URL or path to full ebook
    price: {
        type: mongoose.Types.Decimal128,
        default: 0,
        set: function (value) {
            if (value === '' || value === null || value === undefined) return 0;
            return value;
        }
    },
    salePrice: {
        type: mongoose.Types.Decimal128,
        default: 0,
        set: function (value) {
            if (value === '' || value === null || value === undefined) return 0;
            return value;
        }
    },
    currency: { type: String, default: 'INR' },
    isFree: { type: Boolean, default: false },
    categoryId: { type: Schema.Types.ObjectId, ref: 'CourseCategory' },
    subCategoryId: { type: Schema.Types.ObjectId, ref: 'SubCategory' },
    author: { type: String, trim: true },
    isPublished: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    salesCount: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },

    // New fields for detailed view
    pageCount: { type: Number },
    language: { type: String, default: 'English', trim: true },
    format: { type: String, default: 'PDF', trim: true },
    chapters: [{ type: String, trim: true }],
    whatYouLearn: [{ type: String, trim: true }],
    requirements: [{ type: String, trim: true }],
    authorBio: { type: String, trim: true },
    authorImage: { type: String, trim: true }, // URL or path
}, { timestamps: true });


ebookSchema.index({ categoryId: 1 });
ebookSchema.index({ isPublished: 1, isDeleted: 1 });

const Ebook = mongoose.models.Ebook || mongoose.model('Ebook', ebookSchema);

export default Ebook;
