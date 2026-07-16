import Order from '../models/Order.js';
import CourseEnrollment from '../models/CourseEnrollment.js';
import Course from '../models/Course.js';
import CourseBundle from '../models/CourseBundle.js';
import CourseChatRoom from '../models/CourseChatRoom.js';
import Setting from '../models/setting.js';
import emailService from '../utils/emailService.js';
import mongoose from 'mongoose';
import { generateOrderNumber } from '../utils/generateOrderNo.js';

// Helper to safely find CoursePlan with fallback support (reused from checkoutController)
const safeFindCoursePlan = async (CoursePlan, planId, courseId = null) => {
    const findId = (planId && typeof planId === 'object' && planId.toString) ? planId.toString() : planId;
    if (typeof findId === 'string' && findId.startsWith('fallback-')) {
        return { _id: findId, courseId: courseId || findId.replace('fallback-', ''), status: 'active' };
    }
    if (!mongoose.Types.ObjectId.isValid(findId)) return null;
    const query = CoursePlan.findById(findId);
    return await query;
};

export const getOrders = async (req, res) => {
    try {
        const { status, provider, type, page = 1, limit = 100 } = req.query;
        const query = {};
        if (status) query['payment.status'] = status;
        if (provider) query['payment.provider'] = provider;
        if (type) query['items.type'] = type;

        const orders = await Order.find(query)
            .populate('userId', 'fullName email phone status')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const count = await Order.countDocuments(query);

        return res.status(200).json({
            orders,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            totalOrders: count
        });
    } catch (error) {
        console.error("Get Orders Error:", error);
        return res.status(500).json({ message: "Failed to fetch orders", error: error.message });
    }
};


export const approveManualOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId).populate('userId');

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        if (order.payment.status === 'paid') {
            // Check if this is a partner registration that still needs approval
            const isPartnerReg = order.items.some(item => item.type === 'partnerRegistration');
            if (isPartnerReg) {
                const User = (await import('../models/user.js')).default;
                const user = await User.findById(order.userId);
                if (user && user.status === 'pending_approval') {
                    // Allow it to proceed to fulfillment logic
                    console.log("Processing paid partner registration order for approval:", order.orderNo);
                } else {
                    return res.status(400).json({ message: "Order is already paid and processed" });
                }
            } else {
                return res.status(400).json({ message: "Order is already paid" });
            }
        }

        // Update payment status
        order.payment.status = 'paid';
        await order.save();

        const userId = order.userId._id;
        const items = order.items;

        let defaultEnrolledStudentsCount = 200; // Fallback
        try {
            const fetchedCount = await Setting.getDefaultEnrolledStudentsCount();
            if (fetchedCount) defaultEnrolledStudentsCount = fetchedCount;
        } catch (err) {
            console.error("Error fetching default students count:", err);
        }

        // Process enrollments for each item in the order
        for (const item of items) {
            if (item.type === 'coursePlan' && item.coursePlanId) {
                const CoursePlan = (await import('../models/CoursePlan.js')).default;
                const plan = await safeFindCoursePlan(CoursePlan, item.coursePlanId, item.courseId);
                if (!plan) continue;

                let accessType = (plan.durationType || "lifetime").toLowerCase();
                let enrolledAt = new Date();
                let accessExpiry = null;

                if (plan.duration && ["month", "year", "day"].includes(accessType)) {
                    let expiry = new Date(enrolledAt);
                    if (accessType === "month") expiry.setMonth(expiry.getMonth() + Number(plan.duration));
                    else if (accessType === "year") expiry.setFullYear(expiry.getFullYear() + Number(plan.duration));
                    else if (accessType === "day") expiry.setDate(expiry.getDate() + Number(plan.duration));
                    accessExpiry = expiry;
                }

                await CourseEnrollment.create({
                    userId,
                    courseId: plan.courseId,
                    type: "coursePlan",
                    enrolledAt,
                    enrollmentSource: "purchase",
                    accessType,
                    accessExpiry,
                    orderId: order._id,
                    coursePlanId: plan._id
                });

                const course = await Course.findById(plan.courseId);
                if (course && !course.enrolledStudents.includes(userId)) {
                    course.enrolledStudents.push(userId);
                    course.enrolledStudentsCount = (course.enrolledStudentsCount || defaultEnrolledStudentsCount) + 1;
                    await course.save();
                }

                const room = await CourseChatRoom.findOne({ courseId: plan.courseId });
                if (room && !room.participants.includes(userId)) {
                    room.participants.push(userId);
                    await room.save();
                }
            } else if (item.type === 'course' && item.courseId) {
                const course = await Course.findById(item.courseId);
                if (!course) continue;

                let accessType = course.accessType || "lifetime";
                let enrolledAt = new Date();
                let accessExpiry = null;

                if ((accessType === "limited" || accessType === "subscription") && course.accessPeriod) {
                    const periodStr = course.accessPeriod.trim().toLowerCase();
                    let years = 0, months = 0, days = 0;
                    const yearMatch = periodStr.match(/(\d+)\s*year/);
                    const monthMatch = periodStr.match(/(\d+)\s*month/);
                    const dayMatch = periodStr.match(/(\d+)\s*day/);
                    if (yearMatch) years = parseInt(yearMatch[1], 10);
                    if (monthMatch) months = parseInt(monthMatch[1], 10);
                    if (dayMatch) days = parseInt(dayMatch[1], 10);
                    let expiry = new Date(enrolledAt);
                    if (years > 0) expiry.setFullYear(expiry.getFullYear() + years);
                    if (months > 0) expiry.setMonth(expiry.getMonth() + months);
                    if (days > 0) expiry.setDate(expiry.getDate() + days);
                    accessExpiry = (years > 0 || months > 0 || days > 0) ? expiry : null;
                }

                await CourseEnrollment.create({
                    userId,
                    courseId: item.courseId,
                    type: "course",
                    enrolledAt,
                    enrollmentSource: "purchase",
                    accessType,
                    accessExpiry,
                    orderId: order._id,
                });

                if (!course.enrolledStudents.includes(userId)) {
                    course.enrolledStudents.push(userId);
                    course.enrolledStudentsCount = (course.enrolledStudentsCount || defaultEnrolledStudentsCount) + 1;
                    await course.save();
                }

                const room = await CourseChatRoom.findOne({ courseId: item.courseId });
                if (room && !room.participants.includes(userId)) {
                    room.participants.push(userId);
                    await room.save();
                }
            } else if (item.type === 'courseBundle' && item.courseBundleId) {
                const bundle = await CourseBundle.findById(item.courseBundleId).populate('courses');
                if (!bundle) continue;

                for (const bundleCourse of bundle.courses) {
                    let accessType = bundleCourse.accessType || "lifetime";
                    let enrolledAt = new Date();
                    await CourseEnrollment.create({
                        userId,
                        courseId: bundleCourse._id,
                        type: "groupCourse",
                        enrolledAt,
                        enrollmentSource: "purchase",
                        accessType,
                        orderId: order._id,
                    });

                    const courseToUpdate = await Course.findById(bundleCourse._id);
                    if (courseToUpdate && !courseToUpdate.enrolledStudents.includes(userId)) {
                        courseToUpdate.enrolledStudents.push(userId);
                        courseToUpdate.enrolledStudentsCount = (courseToUpdate.enrolledStudentsCount || defaultEnrolledStudentsCount) + 1;
                        await courseToUpdate.save();
                    }
                }

                await CourseEnrollment.create({
                    userId,
                    courseBundleId: item.courseBundleId,
                    type: "courseBundle",
                    enrolledAt: new Date(),
                    enrollmentSource: "purchase",
                    accessType: bundle.accessType || "lifetime",
                    orderId: order._id,
                });

                if (!bundle.enrolledStudents.includes(userId)) {
                    bundle.enrolledStudents.push(userId);
                    await bundle.save();
                }
            } else if (item.type === 'subscription') {
                const User = (await import('../models/user.js')).default;
                const SubscriptionPlan = (await import('../models/SubscriptionPlan.js')).default;
                const { grantSubscriptionAccess } = await import('./subscriptionPurchaseController.js');

                const partnerUser = await User.findById(userId);
                if (!partnerUser) continue;

                // Plan id may come from user.subscription (legacy-safe), since item schema may not persist subscriptionPlanId.
                const planId = partnerUser.subscription?.planId || item.subscriptionPlanId || null;
                if (!planId) {
                    console.warn('⚠️ Subscription approval skipped: missing planId for user', userId);
                    continue;
                }

                const plan = await SubscriptionPlan.findById(planId).lean();
                if (!plan) {
                    console.warn('⚠️ Subscription approval skipped: plan not found', planId);
                    continue;
                }

                // Support both new and legacy plan fields.
                const durationType = plan.durationType || (Number(plan.year) > 0 ? 'year' : Number(plan.month) > 0 ? 'month' : 'day');
                const duration = Number(plan.duration || plan[durationType] || 0);

                const startedAt = new Date();
                const expiresAt = new Date(startedAt);
                if (durationType === 'month') expiresAt.setMonth(expiresAt.getMonth() + duration);
                else if (durationType === 'year') expiresAt.setFullYear(expiresAt.getFullYear() + duration);
                else if (durationType === 'day') expiresAt.setDate(expiresAt.getDate() + duration);

                // Activate subscription on user.
                partnerUser.subscription = {
                    ...(partnerUser.subscription || {}),
                    planId,
                    status: 'active',
                    startedAt,
                    expiresAt,
                    paidAt: new Date()
                };

                // If this was a partner activation flow, keep user active/verified.
                if (partnerUser.role === 'partner' || partnerUser.role === 'instructor') {
                    partnerUser.is_verify = true;
                    partnerUser.isActive = true;
                    partnerUser.status = 'active';
                }

                await partnerUser.save();

                // Grant all-course access for subscription duration.
                await grantSubscriptionAccess(partnerUser._id, planId);
                console.log(`✅ Subscription activated for ${partnerUser.fullName}; expiresAt=${expiresAt.toISOString()}`);
            } else if (item.type === 'partnerRegistration') {
                // Approve the partner user
                const User = (await import('../models/user.js')).default;
                const partnerUser = await User.findById(userId);
                if (partnerUser && (partnerUser.role === 'partner' || partnerUser.role === 'instructor')) {
                    partnerUser.is_verify = true;
                    partnerUser.isActive = true;
                    partnerUser.status = 'active';
                    if (partnerUser.registrationPayment) {
                        partnerUser.registrationPayment.status = 'completed';
                        partnerUser.registrationPayment.paidAt = new Date();

                        // ✅ ENROLL THE PARTNER IN THEIR SELECTED COURSE
                        const { courseId, planId } = partnerUser.registrationPayment;
                        if (courseId && planId) {
                            try {
                                const CoursePlan = (await import('../models/CoursePlan.js')).default;
                                const plan = await safeFindCoursePlan(CoursePlan, planId, courseId);
                                if (plan) {
                                    const accessType = (plan.durationType || "lifetime").toLowerCase();
                                    await CourseEnrollment.create({
                                        userId: partnerUser._id,
                                        courseId: plan.courseId,
                                        type: "coursePlan",
                                        enrolledAt: new Date(),
                                        enrollmentSource: "purchase",
                                        accessType,
                                        orderId: order._id,
                                        coursePlanId: plan._id
                                    });

                                    const course = await Course.findById(plan.courseId);
                                    if (course && !course.enrolledStudents.includes(partnerUser._id)) {
                                        course.enrolledStudents.push(partnerUser._id);
                                        await course.save();
                                    }
                                    console.log(`✅ Partner ${partnerUser.fullName} enrolled in registration course: ${courseId}`);
                                }
                            } catch (enrollErr) {
                                console.error("⚠️ Partner enrollment failed during approval:", enrollErr);
                            }
                        }
                    }
                    await partnerUser.save();
                    console.log(`✅ Partner ${partnerUser.fullName} approved via Order Management`);
                }
            }
        }

        // Send confirmation email
        try {
            await emailService.sendOrderConfirmationEmail(order.userId.email, order.userId.fullName);
        } catch (emailErr) {
            console.error("Approval email failed:", emailErr);
        }

        return res.status(200).json({ message: "Order approved and student enrolled successfully" });
    } catch (error) {
        console.error("Approve Order Error:", error);
        return res.status(500).json({ message: "Failed to approve order", error: error.message });
    }
};
export const syncMissingPartnerOrders = async (req, res) => {
    try {
        const User = (await import('../models/user.js')).default;
        const partners = await User.find({ 
            role: 'partner',
            registrationPayment: { $exists: true, $ne: null }
        });

        let syncCount = 0;
        let errors = [];

        for (const user of partners) {
            const userId = user._id;
            const regPay = user.registrationPayment;

            // Skip if no amount is set
            if (!regPay.amount) continue;

            // Check if order already exists for this registration
            const existingOrder = await Order.findOne({
                userId,
                'items.type': 'partnerRegistration'
            });

            if (!existingOrder) {
                try {
                    const orderNo = await generateOrderNumber();
                    const totalAmount = regPay.amount;
                    const subTotal = totalAmount;
                    const tax = 0;
                    
                    await Order.create({
                        orderNo,
                        userId,
                        items: [{
                            courseId: regPay.courseId,
                            coursePlanId: regPay.planId,
                            type: 'partnerRegistration',
                            pricePaid: subTotal,
                            currency: 'INR'
                        }],
                        subTotal,
                        tax,
                        gstRate: 0,
                        grandTotal: totalAmount,
                        payment: {
                            provider: regPay.method || 'manual',
                            paymentIntent: regPay.transactionId || 'LEGACY_SYNC',
                            status: regPay.status === 'completed' ? 'paid' : 'pending'
                        },
                        createdAt: regPay.paidAt || user.createdAt
                    });
                    syncCount++;
                    console.log(`✅ Synced missing order ${orderNo} for partner ${user.email}`);
                } catch (err) {
                    errors.push(`User ${user.email}: ${err.message}`);
                    console.error(`❌ Sync error for ${user.email}:`, err);
                }
            }
        }

        return res.status(200).json({
            success: true,
            message: `Sync completed. ${syncCount} orders created.`,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error("Sync Orders Error:", error);
        return res.status(500).json({ message: "Failed to sync orders", error: error.message });
    }
};
