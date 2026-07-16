import mongoose, { Schema } from 'mongoose';

const partnerPayoutSchema = new Schema({
    partnerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: mongoose.Types.Decimal128, required: true },
    status: {
        type: String,
        enum: ['pending', 'completed', 'rejected'],
        default: 'pending'
    },
    bankDetails: {
        bankName: { type: String, trim: true },
        accountNumber: { type: String, trim: true },
        ifscCode: { type: String, trim: true },
        accountHolderName: { type: String, trim: true }
    },
    transactionId: { type: String, trim: true },
    paidAt: { type: Date },
    adminNotes: { type: String, trim: true },
    notes: { type: String, trim: true }
}, { timestamps: true });

export default mongoose.model('PartnerPayout', partnerPayoutSchema);
