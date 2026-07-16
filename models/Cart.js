import mongoose, { Schema } from 'mongoose';

const cartItemSchema = new Schema({
    courseId: { type: Schema.Types.ObjectId, ref: 'Course' },
    courseBundleId: { type: Schema.Types.ObjectId, ref: 'CourseBundle' },
    type: { type: String, enum: ['course', 'courseBundle'], required: true },
    priceSnapshot: { type: mongoose.Types.Decimal128, required: true },
    currency: { type: String, required: true },
    discount: {
        code: { type: String },
        amount: { type: mongoose.Types.Decimal128, default: 0 }
    }
}, { _id: true });

// Custom validation to ensure either courseId or courseBundleId is provided, but not both
cartItemSchema.pre('validate', function(next) {
    if (!this.courseId && !this.courseBundleId) {
        return next(new Error('Either courseId or courseBundleId is required'));
    }
    if (this.courseId && this.courseBundleId) {
        return next(new Error('Only one of courseId or courseBundleId can be provided'));
    }
    // Set type based on which ID is provided
    this.type = this.courseId ? 'course' : 'courseBundle';
    next();
});

const cartSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    sessionId: { type: String },
    items: [cartItemSchema],
    couponCode: { type: String },
    subTotal: { type: mongoose.Types.Decimal128, default: 0 },
    discount: { type: mongoose.Types.Decimal128, default: 0 },
    tax: { type: mongoose.Types.Decimal128, default: 0 },
    grandTotal: { type: mongoose.Types.Decimal128, default: 0 },
    isCheckedOut: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model('Cart', cartSchema);