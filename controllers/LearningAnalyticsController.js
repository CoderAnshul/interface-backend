import CourseEnrollment from '../models/CourseEnrollment.js';
import LessonProgress from '../models/LessonProgress.js';
import Course from '../models/Course.js';
import User from '../models/user.js';
import mongoose from 'mongoose';

class LearningAnalyticsController {
    /**
     * Get platform-wide learning statistics
     */
    async getOverviewStats(req, res) {
        try {
            const totalEnrollments = await CourseEnrollment.countDocuments({ status: 'active' });
            const totalCourses = await Course.countDocuments({ isDeleted: false, isPublished: true });
            
            // Active students (enrolled in at least one active course)
            const activeStudents = await CourseEnrollment.distinct('userId', { status: 'active' });
            
            // Calculate platform-wide average completion percentage
            const avgCompletionResult = await CourseEnrollment.aggregate([
                { $match: { status: 'active' } },
                { $group: { _id: null, avgProgress: { $avg: "$progressPercentage" } } }
            ]);

            res.json({
                success: true,
                data: {
                    totalEnrollments,
                    totalCourses,
                    activeStudentsCount: activeStudents.length,
                    averageCompletionRate: avgCompletionResult[0]?.avgProgress || 0
                }
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Get most popular courses based on enrollment count
     */
    async getPopularCourses(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 5;
            const popularCourses = await CourseEnrollment.aggregate([
                { $match: { type: 'course', courseId: { $ne: null } } },
                { $group: { _id: "$courseId", enrollmentCount: { $sum: 1 } } },
                { $sort: { enrollmentCount: -1 } },
                { $limit: limit },
                {
                    $lookup: {
                        from: 'courses',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'courseDetails'
                    }
                },
                { $unwind: "$courseDetails" },
                {
                    $project: {
                        title: "$courseDetails.title",
                        enrollmentCount: 1
                    }
                }
            ]);

            res.json({ success: true, data: popularCourses });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Get completion rates per course
     */
    async getCourseCompletionRates(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 10;
            const completionRates = await CourseEnrollment.aggregate([
                { $match: { type: 'course', courseId: { $ne: null } } },
                { 
                    $group: { 
                        _id: "$courseId", 
                        avgProgress: { $avg: "$progressPercentage" },
                        studentCount: { $sum: 1 }
                    } 
                },
                { $sort: { avgProgress: -1 } },
                { $limit: limit },
                {
                    $lookup: {
                        from: 'courses',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'courseDetails'
                    }
                },
                { $unwind: "$courseDetails" },
                {
                    $project: {
                        title: "$courseDetails.title",
                        avgProgress: 1,
                        studentCount: 1
                    }
                }
            ]);

            res.json({ success: true, data: completionRates });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Get detailed student progress (paginated)
     */
    async getStudentProgress(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;
            const search = req.query.search || '';

            let query = { status: 'active' };
            
            // If searching by user name, we need to find user IDs first
            if (search) {
                const users = await User.find({ 
                    $or: [
                        { fullName: { $regex: search, $options: 'i' } },
                        { email: { $regex: search, $options: 'i' } }
                    ]
                }).select('_id');
                const userIds = users.map(u => u._id);
                query.userId = { $in: userIds };
            }

            const total = await CourseEnrollment.countDocuments(query);
            const progressData = await CourseEnrollment.find(query)
                .populate('userId', 'fullName email profilePicture')
                .populate('courseId', 'title')
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            res.json({
                success: true,
                data: progressData,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

export default new LearningAnalyticsController();
