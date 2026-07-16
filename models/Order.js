import mongoose, { Schema } from 'mongoose';

const orderSchema = new Schema({
    orderNo: { type: String, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: [{
        courseId: { type: Schema.Types.ObjectId, ref: 'Course' },
        courseBundleId: { type: Schema.Types.ObjectId, ref: 'CourseBundle' },
        coursePlanId: { type: Schema.Types.ObjectId, ref: 'CoursePlan' },
        ebookId: { type: Schema.Types.ObjectId, ref: 'Ebook' }, // Added ebook support
        type: { type: String, enum: ['course', 'courseBundle', 'coursePlan', 'ebook', 'partnerRegistration', 'subscription'], required: true },
        pricePaid: { type: mongoose.Types.Decimal128, required: true },
        currency: { type: String, required: true }
    }],
    subTotal: { type: mongoose.Types.Decimal128, required: true },
    discount: { type: mongoose.Types.Decimal128, default: 0 },
    tax: { type: mongoose.Types.Decimal128, default: 0 },
    gstRate: { type: mongoose.Types.Decimal128, default: 0 },
    grandTotal: { type: mongoose.Types.Decimal128, required: true },
    // ✅ GST/company info for order
    company: {
        name: { type: String, trim: true },
        gstNumber: { type: String, default: null }
    },
    payment: {
        provider: { type: String, enum: ['stripe', 'razorpay', 'cashfree', 'paypal', 'free', 'manual'], required: true },
        paymentIntent: { type: String, default: null }, // Store payment intent or transaction ID
        status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' }
    },
    meta: { type: Schema.Types.Mixed },
    isRefunded: { type: Boolean, default: false },
    invoice_url: { type: String }, // PDF invoice file name only
    // Partner referral tracking
    referredByPartner: {
        partnerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        referralCode: { type: String, trim: true, default: null },
        partnerName: { type: String, trim: true, default: null },
        partnerEmail: { type: String, trim: true, default: null }
    }
}, { timestamps: true });

export default mongoose.model('Order', orderSchema);