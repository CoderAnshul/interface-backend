import User from "../models/user.js";
import Course from "../models/Course.js";
import SupportTicket from "../models/SupportTicket.js";
import ForumThread from "../models/ForumThread.js";
import CourseEnrollment from "../models/CourseEnrollment.js";
import Order from "../models/Order.js";
import CrudRepository from "./crudRepository.js";
import Certificate from "../models/Certificate.js";
import mongoose from "mongoose";

class UserRepository extends CrudRepository {
  constructor() {
    super(User);
    this.CourseEnrollment = CourseEnrollment;
    this.Certificate = Certificate;
    // Register Enrollment model if not already registered
    if (!mongoose.models.Enrollment) {
      mongoose.model('Enrollment', CourseEnrollment.schema);
    }
  }

  // Find a user by data and aggregate enrolled courses using $lookup
  async findBy(data) {
    try {
      // Find the user first
      const user = await User.findOne(data).lean();
      if (!user) return null;

      // Use the registered Enrollment model for aggregation
      const enrollments = await this.CourseEnrollment.aggregate([
        { $match: { userId: user._id } },
        {
          $lookup: {
            from: 'courses',
            localField: 'courseId',
            foreignField: '_id',
            as: 'course'
          }
        },
        {
          $lookup: {
            from: 'coursebundles',
            localField: 'CourseBundleId',
            foreignField: '_id',
            as: 'courseBundle'
          }
        },
        {
          $project: {
            _id: 1,
            course: { $arrayElemAt: ['$course', 0] },
            courseBundle: { $arrayElemAt: ['$courseBundle', 0] },
            orderId: 1,
            accessStart: 1,
            accessEnd: 1,
            isActive: 1,
            createdAt: 1,
            updatedAt: 1
          }
        }
      ]);

      return { ...user, enrollments };
    } catch (error) {
      throw error;
    }
  }


  async deleteEducationFromArray(userId, educationId) {
    try {
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          $pull: { 
            education: { _id: educationId } 
          }
        },
        { 
          new: true,
          runValidators: true 
        }
      );
      return updatedUser;
    } catch (error) {
      console.error("❌ Repository delete education error:", error);
      throw error;
    }
  }

  async updateById(id, updateData) {
    try {
      //console.log("🔄 Updating user by ID:", id);
      //console.log("🧪 [DEBUG] Update Data:", updateData);
      const updatedUser = await User.findByIdAndUpdate(id, updateData, { new: true });
      return updatedUser;
    } catch (error) {
      throw error;
    }
  }

  async findById(id) {
    try {
      const user = await this.model.findById(id);
      return user;
    } catch (error) {
      throw error;
    }
  }

  async findMany(filter = {}, sort = {}, skip = 0, limit = 10) {
    try {
      const result = await this.model
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();
      return result;
    } catch (error) {
      console.error("❌ Error in findMany:", error);
      throw new Error("Failed to fetch data from database");
    }
  }

  async count(filter = {}) {
    try {
      return await this.model.countDocuments(filter);
    } catch (error) {
      console.error("❌ Error in count:", error);
      throw error;
    }
  }

  async deleteDocumentFromArray(userId, documentId) {
    try {
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          $pull: { 
            documentation: { _id: documentId } 
          }
        },
        { 
          new: true,
          runValidators: true 
        }
      );
      return updatedUser;
    } catch (error) {
      console.error("❌ Repository delete document error:", error);
      throw error;
    }
  }

  async getActiveCoursesByUserId(userId, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      const enrollments = await this.CourseEnrollment.find({ 
        userId, 
        status: 'active' 
      })
        .skip(skip)
        .limit(limit)
        .lean();
      
      const populatedCourses = await Promise.all(enrollments.map(async (enrollment) => {
        if (enrollment.courseId && enrollment.type === 'course') {
          const course = await this.model.db.models.Course.findById(enrollment.courseId)
            .select('title thumbnail description slug level duration price currency tags prerequisites learningOutcomes')
            .lean();
          return { 
            type: 'course', 
            enrolledAt: enrollment.enrolledAt, 
            accessType: enrollment.accessType, 
            status: enrollment.status, 
            course 
          };
        }
        return {
          type: enrollment.type,
          enrolledAt: enrollment.enrolledAt,
          accessType: enrollment.accessType,
          status: enrollment.status
        };
      }));

      return populatedCourses;
    } catch (error) {
      throw new Error(`Error fetching active courses: ${error.message}`);
    }
  }

  async countAllCoursesByUserId(userId) {
    try {
      return await this.CourseEnrollment.countDocuments({ userId });
    } catch (error) {
      throw new Error(`Error counting all courses: ${error.message}`);
    }
  }

  async countActiveCoursesByUserId(userId) {
    try {
      return await this.CourseEnrollment.countDocuments({ userId, status: 'active' });
    } catch (error) {
      throw new Error(`Error counting active courses: ${error.message}`);
    }
  }

  async countCertificatesByUserId(userId) {
    try {
      if (!this.Certificate) {
        throw new Error('Certificate model is not defined');
      }
      return await this.Certificate.countDocuments({ user_id: userId, status: 'issued' });
    } catch (error) {
      throw new Error(`Error counting certificates: ${error.message}`);
    }
  }

  async getOverviewDashboard(partnerId = null) {
    try {
      //console.log("🗄️ Fetching overview dashboard data from database");

      // Define date ranges for sales counts (using IST timezone)
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      // Parallel queries for counts
      // Build optional partner filters
      const supportTicketFilter = { isDeleted: false };
      const studentFilter = { role: 'student', isActive: true };
      const orderMatchBase = { 'payment.status': 'paid', isRefunded: false };

      if (partnerId) {
        supportTicketFilter.referredById = partnerId;
        studentFilter.referredBy = partnerId;
      }

      // If partnerId provided, compute forum and sales counts scoped to that partner
      let totalCoursesPromise = Course.countDocuments({ isDeleted: false, isPublished: true });
      let totalSupportTicketsPromise = SupportTicket.countDocuments(supportTicketFilter);
      let totalStudentsPromise = this.count(studentFilter);

      // Sales: compute from Orders when partnerId is provided, otherwise fallback to CourseEnrollment counts
      let todaySalesPromise;
      let thisMonthSalesPromise;
      let thisYearSalesPromise;
      let paidSalesCountPromise;
      let platformIncomePromise = Order.aggregate([
        { $match: partnerId ? { ...orderMatchBase, 'referredByPartner.partnerId': partnerId } : orderMatchBase },
        { $group: { _id: null, total: { $sum: '$grandTotal' } } },
        { $project: { _id: 0, total: { $toDouble: '$total' } } }
      ]).then(result => result[0]?.total || 0);

      if (partnerId) {
        const baseMatch = { 'payment.status': 'paid', isRefunded: false, 'referredByPartner.partnerId': partnerId };
        todaySalesPromise = Order.countDocuments({ ...baseMatch, createdAt: { $gte: startOfDay } });
        thisMonthSalesPromise = Order.countDocuments({ ...baseMatch, createdAt: { $gte: startOfMonth } });
        thisYearSalesPromise = Order.countDocuments({ ...baseMatch, createdAt: { $gte: startOfYear } });
        paidSalesCountPromise = Order.countDocuments(baseMatch);
      } else {
        todaySalesPromise = this.CourseEnrollment.countDocuments({
          enrolledAt: { $gte: startOfDay },
          status: 'active',
          enrollmentSource: 'purchase'
        });
        thisMonthSalesPromise = this.CourseEnrollment.countDocuments({
          enrolledAt: { $gte: startOfMonth },
          status: 'active',
          enrollmentSource: 'purchase'
        });
        thisYearSalesPromise = this.CourseEnrollment.countDocuments({
          enrolledAt: { $gte: startOfYear },
          status: 'active',
          enrollmentSource: 'purchase'
        });
        paidSalesCountPromise = this.CourseEnrollment.countDocuments({ status: 'active', enrollmentSource: 'purchase' });
      }

      const [
        totalCourses,
        totalSupportTickets,
        totalStudents,
        todaySales,
        thisMonthSales,
        thisYearSales,
        paidSalesCount,
        platformIncome
      ] = await Promise.all([
        totalCoursesPromise,
        totalSupportTicketsPromise,
        totalStudentsPromise,
        todaySalesPromise,
        thisMonthSalesPromise,
        thisYearSalesPromise,
        paidSalesCountPromise,
        platformIncomePromise
      ]);
      // --- Add revenue and sales count from admin enrollments ---
      const adminEnrollmentsAgg = await this.CourseEnrollment.aggregate([
        { $match: { enrollmentSource: 'admin', addToRevenue: true, pricePaid: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$pricePaid' }, count: { $sum: 1 } } }
      ]);
      const adminRevenue = Number(adminEnrollmentsAgg[0]?.total || 0);
      const adminSalesCount = Number(adminEnrollmentsAgg[0]?.count || 0);

      // Parallel queries for latest records
      const latestSupportTicketFilter = { isDeleted: false };
      if (partnerId) latestSupportTicketFilter.referredById = partnerId;

      // For forum threads, when partnerId is provided, only include threads by users referred by this partner
      let latestForumThreadsPromise;
      let totalForumThreads;
      if (partnerId) {
        const referredUsers = await User.find({ referredBy: partnerId }).select('_id').lean();
        const referredIds = referredUsers.map(u => u._id);
        totalForumThreads = await ForumThread.countDocuments({ createdBy: { $in: referredIds } });
        latestForumThreadsPromise = ForumThread
          .find({ createdBy: { $in: referredIds } })
          .sort({ createdAt: -1 })
          .limit(5)
          .select('title content createdAt')
          .populate('createdBy', 'fullName')
          .populate('courseId', 'title')
          .lean();
      } else {
        totalForumThreads = await ForumThread.countDocuments();
        latestForumThreadsPromise = ForumThread
          .find()
          .sort({ createdAt: -1 })
          .limit(5)
          .select('title content createdAt')
          .populate('createdBy', 'fullName')
          .populate('courseId', 'title')
          .lean();
      }

      const [latestCourses, latestSupportTickets, latestForumThreads] = await Promise.all([
        Course
          .find({ isDeleted: false, isPublished: true })
          .sort({ createdAt: -1 })
          .limit(5)
          .select('title slug thumbnail createdAt')
          .lean(),
        SupportTicket
          .find(latestSupportTicketFilter)
          .sort({ createdAt: -1 })
          .limit(5)
          .select('subject category status createdAt')
          .populate('userId', 'fullName email')
          .lean(),
        latestForumThreadsPromise
      ]);

      // --- Learning Analytics Data ---
      const activeStudentsCount = await this.CourseEnrollment.distinct('userId', { status: 'active' }).then(users => users.length);
      
      const completionRates = await this.CourseEnrollment.aggregate([
        { $match: { progressPercentage: { $exists: true } } },
        { $group: { _id: null, avgRate: { $avg: '$progressPercentage' } } }
      ]);
      const averageCompletionRate = completionRates[0]?.avgRate || 0;

      const popularCourses = await Course.find({ isPublished: true, isDeleted: false })
        .sort({ enrolledStudentsCount: -1 })
        .limit(5)
        .select('title enrolledStudentsCount slug thumbnail')
        .lean();

      return {
        totalCourses,
        totalSupportTickets,
        totalStudents,
        totalForumThreads,
        todaySales,
        thisMonthSales,
        thisYearSales,
        totalSales: paidSalesCount + adminSalesCount, // <-- include admin sales count
        platformIncome: (platformIncome || 0) + adminRevenue, // <-- include admin revenue
        activeStudentsCount,
        averageCompletionRate,
        popularCourses,
        latestCourses,
        latestSupportTickets,
        latestForumThreads
      };
    } catch (error) {
      console.error("❌ Overview dashboard repository error:", error);
      throw new Error(`Failed to fetch overview dashboard data: ${error.message}`);
    }
  }
}

export default UserRepository;