import mongoose from 'mongoose';

const VideoAnalyticsSchema = new mongoose.Schema({
    videoId: { type: String, required: true },
    courseId: { type: String, required: true },
    date: { type: Date, required: true },
    metrics: {
        totalViews: { type: Number, default: 0 },
        uniqueViews: { type: Number, default: 0 },
        totalWatchTime: { type: Number, default: 0 },
        averageWatchTime: { type: Number, default: 0 },
        completionRate: { type: Number, default: 0 },
        dropOffPoints: [Number],
        qualityDistribution: {
            auto: { type: Number, default: 0 },
            '720p': { type: Number, default: 0 },
            '1080p': { type: Number, default: 0 },
            '480p': { type: Number, default: 0 }
        },
        deviceStats: {
            desktop: { type: Number, default: 0 },
            mobile: { type: Number, default: 0 },
            tablet: { type: Number, default: 0 }
        },
        platformStats: {
            web: { type: Number, default: 0 },
            mobileApp: { type: Number, default: 0 }
        }
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const VideoAnalytics = mongoose.model('VideoAnalytics', VideoAnalyticsSchema);

export default VideoAnalytics;