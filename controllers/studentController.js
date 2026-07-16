import UserService from "../service/userService.js";
import ProjectAnalyticsService from "../service/ProjectAnalyticsService.js";
import CourseEnrollment from "../models/CourseEnrollment.js";
import User from "../models/user.js";

const userService = new UserService();

export const getAllStudents = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search?.trim();
    const filter = { role: 'student' };

    // Partner can only see their own referred students.
    if (req.user?.role === 'partner') {
      filter.referredBy = req.user._id;
    }

    // ✅ Parse filters from query (JSON string)
    if (req.query.filters) {
      const parsedFilters = JSON.parse(req.query.filters);

      if (typeof parsedFilters.isActive !== "undefined") {
        filter.isActive =
          parsedFilters.isActive === "true" || parsedFilters.isActive === true;
      }

      if (parsedFilters.status) {
        filter.status = parsedFilters.status;
      }

      if (parsedFilters.referredOnly === "true" || parsedFilters.referredOnly === true) {
        filter.referredBy = { $ne: null };
      }
    }

    // 🔍 Field-based searches
    if (req.query.fullName) {
      filter.fullName = { $regex: req.query.fullName, $options: 'i' };
    }
    if (req.query.email) {
      filter.email = { $regex: req.query.email, $options: 'i' };
    }
    if (req.query.phone) {
      filter.phone = { $regex: req.query.phone, $options: 'i' };
    }

    // 🔍 General search
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const sort = { createdAt: -1 };

    const { users, total } = await userService.getAllUsers(page, limit, filter, sort);

    // Populate referredBy partner info and course enrollments for each student
    const studentIds = users.map(u => u._id);

    // Fetch all enrollments for these students in one query
    const enrollments = await CourseEnrollment.find({ userId: { $in: studentIds } })
      .populate('courseId', 'title thumbnail price')
      .lean();

    // Group enrollments by userId
    const enrollmentMap = {};
    for (const enrollment of enrollments) {
      const uid = enrollment.userId.toString();
      if (!enrollmentMap[uid]) enrollmentMap[uid] = [];
      enrollmentMap[uid].push({
        courseId: enrollment.courseId?._id,
        courseName: enrollment.courseId?.title || 'N/A',
        courseThumbnail: enrollment.courseId?.thumbnail || null,
        pricePaid: enrollment.pricePaid || 0,
        enrolledAt: enrollment.enrolledAt || enrollment.createdAt,
        status: enrollment.status,
        accessExpiry: enrollment.accessExpiry || null,
      });
    }

    // Populate referredBy partner details
    const partnerIds = [...new Set(
      users.map(u => u.referredBy?.toString()).filter(Boolean)
    )];
    let partnerMap = {};
    if (partnerIds.length > 0) {
      const partners = await User.find(
        { _id: { $in: partnerIds } },
        { fullName: 1, email: 1, 'company.referralCode': 1 }
      ).lean();
      for (const p of partners) {
        partnerMap[p._id.toString()] = {
          _id: p._id,
          fullName: p.fullName,
          email: p.email,
          referralCode: p.company?.referralCode || ''
        };
      }
    }

    // Merge data into student objects
    const students = users.map(u => {
      const userObj = u.toObject ? u.toObject() : u;
      const uid = userObj._id.toString();
      return {
        ...userObj,
        referredByPartner: userObj.referredBy ? (partnerMap[userObj.referredBy.toString()] || null) : null,
        enrollments: enrollmentMap[uid] || []
      };
    });

    return res.status(200).json({
      success: true,
      message: "✅ Students fetched successfully",
      data: {
        students,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      },
      err: {}
    });
  } catch (error) {
    console.error("❌ Error in getAllStudents:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch students",
      data: {},
      err: error.message
    });
  }
};





export const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await userService.getUserById(id);

    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
        data: {},
        err: {}
      });
    }

    // Fetch enrollments from CourseEnrollment collection
    const enrollments = await CourseEnrollment.find({ userId: student._id })
      .populate('courseId') // <-- Correct field name
      .lean();

    // Map enrollments to include accessExpiry and enrolledAt, and rename courseId to course
    const mappedEnrollments = enrollments.map(enrollment => ({
      ...enrollment,
      course: enrollment.courseId, // expose as 'course'
      accessExpiry: enrollment.accessExpiry,
      enrolledAt: enrollment.enrolledAt || enrollment.createdAt,
    }));

    // Attach mapped enrollments to student object
    const studentObj = student.toObject ? student.toObject() : student;
    studentObj.enrollments = mappedEnrollments;

    // Attach latest personality test result
    let personality = null;
    try {
      const PersonalitySubmission = (await import('../models/PersonalitySubmission.js')).default;
      personality = await PersonalitySubmission.findOne({ userId: student._id }).sort({ createdAt: -1 }).lean();
    } catch (e) {
      console.error('Error fetching personality submission:', e);
    }
    studentObj.personality = personality ? {
      resultType: personality.resultType,
      scores: personality.scores,
      createdAt: personality.createdAt
    } : null;

    return res.status(200).json({
      success: true,
      message: '✅ Student fetched successfully',
      data: { student: studentObj },
      err: {}
    });
  } catch (error) {
    console.error("❌ Error in getStudentById:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch student",
      data: {},
      err: error.message
    });
  }
};

export const getStudentAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const analytics = await ProjectAnalyticsService.getStudentAnalytics(id);
    if (analytics.error) {
      return res.status(404).json({
        success: false,
        message: analytics.error,
        data: {},
        err: {}
      });
    }
    return res.status(200).json({
      success: true,
      message: "✅ Student analytics fetched successfully",
      data: analytics,
      err: {}
    });
  } catch (error) {
    console.error("❌ Error in getStudentAnalytics:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch student analytics",
      data: {},
      err: error.message
    });
  }
};
