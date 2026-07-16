import SubscriptionPlan from "../models/SubscriptionPlan.js";
import User from "../models/user.js";
import Course from "../models/Course.js";
import CourseEnrollment from "../models/CourseEnrollment.js";
import Order from "../models/Order.js";
import { getCashfreeHeaders, getCashfreeBaseUrl } from "../config/cashfree.js";
import { generateOrderNumber } from "../utils/generateOrderNo.js";
import axiosCf from "axios";

// Manual subscription purchase (admin approval required)
export const requestManualSubscription = async (req, res) => {
    // // Debug: log plan.price before saving order
    // console.log('DEBUG subscriptionPlanAmount:', plan.price, typeof plan.price);
  try {
    const userId = req.user?._id || req.user?.id;
    const { planId, transactionId } = req.body;
    const normalizedPlanId = typeof planId === "string" ? planId.trim() : planId;
    const user = await User.findById(userId);
    if (!user || user.role !== "partner") {
      return res.status(403).json({ success: false, message: "Only partners can purchase subscriptions" });
    }
    const plan = await SubscriptionPlan.findById(normalizedPlanId).lean();

    console.log('DEBUG subscriptionPlanAmount plan object:', plan);
    if (!plan || (plan.status && plan.status !== "active")) {
      return res.status(404).json({ success: false, message: "Subscription plan not found or inactive" });
    }
    const orderNo = await generateOrderNumber();
    // Get all courses for the subscription
    const mongoose = (await import('mongoose')).default;
    const allCourses = await Course.find({}, '_id price');
    // Each item: type subscription, subscriptionPlanId, courseId, pricePaid = course price
    let subTotal = 0;
    const items = allCourses.map((course) => {
      const price = course.price ? Number(course.price) : 0;
      subTotal += price;
      return {
        type: "subscription",
        subscriptionPlanId: normalizedPlanId,
        courseId: course._id,
        pricePaid: mongoose.Types.Decimal128.fromString(price.toString()),
        currency: "INR"
      };
    });
    // Prefer legacy `amount` if present, otherwise use `price`
    const rawPlanAmount = (plan && (plan.amount ?? plan.price)) ?? 0;
    const planAmount = Number(rawPlanAmount);
    console.log('DEBUG plan.amount, plan.price, planAmount =>', plan.amount, plan.price, planAmount);

    const newOrder = await Order.create({
      orderNo,
      userId,
      items,
      subTotal: mongoose.Types.Decimal128.fromString(subTotal.toString()),
      grandTotal: mongoose.Types.Decimal128.fromString(subTotal.toString()),
      payment: {
        provider: "manual",
        paymentIntent: transactionId || "MANUAL_PENDING",
        status: "pending"
      },
      meta: {
        subscriptionPlanAmount: mongoose.Types.Decimal128.fromString(planAmount.toString())
      }
    });
    user.subscription = {
      planId: normalizedPlanId,
      transactionId: transactionId || "MANUAL_PENDING",
      amount: planAmount,
      method: "manual",
      status: "pending",
      paidAt: null
    };
    await user.save();
    return res.status(200).json({ success: true, message: "Manual subscription request submitted. Await admin approval.", data: { order: newOrder } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Cashfree subscription purchase (online)
export const initiateSubscriptionPayment = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { planId } = req.body;
    const normalizedPlanId = typeof planId === "string" ? planId.trim() : planId;
    const user = await User.findById(userId);
    if (!user || user.role !== "partner") {
      return res.status(403).json({ success: false, message: "Only partners can purchase subscriptions" });
    }
    const plan = await SubscriptionPlan.findById(normalizedPlanId).lean();
        console.log('DEBUG subscriptionPlanAmount:', plan);

    if (!plan || (plan.status && plan.status !== "active")) {
      return res.status(404).json({ success: false, message: "Subscription plan not found or inactive" });
    }
    const rawPlanAmount = (plan && (plan.amount ?? plan.price)) ?? 0;
    const planAmount = Number(rawPlanAmount);

    const cfHeaders = await getCashfreeHeaders();
    const cfBaseUrl = getCashfreeBaseUrl();
    const cashfreeOrderId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const orderNo = await generateOrderNumber();
    const newOrder = await Order.create({
      orderNo,
      userId,
      items: [{ type: "subscription", subscriptionPlanId: normalizedPlanId, pricePaid: planAmount, currency: "INR" }],
      subTotal: planAmount,
      grandTotal: planAmount,
      payment: {
        provider: "cashfree",
        paymentIntent: cashfreeOrderId,
        status: "pending"
      }
    });
    user.subscription = {
      planId: normalizedPlanId,
      transactionId: cashfreeOrderId,
      amount: planAmount,
      method: "online",
      status: "pending"
    };
    await user.save();
    const cfPayload = {
      order_amount: planAmount,
      order_currency: "INR",
      order_id: cashfreeOrderId,
      customer_details: {
        customer_id: `cust_${userId}`,
        customer_phone: user.phone || "9999999999",
        customer_email: user.email,
        customer_name: user.fullName || "Partner User"
      },
      order_meta: {
        return_url: `${process.env.FRONTEND_URL || 'https://dipaniglobaledu.com'}/payment-success?order_id={order_id}&type=subscription`,
        notify_url: `${process.env.BACKEND_URL || 'https://api.dipaniglobaledu.com'}/api/subscription/verify-cashfree`
      },
      order_note: "Partner Subscription Fee"
    };
    const cfResponse = await axiosCf.post(`${cfBaseUrl}/orders`, cfPayload, { headers: cfHeaders, timeout: 45000 });
    if (cfResponse.data && cfResponse.data.payment_session_id) {
      return res.status(200).json({ success: true, message: "Payment session created", data: cfResponse.data });
    } else {
      throw new Error("Invalid response from Cashfree");
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Admin approval or Cashfree webhook should grant access to all courses for the duration
export const grantSubscriptionAccess = async (userId, planId) => {
  const plan = await SubscriptionPlan.findById(planId).lean();
  console.log('DEBUG grantSubscriptionAccess - Found plan:', plan);
  if (!plan) return;
  const allCourses = await Course.find({});
  const now = new Date();
  let expiry = new Date(now);
  const durationType = plan.durationType || (Number(plan.year) > 0 ? "year" : Number(plan.month) > 0 ? "month" : "day");
  const duration = Number(plan.duration || plan[durationType] || 0);
  if (durationType === "month") expiry.setMonth(expiry.getMonth() + duration);
  else if (durationType === "year") expiry.setFullYear(expiry.getFullYear() + duration);
  else if (durationType === "day") expiry.setDate(expiry.getDate() + duration);
  for (const course of allCourses) {
    await CourseEnrollment.create({
      userId,
      courseId: course._id,
      type: "subscription",
      enrolledAt: now,
      enrollmentSource: "subscription",
      accessType: durationType,
      accessExpiry: expiry
    });
  }
};

// Get logged-in user's subscription plan details
export const getMySubscriptionPlan = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const subscription = user.subscription || null;
    if (!subscription || !subscription.planId) {
      return res.status(200).json({
        success: true,
        message: "No active subscription found",
        data: {
          subscription: null,
          plan: null,
          isValid: false,
          remainingDays: 0
        }
      });
    }

    const plan = await SubscriptionPlan.findById(subscription.planId).lean();
    const now = new Date();
    const expiresAt = subscription.expiresAt ? new Date(subscription.expiresAt) : null;
    const isExpired = !!expiresAt && expiresAt < now;
    const isValid = subscription.status === "active" && !isExpired;
    const remainingDays = expiresAt
      ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    return res.status(200).json({
      success: true,
      message: "Subscription plan fetched successfully",
      data: {
        subscription,
        plan,
        isValid,
        remainingDays
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
