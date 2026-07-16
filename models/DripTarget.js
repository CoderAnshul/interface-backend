import mongoose from 'mongoose';

const dripTargetSchema = new mongoose.Schema({
    dripRuleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DripRule',
        required: true
    },

    targetType: {
        type: String,
        enum: ['lesson', 'module', 'course'], // added 'course' for extensibility
        required: true
    },

    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'targetType'
    }

}, { timestamps: true });

export default mongoose.models.DripTarget || mongoose.model('DripTarget', dripTargetSchema);
