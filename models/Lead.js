import mongoose, { Schema } from 'mongoose';

const leadSchema = new Schema({
    partnerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    status: {
        type: String,
        enum: ['new', 'contacted', 'followed_up', 'converted', 'lost'],
        default: 'new'
    },
    notes: [{
        content: { type: String, trim: true },
        createdAt: { type: Date, default: Date.now }
    }],
    followUpDate: { type: Date },
    category: { type: String, trim: true },
    isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

// Create indexes for efficient searching
leadSchema.index({ partnerId: 1, status: 1 });
leadSchema.index({ email: 1 });
leadSchema.index({ phone: 1 });

export default mongoose.model('Lead', leadSchema);
