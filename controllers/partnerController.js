import UserService from "../service/userService.js";
import CourseEnrollment from "../models/CourseEnrollment.js";
import User from "../models/user.js";

const userService = new UserService();

// Helper to flatten partner object
const flattenPartner = (user) => {
    if (!user) return null;
    const userObj = user.toObject ? user.toObject() : user;
    return {
        ...userObj,
        referralCode: userObj.company?.referralCode || userObj.referralCode || "",
        referredByPartner: userObj.referredBy ? {
            _id: userObj.referredBy._id || userObj.referredBy,
            fullName: userObj.referredBy.fullName || "N/A",
            email: userObj.referredBy.email || "N/A",
            referralCode: userObj.referredBy.company?.referralCode || ""
        } : null
    };
};

export const getAllPartners = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search?.trim();
        const filter = { role: 'partner' };

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
        if (req.query.referralCode) {
            // Check both root and nested just in case
            filter.$or = [
                { referralCode: { $regex: req.query.referralCode, $options: 'i' } },
                { 'company.referralCode': { $regex: req.query.referralCode, $options: 'i' } }
            ];
        }

        // 🔍 General search
        if (search) {
            filter.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
                { referralCode: { $regex: search, $options: 'i' } },
                { 'company.referralCode': { $regex: search, $options: 'i' } }
            ];
        }

        const sort = { createdAt: -1 };

        const { users, total } = await userService.getAllUsers(page, limit, filter, sort);

        // Populate referredBy for each partner
        const partnerIds = users.map(u => u._id);
        const populatedUsers = await User.find({ _id: { $in: partnerIds } })
            .populate('referredBy', 'fullName email company.referralCode')
            .sort(sort)
            .lean();

        // Flatten referralCode and referredBy for frontend
        const partners = populatedUsers.map(u => flattenPartner(u));

        return res.status(200).json({
            success: true,
            message: "✅ Partners fetched successfully",
            data: {
                partners: partners,
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
        console.error("❌ Error in getAllPartners:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch partners",
            data: {},
            err: error.message
        });
    }
};

export const getPartnerById = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id)
            .populate('referredBy', 'fullName email company.referralCode')
            .lean();

        if (!user || user.role !== 'partner') {
            return res.status(404).json({
                success: false,
                message: 'Partner not found',
                data: {},
                err: {}
            });
        }

        const partner = flattenPartner(user);

        return res.status(200).json({
            success: true,
            message: '✅ Partner fetched successfully',
            data: { partner: partner },
            err: {}
        });
    } catch (error) {
        console.error("❌ Error in getPartnerById:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch partner",
            data: {},
            err: error.message
        });
    }
};

export const updatePartner = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // If referralCode is present, move it to company.referralCode
        if (updateData.referralCode) {
            if (!updateData.company) updateData.company = {};
            updateData.company.referralCode = updateData.referralCode;
            delete updateData.referralCode;
        }

        // Handle other company fields if needed, merge with existing company data
        if (updateData.company) {
            // We need to be careful not to overwrite existing company data if we just set company object
            // But userService.updateUserById usually does a $set.
            // If we pass { company: { referralCode: '...' } }, Mongoose might overwrite the whole company object if not using dot notation or merge.
            // Better to use dot notation for nested updates if we want partial update.
            // But let's see how updateUserById handles it. It calls findByIdAndUpdate.
            // We should probably flatten the update data for nested fields if we want partial updates.
            // Or rely on the fact that we might be sending the whole object? No, likely partial.

            // Simplest approach: Use dot notation for nested fields
            const flatUpdate = { ...updateData };
            if (updateData.company) {
                for (const key in updateData.company) {
                    flatUpdate[`company.${key}`] = updateData.company[key];
                }
                delete flatUpdate.company;
            }

            // However, `referralCode` is the only thing we are concerned about right now.
            // Let's rely on standard update for now, or use `userService.updateUserById` which expects a standard object.
            // `userService.updateUserById` calls `User.findByIdAndUpdate(id, updateData, { new: true })`.
            // If we pass `company: { referralCode: '...' }`, it WILL overwrite other company fields if they exist and are not in the update.
            // We should fetch the user first and merge, OR use dot notation.

            // Let's use dot notation to be safe.
            // Actually, let's just use `referralCode` from body and map it to `company.referralCode`.
        }

        // Prepare update object safely
        const finalUpdate = {};
        if (updateData.fullName) finalUpdate.fullName = updateData.fullName;
        if (updateData.email) finalUpdate.email = updateData.email;
        if (updateData.referralCode) finalUpdate['company.referralCode'] = updateData.referralCode;
        if (updateData.company && updateData.company.referralCode) finalUpdate['company.referralCode'] = updateData.company.referralCode;
        if (updateData.partnerInfo) finalUpdate.partnerInfo = updateData.partnerInfo;
        if (typeof updateData.isActive !== 'undefined') finalUpdate.isActive = updateData.isActive;
        if (updateData.status) finalUpdate.status = updateData.status;


        const updatedUser = await userService.updateUserById(id, finalUpdate);

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'Partner not found',
                data: {},
                err: {}
            });
        }

        const partner = flattenPartner(updatedUser);

        return res.status(200).json({
            success: true,
            message: '✅ Partner updated successfully',
            data: { partner: partner },
            err: {}
        });

    } catch (error) {
        console.error("❌ Error in updatePartner:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update partner",
            data: {},
            err: error.message
        });
    }
};

// ✅ Get all students referred by the logged-in partner (with their course purchases)
export const getPartnerStudents = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'partner') {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Partner role required',
                data: {},
                err: {}
            });
        }

        const partnerId = req.user._id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';

        // Build filter
        const filter = { referredBy: partnerId, role: 'student' };
        if (search) {
            filter.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }

        // Find students referred by this partner
        const [students, total] = await Promise.all([
            User.find(filter)
                .select('fullName email phone profilePicture createdAt company referredBy status')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            User.countDocuments(filter)
        ]);

        if (students.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No referred students found",
                data: {
                    students: [],
                    pagination: { total: 0, page, limit, totalPages: 0 }
                },
                err: {}
            });
        }

        // Fetch course enrollments for all these students
        const studentIds = students.map(s => s._id);
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

        // Merge enrollments into student objects
        const studentsWithCourses = students.map(s => ({
            ...s,
            referralCode: s.company?.referralCode || '',
            enrollments: enrollmentMap[s._id.toString()] || []
        }));

        // Get partner's own referral code for display
        const partner = await User.findById(partnerId).select('company fullName').lean();

        return res.status(200).json({
            success: true,
            message: "✅ Partner students fetched successfully",
            data: {
                partnerReferralCode: partner?.company?.referralCode || '',
                partnerName: partner?.fullName || '',
                students: studentsWithCourses,
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
        console.error("❌ Error in getPartnerStudents:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch partner students",
            data: {},
            err: error.message
        });
    }
};
