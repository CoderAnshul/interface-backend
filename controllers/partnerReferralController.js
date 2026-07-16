import Order from "../models/Order.js";
import User from "../models/user.js";
import Course from "../models/Course.js";
import CourseBundle from "../models/CourseBundle.js";
import Ebook from "../models/Ebook.js";
import CoursePlan from "../models/CoursePlan.js";
import CourseEnrollment from "../models/CourseEnrollment.js";
import Setting from "../models/setting.js";
import PartnerPayout from "../models/PartnerPayout.js";

// Admin API: Get all partner referrals and purchases
export const getAllPartnerReferrals = async (req, res) => {
    try {
        const { page = 1, limit = 50, partnerId, startDate, endDate } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build query filter
        const filter = {
            "referredByPartner.partnerId": { $ne: null }
        };

        if (partnerId) {
            filter["referredByPartner.partnerId"] = partnerId;
        }

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        // Get orders with partner referrals
        const orders = await Order.find(filter)
            .populate('userId', 'fullName email phone')
            .populate('items.courseId', 'title slug')
            .populate('items.courseBundleId', 'title slug')
            .populate('items.ebookId', 'title slug')
            .populate('items.coursePlanId', 'title durationType duration')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const total = await Order.countDocuments(filter);

        // Format response
        const formattedOrders = orders.map(order => {
            const items = order.items.map(item => {
                let itemDetails = {
                    type: item.type,
                    pricePaid: parseFloat(item.pricePaid.toString()),
                    currency: item.currency
                };

                if (item.type === 'course' && item.courseId) {
                    itemDetails.course = {
                        _id: item.courseId._id,
                        title: item.courseId.title,
                        slug: item.courseId.slug
                    };
                } else if (item.type === 'courseBundle' && item.courseBundleId) {
                    itemDetails.bundle = {
                        _id: item.courseBundleId._id,
                        title: item.courseBundleId.title,
                        slug: item.courseBundleId.slug
                    };
                } else if (item.type === 'ebook' && item.ebookId) {
                    itemDetails.ebook = {
                        _id: item.ebookId._id,
                        title: item.ebookId.title,
                        slug: item.ebookId.slug
                    };
                } else if (item.type === 'coursePlan' && item.coursePlanId) {
                    itemDetails.plan = {
                        _id: item.coursePlanId._id,
                        title: item.coursePlanId.title,
                        durationType: item.coursePlanId.durationType,
                        duration: item.coursePlanId.duration
                    };
                }

                return itemDetails;
            });

            return {
                _id: order._id,
                orderNo: order.orderNo,
                student: {
                    _id: order.userId._id,
                    fullName: order.userId.fullName,
                    email: order.userId.email,
                    phone: order.userId.phone
                },
                partner: order.referredByPartner,
                items: items,
                subTotal: parseFloat(order.subTotal.toString()),
                discount: parseFloat(order.discount.toString()),
                tax: parseFloat(order.tax.toString()),
                grandTotal: parseFloat(order.grandTotal.toString()),
                payment: order.payment,
                createdAt: order.createdAt,
                updatedAt: order.updatedAt
            };
        });

        return res.status(200).json({
            success: true,
            message: "Partner referrals retrieved successfully",
            data: {
                orders: formattedOrders,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error("Get All Partner Referrals Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve partner referrals",
            error: error.message
        });
    }
};

// Admin API: Get partner referral statistics
export const getPartnerReferralStats = async (req, res) => {
    try {
        const { partnerId, startDate, endDate } = req.query;

        const filter = {
            "referredByPartner.partnerId": { $ne: null },
            "payment.status": "paid"
        };

        if (partnerId) {
            filter["referredByPartner.partnerId"] = partnerId;
        }

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        const orders = await Order.find(filter).sort({ createdAt: 1 }).lean();
        const commissionRate = await Setting.getPartnerCommissionRate();
        const rateMultiplier = commissionRate / 100;

        // Calculate statistics
        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.grandTotal.toString()), 0);
        const totalCommission = totalRevenue * rateMultiplier;

        const uniqueStudents = new Set(orders.map(order => order.userId.toString()));
        const totalStudents = uniqueStudents.size;

        // Group by partner
        const partnerStats = {};
        // Group by time (Monthly)
        const timeSeries = {};

        orders.forEach(order => {
            // Partner Grouping
            const pId = order.referredByPartner?.partnerId?.toString();
            if (pId) {
                if (!partnerStats[pId]) {
                    partnerStats[pId] = {
                        partnerId: pId,
                        partnerName: order.referredByPartner?.partnerName || 'Unknown',
                        referralCode: order.referredByPartner?.referralCode || '',
                        totalOrders: 0,
                        totalRevenue: 0,
                        totalCommission: 0,
                        totalStudents: new Set()
                    };
                }
                const rev = parseFloat(order.grandTotal.toString());
                partnerStats[pId].totalOrders++;
                partnerStats[pId].totalRevenue += rev;
                partnerStats[pId].totalCommission += (rev * rateMultiplier);
                partnerStats[pId].totalStudents.add(order.userId.toString());
            }

            // Time Series Grouping
            const date = new Date(order.createdAt);
            const monthYear = `${date.getMonth() + 1}-${date.getFullYear()}`;
            if (!timeSeries[monthYear]) {
                timeSeries[monthYear] = {
                    date: monthYear,
                    rawDate: new Date(date.getFullYear(), date.getMonth(), 1),
                    revenue: 0,
                    commission: 0,
                    orders: 0
                };
            }
            const revTime = parseFloat(order.grandTotal.toString());
            timeSeries[monthYear].revenue += revTime;
            timeSeries[monthYear].commission += (revTime * rateMultiplier);
            timeSeries[monthYear].orders++;
        });

        // Convert sets and objects to arrays
        const byPartner = Object.values(partnerStats).map(p => ({
            ...p,
            totalStudents: p.totalStudents.size,
            totalRevenue: parseFloat(p.totalRevenue.toFixed(2)),
            totalCommission: parseFloat(p.totalCommission.toFixed(2))
        })).sort((a, b) => b.totalRevenue - a.totalRevenue);

        const series = Object.values(timeSeries)
            .sort((a, b) => a.rawDate - b.rawDate)
            .map(({ date, revenue, commission, orders }) => ({
                date,
                revenue: parseFloat(revenue.toFixed(2)),
                commission: parseFloat(commission.toFixed(2)),
                orders
            }));

        return res.status(200).json({
            success: true,
            message: "Partner analytics retrieved successfully",
            data: {
                overall: {
                    totalOrders,
                    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
                    totalCommission: parseFloat(totalCommission.toFixed(2)),
                    netRevenue: parseFloat((totalRevenue - totalCommission).toFixed(2)),
                    totalStudents,
                    commissionRate
                },
                byPartner: byPartner.slice(0, 10), // Top 10 partners
                timeSeries: series
            }
        });
    } catch (error) {
        console.error("Get Partner Referral Stats Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve partner analytics",
            error: error.message
        });
    }
};

// Partner API: Get my referrals and purchases
export const getMyReferrals = async (req, res) => {
    try {
        const partnerId = req.user._id;
        const { page = 1, limit = 50, startDate, endDate } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Verify user is a partner
        if (req.user.role !== 'partner') {
            return res.status(403).json({
                success: false,
                message: "Access denied. Partner role required."
            });
        }

        // Build query filter
        const filter = {
            "referredByPartner.partnerId": partnerId
        };

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        // Get orders for this partner's referrals
        const orders = await Order.find(filter)
            .populate('userId', 'fullName email phone createdAt')
            .populate('items.courseId', 'title slug thumbnail')
            .populate('items.courseBundleId', 'title slug thumbnail')
            .populate('items.ebookId', 'title slug thumbnail')
            .populate('items.coursePlanId', 'title durationType duration')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const total = await Order.countDocuments(filter);

        // Format response
        const formattedOrders = orders.map(order => {
            const items = order.items.map(item => {
                let itemDetails = {
                    type: item.type,
                    pricePaid: parseFloat(item.pricePaid.toString()),
                    currency: item.currency
                };

                if (item.type === 'course' && item.courseId) {
                    itemDetails.course = {
                        _id: item.courseId._id,
                        title: item.courseId.title,
                        slug: item.courseId.slug,
                        thumbnail: item.courseId.thumbnail
                    };
                } else if (item.type === 'courseBundle' && item.courseBundleId) {
                    itemDetails.bundle = {
                        _id: item.courseBundleId._id,
                        title: item.courseBundleId.title,
                        slug: item.courseBundleId.slug,
                        thumbnail: item.courseBundleId.thumbnail
                    };
                } else if (item.type === 'ebook' && item.ebookId) {
                    itemDetails.ebook = {
                        _id: item.ebookId._id,
                        title: item.ebookId.title,
                        slug: item.ebookId.slug,
                        thumbnail: item.ebookId.thumbnail
                    };
                } else if (item.type === 'coursePlan' && item.coursePlanId) {
                    itemDetails.plan = {
                        _id: item.coursePlanId._id,
                        title: item.coursePlanId.title,
                        durationType: item.coursePlanId.durationType,
                        duration: item.coursePlanId.duration
                    };
                }

                return itemDetails;
            });

            return {
                _id: order._id,
                orderNo: order.orderNo,
                student: {
                    _id: order.userId._id,
                    fullName: order.userId.fullName,
                    email: order.userId.email,
                    phone: order.userId.phone,
                    joinedAt: order.userId.createdAt
                },
                items: items,
                subTotal: parseFloat(order.subTotal.toString()),
                discount: parseFloat(order.discount.toString()),
                tax: parseFloat(order.tax.toString()),
                grandTotal: parseFloat(order.grandTotal.toString()),
                payment: order.payment,
                createdAt: order.createdAt
            };
        });

        // Calculate partner statistics
        const paidOrders = orders.filter(order => order.payment.status === 'paid');
        const totalRevenue = paidOrders.reduce((sum, order) => {
            return sum + parseFloat(order.grandTotal.toString());
        }, 0);
        const uniqueStudents = new Set(orders.map(order => order.userId._id.toString()));

        return res.status(200).json({
            success: true,
            message: "My referrals retrieved successfully",
            data: {
                orders: formattedOrders,
                statistics: {
                    totalOrders: orders.length,
                    paidOrders: paidOrders.length,
                    totalRevenue,
                    totalStudents: uniqueStudents.size
                },
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error("Get My Referrals Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve referrals",
            error: error.message
        });
    }
};

// Partner API: Get my referral statistics
export const getMyReferralStats = async (req, res) => {
    try {
        const partnerId = req.user._id;

        // Verify user is a partner
        if (req.user.role !== 'partner') {
            return res.status(403).json({
                success: false,
                message: "Access denied. Partner role required."
            });
        }

        const filter = {
            "referredByPartner.partnerId": partnerId,
            "payment.status": "paid"
        };

        const orders = await Order.find(filter).lean();

        // Calculate statistics
        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((sum, order) => {
            return sum + parseFloat(order.grandTotal.toString());
        }, 0);

        const uniqueStudents = new Set(orders.map(order => order.userId.toString()));
        const totalStudents = uniqueStudents.size;

        // Referral tracking stats
        const referrals = await User.find({ referredBy: partnerId }).lean();
        const totalReferrals = referrals.length;

        const studentReferrals = referrals.filter(u => u.role === 'student');
        const activeTeachers = referrals.filter(u => u.role === 'instructor').length;

        const studentIds = studentReferrals.map(u => u._id);
        const activeEnrollments = await CourseEnrollment.find({
            userId: { $in: studentIds },
            status: 'active'
        }).distinct('userId');

        const activeStudents = activeEnrollments.length;
        const pendingConversions = Math.max(0, totalReferrals - totalStudents);

        // Earnings metrics
        const commissionRate = await Setting.getPartnerCommissionRate();
        const totalEarnings = totalRevenue * (commissionRate / 100);

        // Monthly earnings
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const monthlyOrders = orders.filter(o => new Date(o.createdAt) >= startOfMonth);
        const monthlyRevenue = monthlyOrders.reduce((sum, o) => sum + parseFloat(o.grandTotal.toString()), 0);
        const monthlyEarnings = monthlyRevenue * (commissionRate / 100);

        // Payout history & pending payout
        const payouts = await PartnerPayout.find({ partnerId, status: 'completed' }).lean();
        const paidAmount = payouts.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);
        const pendingPayout = Math.max(0, totalEarnings - paidAmount);

        // Get partner info
        const partner = await User.findById(partnerId).select('fullName email company.referralCode').lean();

        return res.status(200).json({
            success: true,
            message: "Referral statistics retrieved successfully",
            data: {
                partner: {
                    _id: partner._id,
                    name: partner.fullName,
                    email: partner.email,
                    referralCode: partner.company?.referralCode || ''
                },
                statistics: {
                    totalOrders,
                    totalRevenue,
                    totalStudents,
                    averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
                    totalReferrals,
                    activeStudents,
                    activeTeachers,
                    pendingConversions,
                    earnings: {
                        commissionRate,
                        totalEarnings,
                        monthlyEarnings,
                        pendingPayout,
                        paidAmount
                    }
                }
            }
        });
    } catch (error) {
        console.error("Get My Referral Stats Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve referral statistics",
            error: error.message
        });
    }
};

// Partner API: Get payout history
export const getMyPayoutHistory = async (req, res) => {
    try {
        const partnerId = req.user._id;
        const payouts = await PartnerPayout.find({ partnerId }).sort({ createdAt: -1 }).lean();

        const formattedPayouts = payouts.map(p => ({
            ...p,
            amount: parseFloat(p.amount.toString())
        }));

        return res.status(200).json({
            success: true,
            data: formattedPayouts
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Partner API: Get commission breakdown (orders with calculated commission)
export const getMyCommissions = async (req, res) => {
    try {
        const partnerId = req.user._id;
        const commissionRate = await Setting.getPartnerCommissionRate();

        const orders = await Order.find({
            "referredByPartner.partnerId": partnerId,
            "payment.status": "paid"
        }).populate('userId', 'fullName email').sort({ createdAt: -1 }).lean();

        const commissions = orders.map(order => {
            const revenue = parseFloat(order.grandTotal.toString());
            return {
                orderId: order._id,
                orderNo: order.orderNo,
                studentName: order.userId?.fullName || 'N/A',
                studentEmail: order.userId?.email || 'N/A',
                orderTotal: revenue,
                commissionRate,
                commissionEarned: revenue * (commissionRate / 100),
                createdAt: order.createdAt
            };
        });

        return res.status(200).json({
            success: true,
            data: commissions
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

