import Order from '../models/Order.js';
import Course from '../models/Course.js';
import CourseBundle from '../models/CourseBundle.js';
import User from '../models/user.js';
import CourseEnrollment from '../models/CourseEnrollment.js';

class SalesAnalyticsService {
  // Total sales per course
  async getCourseSales() {
    // --- Aggregate paid orders ---
    const orderPipeline = [
      { $unwind: '$items' },
      { $match: { 'items.type': 'course' } },
      { $group: {
        _id: '$items.courseId',
        totalSales: { $sum: '$items.pricePaid' },
        orderCount: { $sum: 1 }
      }},
      { $lookup: {
        from: 'courses',
        localField: '_id',
        foreignField: '_id',
        as: 'course'
      }},
      { $unwind: '$course' },
      { $project: {
        courseId: '$_id',
        title: '$course.title',
        totalSales: { $toDouble: '$totalSales' },
        orderCount: 1
      }}
    ];
    const orderResults = await Order.aggregate(orderPipeline);

    // --- Aggregate admin enrollments with addToRevenue ---
    const adminEnrollments = await CourseEnrollment.aggregate([
      { $match: { enrollmentSource: 'admin', addToRevenue: true, pricePaid: { $gt: 0 } } },
      { $group: { _id: '$courseId', totalSales: { $sum: '$pricePaid' }, orderCount: { $sum: 1 } } }
    ]);
    // Attach course titles to admin enrollments
    if (adminEnrollments.length > 0) {
      const courseIds = adminEnrollments.map(e => e._id);
      const courses = await Course.find({ _id: { $in: courseIds } }).select('_id title').lean();
      adminEnrollments.forEach(e => {
        const course = courses.find(c => c._id.toString() === e._id.toString());
        e.courseId = e._id;
        e.title = course ? course.title : '';
        e.totalSales = Number(e.totalSales || 0);
      });
    }

    // --- Merge results ---
    const merged = {};
    orderResults.forEach(r => {
      merged[r.courseId.toString()] = { ...r };
    });
    adminEnrollments.forEach(e => {
      const key = e.courseId.toString();
      if (merged[key]) {
        merged[key].totalSales += Number(e.totalSales || 0);
        merged[key].orderCount += Number(e.orderCount || 0);
      } else {
        merged[key] = {
          courseId: e.courseId,
          title: e.title,
          totalSales: Number(e.totalSales || 0),
          orderCount: Number(e.orderCount || 0)
        };
      }
    });

    return Object.values(merged);
  }

  // Total sales per user
  async getUserSales() {
    const pipeline = [
      { $group: {
        _id: '$userId',
        totalSpent: { $sum: '$grandTotal' },
        orderCount: { $sum: 1 }
      }},
      { $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }},
      { $unwind: '$user' },
      { $project: {
        userId: '$_id',
        name: '$user.fullName',
        email: '$user.email',
        totalSpent: { $toDouble: '$totalSpent' },
        orderCount: 1
      }}
    ];
    return await Order.aggregate(pipeline);
  }

  // Sales summary
  async getSalesSummary() {
    const orders = await Order.find({});
    // Convert grandTotal to number if Decimal128
    const totalRevenue = orders.reduce((sum, o) => {
      if (o.grandTotal && typeof o.grandTotal === 'object' && o.grandTotal.$numberDecimal) {
        return sum + parseFloat(o.grandTotal.$numberDecimal);
      }
      return sum + (o.grandTotal || 0);
    }, 0);
    const totalOrders = orders.length;
    const totalUsers = new Set(orders.map(o => o.userId.toString())).size;
    return { totalRevenue, totalOrders, totalUsers };
  }

  // Sales per bundle
  async getBundleSales() {
    const pipeline = [
      { $unwind: '$items' },
      { $match: { 'items.type': 'courseBundle' } },
      { $group: {
        _id: '$items.courseBundleId',
        totalSales: { $sum: '$items.pricePaid' },
        orderCount: { $sum: 1 }
      }},
      { $lookup: {
        from: 'coursebundles',
        localField: '_id',
        foreignField: '_id',
        as: 'bundle'
      }},
      { $unwind: '$bundle' },
      { $project: {
        bundleId: '$_id',
        title: '$bundle.title',
        totalSales: { $toDouble: '$totalSales' },
        orderCount: 1
      }}
    ];
    return await Order.aggregate(pipeline);
  }
}

export default new SalesAnalyticsService();
