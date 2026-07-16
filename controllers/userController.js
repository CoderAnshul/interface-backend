import mongoose from "mongoose";
import path from "path";
import { promises as fs } from "fs";
import User from "../models/user.js";
import FcmToken from "../models/fcmTokens.js";
import notificationService from "../utils/notificationService.js";
import Course from "../models/Course.js";
import CoursePlan from "../models/CoursePlan.js";
import CourseBundle from "../models/CourseBundle.js";
import Assignment from "../models/Assignment.js";
import CourseEnrollment from "../models/CourseEnrollment.js";
import UserService from "../service/userService.js";
import { getUserLeaderboard } from "../service/leaderboardService.js"; // <-- Add this import
import Order from "../models/Order.js";
import { generateOrderNumber } from "../utils/generateOrderNo.js";
import { Token } from "../utils/index.js"; // contains generateToken, setTokensCookies, etc.
import { initRedis } from "../config/redisClient.js";
import emailService from "../utils/emailService.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import {
  cleanupExpiredAccessTokensForUser,
  getAllAccessTokensForUser,
  blacklistAccessToken,
} from "../utils/tokens/generateTokens.js";
import UserRefreshToken from "../models/UserRefreshToken.js";
import DeviceApproval from "../models/DeviceApproval.js";
import LoginLog from "../models/LoginLog.js";
import Setting from "../models/setting.js";
import { getCashfreeHeaders, getCashfreeBaseUrl } from "../config/cashfree.js";
import axiosCf from 'axios';

const userService = new UserService();

export const signup = async (req, res) => {
  try {
    //console.log("📩 Request Body user signup:", req.body);

    // ✅ Email format check
    if (!/^\S+@\S+\.\S+$/.test(req.body.email)) {
      return res.status(400).json({
        message: "Please enter a valid email address",
        data: {},
        success: false,
        err: { email: "Invalid format — must contain '@' and domain" },
      });
    }

    // ✅ Check if is_verify is explicitly true
    if (req.body.is_verify !== true) {
      return res.status(400).json({
        message: "Email not verified",
        data: {},
        success: false,
        err: { email: "Please verify your email before signing up" },
      });
    }

    const user = await userService.getUserByEmail(req.body.email);
    if (user) {
      return res.status(400).json({
        message: "Email already exists",
        data: {},
        success: false,
        err: {},
      });
    }

    let registrationPaymentData = req.body.registrationPayment;
    if (req.body.role === 'partner' && req.body.paymentMethod !== 'manual') {
      registrationPaymentData = registrationPaymentData || {};
      registrationPaymentData.status = 'pending';
      registrationPaymentData.method = 'online';
    }

    const signupPayload = {
      email: req.body.email,
      password: req.body.password,
      fullName: req.body.fullName,
      role: req.body.role,
      is_verify: req.body.is_verify,
      phone: req.body.phone,
      referralCode: req.body.referralCode,
      referredByCode: req.body.referredByCode,
      partnerInfo: req.body.partnerInfo,
      registrationPayment: registrationPaymentData,
    };
    console.log("🛠️ Signup Role:", req.body.role, "Payment Method:", req.body.paymentMethod);
    if (req.body.role === 'partner' && req.body.paymentMethod === 'manual') {
      signupPayload.status = 'pending_approval';
      signupPayload.isActive = false;
    }
    console.log("🛠️ Handled Signup Payload Status:", signupPayload.status);

    // Create new user (for student or if payment is free/not required or manual partner)
    const newUser = await userService.signup(signupPayload);

    console.log("✅ New user created:", newUser);

    // If partner is pending approval, inform them and SKIP token generation/login
    if (newUser.role === 'partner' && newUser.status === 'pending_approval') {
      // Create an Order record so it appears in Order Management for admin approval
      try {
        const Order = (await import('../models/Order.js')).default;
        const orderNo = `ORD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const amount = newUser.registrationPayment?.amount || 0;
        await Order.create({
          orderNo,
          userId: newUser._id,
          items: [{
            type: 'partnerRegistration',
            pricePaid: amount,
            currency: 'INR'
          }],
          subTotal: amount,
          grandTotal: amount,
          payment: {
            provider: 'manual',
            paymentIntent: newUser.registrationPayment?.transactionId || null,
            status: 'pending'
          }
        });
      } catch (orderErr) {
        console.error("⚠️ Failed to create partner registration order:", orderErr);
      }

      return res.status(201).json({
        success: true,
        message: "✅ Successfully registered. Your partner account is pending admin approval.",
        data: {
          user: {
            _id: newUser._id,
            email: newUser.email,
            fullName: newUser.fullName,
            role: newUser.role,
            status: newUser.status
          },
          pendingApproval: true
        },
      });
    }

    const userId = newUser._id.toString();

    // Generate tokens
    const { accessToken, refreshToken } = await Token.generateTokens(newUser);

    // Connect to Redis
    const redis = await initRedis();

    // Store tokens in Redis (no expiry)
    await redis.set(`accessToken:${accessToken}`, "valid");
    await redis.set(`refreshToken:${refreshToken}`, userId);

    // Cache user data in Redis (expires in 1 hour)
    await redis.setEx(
      `user:${userId}`,
      3600,
      JSON.stringify({
        _id: newUser._id,
        email: newUser.email,
        fullName: newUser.fullName,
        roles: newUser.roles,
        profilePicture: newUser.profilePicture,
        bio: newUser.bio,
        phone: newUser.phone,
        address: newUser.address,
        company: newUser.company,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
        is_verify: newUser.is_verify, // Include is_verify in cache
      })
    );

    // Set tokens as HTTP-only cookies (no maxAge)
    Token.setTokensCookies(res, accessToken, refreshToken);


    return res.status(201).json({
      success: true,
      message: "✅ Successfully created a new user",
      data: {
        user: newUser,
        accessToken,
        refreshToken,
      },
      err: {},
    });
  } catch (err) {
    console.error("❌ Signup Error:", err);
    return res.status(500).json({
      message: err.message,
      data: {},
      success: false,
      err: err.message,
    });
  }
};

export const approvePartner = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user || user.role !== 'partner') {
      return res.status(404).json({
        success: false,
        message: "Partner not found",
      });
    }

    user.is_verify = true;
    user.isActive = true;
    user.status = "active";

    // Update registration payment status if it exists
    if (user.registrationPayment && user.registrationPayment.method === 'manual') {
      user.registrationPayment.status = 'completed';
      user.registrationPayment.paidAt = new Date();

      const { courseId, planId } = user.registrationPayment;
      // Check if planId is a SubscriptionPlan
      const SubscriptionPlan = (await import('../models/SubscriptionPlan.js')).default;
      const { grantSubscriptionAccess } = await import('./subscriptionPurchaseController.js');
      const subscriptionPlan = await SubscriptionPlan.findById(planId);
      if (subscriptionPlan) {
        // Grant all-course access for subscription duration
        await grantSubscriptionAccess(user._id, planId);
        // Update user.subscription status
        user.subscription = {
          planId,
          transactionId: user.registrationPayment.transactionId,
          amount: subscriptionPlan.price,
          method: 'manual',
          status: 'active',
          startedAt: new Date(),
          expiresAt: (() => {
            const now = new Date();
            if (subscriptionPlan.durationType === 'month') { now.setMonth(now.getMonth() + subscriptionPlan.duration); return now; }
            if (subscriptionPlan.durationType === 'year') { now.setFullYear(now.getFullYear() + subscriptionPlan.duration); return now; }
            if (subscriptionPlan.durationType === 'day') { now.setDate(now.getDate() + subscriptionPlan.duration); return now; }
            return null;
          })(),
          paidAt: new Date()
        };
        console.log(`✅ Partner ${user.fullName} granted all-course access for subscription plan: ${planId}`);
      } else if (courseId && planId) {
        // Fallback to old course plan logic
        try {
          const CoursePlan = (await import('../models/CoursePlan.js')).default;
          const plan = await CoursePlan.findById(planId);
          if (plan) {
            const accessType = (plan.durationType || "lifetime").toLowerCase();
            await CourseEnrollment.create({
              userId: user._id,
              courseId: plan.courseId,
              type: "coursePlan",
              enrolledAt: new Date(),
              enrollmentSource: "purchase",
              accessType,
              coursePlanId: plan._id
            });

            const course = await (await import('../models/Course.js')).default.findById(plan.courseId);
            if (course && !course.enrolledStudents.includes(user._id)) {
                course.enrolledStudents.push(user._id);
                await course.save();
            }
            console.log(`✅ Partner ${user.fullName} enrolled in registration course: ${courseId}`);
          }
        } catch (enrollErr) {
          console.error("⚠️ Partner enrollment failed during manual approval:", enrollErr);
        }
      }
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "✅ Partner approved successfully",
      data: user,
    });
  } catch (err) {
    console.error("❌ Partner Approval Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const verifyPartnerPayment = async (req, res) => {
  try {
    const { order_id, signupData } = req.body;
    console.log("🛠️ Verifying partner payment for order_id:", order_id);

    if (!order_id || !signupData) {
      return res.status(400).json({ success: false, message: "order_id and signupData are required" });
    }

    const cfHeaders = await getCashfreeHeaders();
    const cfBaseUrl = getCashfreeBaseUrl();

    // Verify payment with Cashfree
    const cfRes = await axiosCf.get(`${cfBaseUrl}/orders/${order_id}`, { headers: cfHeaders });
    const cfOrder = cfRes.data;
    console.log("🛠️ Cashfree order status:", cfOrder?.order_status);

    if (!cfOrder || cfOrder.order_status !== 'PAID') {
      return res.status(402).json({
        success: false,
        message: `Payment not completed. Status: ${cfOrder?.order_status || 'unknown'}`,
        status: cfOrder?.order_status
      });
    }

    // Payment verified — check if user already exists (just in case)
    const existingUser = await userService.getUserByEmail(signupData.email);
    if (existingUser) {
      console.log("🛠️ Existing user found during partner payment verification:", existingUser.email);
      return res.status(400).json({
        message: "User already exists",
        success: false,
      });
    }

    // Create new partner user (pending admin approval)
    const newUser = await userService.signup({
      ...signupData,
      is_verify: false, // Changed to false to allow admin approval flow
      isActive: false, // Requires admin approval
      status: 'pending_approval'
    });

    console.log("✅ New partner created after payment (pending approval):", newUser);

    // ✅ Create an Order record so it appears in Order Management for admin approval
    try {
      const Order = (await import('../models/Order.js')).default;
      const orderNo = `ORD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const amount = cfOrder.order_amount || 0;
      await Order.create({
        orderNo,
        userId: newUser._id,
        items: [{
          type: 'partnerRegistration',
          pricePaid: amount,
          currency: 'INR'
        }],
        subTotal: amount,
        grandTotal: amount,
        payment: {
          provider: 'cashfree',
          paymentIntent: order_id,
          status: 'paid' // It's paid via Cashfree
        }
      });
      console.log("✅ Partner registration order created:", orderNo);
    } catch (orderErr) {
      console.error("⚠️ Failed to create partner registration order:", orderErr);
    }

    // ✅ We do NOT generate tokens here because the account is pending approval.
    // The user will need to log in manually AFTER admin approval.

    return res.status(201).json({
      success: true,
      message: "✅ Successfully registered. Your partner account is pending admin approval.",
      data: {
        user: {
          _id: newUser._id,
          email: newUser.email,
          fullName: newUser.fullName,
          role: newUser.role,
          status: newUser.status
        },
        pendingApproval: true
      },
    });

  } catch (err) {
    console.error("❌ Partner Verification Error:", err);
    return res.status(500).json({
      message: err.message,
      success: false,
    });
  }
};

//updateFcmToken
export const updateFcmToken = async (req, res) => {
  try {
    const { token, deviceId, userId, platform } = req.body;

    if (!token || !deviceId) {
      return res.status(400).json({ message: "Token and deviceId required" });
    }

    let existing = null;

    if (userId) {
      // First check if deviceId exists with userId null → assign it to this user
      existing = await FcmToken.findOne({ deviceId, userId: null });

      if (existing) {
        existing.userId = userId;
        existing.token = token;
        existing.platform = platform || existing.platform;
        existing.updatedAt = new Date();
        await existing.save();
      } else {
        // Now check if same userId already exists for this device
        existing = await FcmToken.findOne({ deviceId, userId });

        if (existing) {
          // Update existing entry for same user
          existing.token = token;
          existing.platform = platform || existing.platform;
          existing.updatedAt = new Date();
          await existing.save();
        } else {
          // New user login on same device → create new entry
          await FcmToken.create({
            token,
            deviceId,
            userId,
            platform,
          });
        }
      }
    } else {
      // No userId provided → create or update device-only entry
      existing = await FcmToken.findOne({ deviceId, userId: null });

      if (existing) {
        existing.token = token;
        existing.platform = platform || existing.platform;
        existing.updatedAt = new Date();
        await existing.save();
      } else {
        await FcmToken.create({
          token,
          deviceId,
          userId: null,
          platform,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "FCM token updated/created",
      data: {
        token,
        deviceId,
        userId: userId || null,
        platform,
      },
    });
  } catch (error) {
    console.error("❌ Error updating FCM token:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update FCM token",
    });
  }
};

//sendTestNotification
export const sendTestNotification = async (req, res) => {
  try {
    const token = req.body.token;
    const data = {
      title: "Order_Notification",
      description: "Your order has been shipped",
      order_id: "12345",
      type: "order_status",
    };
    const response = await notificationService.sendPushNotification(
      token,
      data
    );
    //console.log("Test notification response:", response);

    // Save notification response
    if (response.success) {
      const notification = new Notification({
        data,
        status: 0,
        user_id: req.user._id,
      });
      await notification.save();
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error("❌ Error sending test notification:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send test notification",
    });
  }
};

export const createUserByAdmin = async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({
        success: false,
        message: "Email, password, and fullName are required",
      });
    }

    const existingUser = await userService.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    // 👇 Role forcibly set to 'student'
    // If partner, set referredBy to partner's user ID
    let createPayload = {
      email,
      password,
      fullName,
      role: "student",
      emailVerified: true
    };
    if (req.user && req.user.role === 'partner') {
      createPayload.referredBy = req.user._id;
    }

    console.log("[createUserByAdmin] Payload:", createPayload);
    const newUser = await userService.adminCreateUser(createPayload);

    return res.status(201).json({
      success: true,
      message: "✅ Student created successfully",
      data: newUser,
    });
  } catch (error) {
    console.error("❌ Admin/Partner create student error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getMyProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await userService.getUserById(userId);
    // Get latest personality submission for the user
    let personality = null;
    try {
      const PersonalitySubmission = (await import('../models/PersonalitySubmission.js')).default;
      personality = await PersonalitySubmission.findOne({ userId }).sort({ createdAt: -1 }).lean();
    } catch (e) {
      console.error('Error fetching personality submission:', e);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        data: {},
        err: {},
      });
    }

    return res.status(200).json({
      success: true,
      message: "✅ User profile fetched successfully",
      data: {
        user: {
          _id: user._id,
          email: user.email,
          fullName: user.fullName,
          is_verify: user.is_verify,
          roles: user.roles,
          profilePicture: user.profilePicture,
          enrolledCourses: user.enrolledCourses,
          teachingCourses: user.teachingCourses,
          qualifications: user.qualifications,
          documentation: user.documentation,
          bio: user.bio,
          phone: user.phone,
          address: user.address,
          company: user.company, // <-- add company object
          skills: user.skills, // ✅ Correctly added here
          education: user.education, // ✅ Correctly added here
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          registrationPayment: user.registrationPayment,
          personality: personality ? {
            resultType: personality.resultType,
            scores: personality.scores,
            createdAt: personality.createdAt
          } : null
        },
      },
      err: {},
    });
  } catch (err) {
    console.error("❌ Error fetching profile:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve profile",
      data: {},
      err: err.message,
    });
  }
};

// export const updateProfile = async (req, res) => {
//   try {
//     if (req.fileValidationError) {
//       return res.status(400).json({
//         success: false,
//         message: req.fileValidationError,
//         data: {},
//         err: req.fileValidationError,
//       });
//     }

//     const userId = req.user?._id?.toString();
//     if (!userId) {
//       return res.status(400).json({
//         success: false,
//         message: "User ID is required",
//         data: {},
//         err: {},
//       });
//     }

//     const allowedFields = [
//       "fullName",
//       "bio",
//       "phone",
//       "address",
//       "education",
//       "skills",
//       "documentation",
//     ];
//     const updateData = {};
//     let oldImagePath;

//     for (const field of allowedFields) {
//       if (req.body[field]) {
//         updateData[field] = req.body[field];
//       }
//     }

//     if (req.files && req.files.profilePicture && req.files.profilePicture[0]) {
//       const currentUser = await userService.getUserById(userId);
//       if (currentUser.profilePicture && currentUser.profilePicture !== "default-profile.png") {
//         oldImagePath = path.join("uploads", currentUser.profilePicture);
//       }
//       updateData.profilePicture = req.files.profilePicture[0].filename;
//     }

//     // ✅ Handle documentation[] files with documentation[0].name format
//     if (req.files && req.files.documentation && req.files.documentation.length > 0) {
//       const documentationArray = [];

//       for (let i = 0; i < req.files.documentation.length; i++) {
//         const file = req.files.documentation[i];
//         const nameField = `documentation[${i}].name`;
//         const docName = req.body[nameField] || file.originalname;

//         documentationArray.push({
//           name: docName,
//           Doc: file.filename,
//         });
//       }

//       const currentUser = await userService.getUserById(userId);
//       if (currentUser.documentation && currentUser.documentation.length > 0) {
//         updateData.documentation = [...currentUser.documentation, ...documentationArray];
//       } else {
//         updateData.documentation = documentationArray;
//       }
//     }

//     // Handle role-specific fields
//     if (req.body.role === "student" && req.body.enrolledCourses) {
//       try {
//         updateData.enrolledCourses = Array.isArray(req.body.enrolledCourses)
//           ? req.body.enrolledCourses
//           : JSON.parse(req.body.enrolledCourses);
//       } catch {
//         updateData.enrolledCourses = req.body.enrolledCourses;
//       }
//     }

//     if (req.body.role === "instructor" && req.body.teachingCourses) {
//       try {
//         updateData.teachingCourses = Array.isArray(req.body.teachingCourses)
//           ? req.body.teachingCourses
//           : JSON.parse(req.body.teachingCourses);
//       } catch {
//         updateData.teachingCourses = req.body.teachingCourses;
//       }
//     }

//     if (req.body.address) {
//   try {
//     updateData.address = JSON.parse(req.body.address);
//   } catch (e) {
//     return res.status(400).json({
//       success: false,
//       message: "Invalid address format",
//       data: {},
//       err: e.message,
//     });
//   }
// }

//     if (req.body.role === "instructor" && req.body.qualifications) {
//       try {
//         updateData.qualifications = Array.isArray(req.body.qualifications)
//           ? req.body.qualifications
//           : JSON.parse(req.body.qualifications);
//       } catch {
//         updateData.qualifications = req.body.qualifications;
//       }
//     }

//     if (Object.keys(updateData).length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "No valid fields to update",
//         data: {},
//         err: {},
//       });
//     }

//     const updatedUser = await userService.updateUserById(userId, updateData);

//     if (!updatedUser) {
//       if (req.files) {
//         const fs = require("fs").promises;
//         if (req.files.profilePicture && req.files.profilePicture[0]) {
//           try {
//             await fs.unlink(req.files.profilePicture[0].path);
//           } catch {}
//         }
//         if (req.files.documentation) {
//           for (const file of req.files.documentation) {
//             try {
//               await fs.unlink(file.path);
//             } catch {}
//           }
//         }
//       }
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//         data: {},
//         err: {},
//       });
//     }

//     if (oldImagePath) {
//       try {
//         const fs = require("fs").promises;
//         await fs.unlink(oldImagePath);
//       } catch {}
//     }

//     // 🔄 Update Redis cache
//     const redis = await initRedis();
//     const userCacheData = {
//       _id: updatedUser._id,
//       email: updatedUser.email,
//       fullName: updatedUser.fullName,
//       roles: updatedUser.roles,
//       profilePicture: updatedUser.profilePicture,
//       bio: updatedUser.bio,
//       phone: updatedUser.phone,
//       address: updatedUser.address,
//       education: updatedUser.education,
//       skills: updatedUser.skills,
//       enrolledCourses: updatedUser.enrolledCourses,
//       teachingCourses: updatedUser.teachingCourses,
//       qualifications: updatedUser.qualifications,
//       documentation: updatedUser.documentation,
//       createdAt: updatedUser.createdAt,
//       updatedAt: updatedUser.updatedAt,
//     };

//     await redis.setEx(`user:${userId}`, 3600, JSON.stringify(userCacheData));
//     const userSessionKey = `user_session:${userId}`;
//     if (await redis.exists(userSessionKey)) {
//       await redis.setEx(userSessionKey, 3600, JSON.stringify(userCacheData));
//     }

//     return res.status(200).json({
//       success: true,
//       message: "Profile updated successfully",
//       data: { user: updatedUser },
//       err: {},
//     });
//   } catch (err) {
//     if (req.files) {
//       const fs = require("fs").promises;
//       if (req.files.profilePicture && req.files.profilePicture[0]) {
//         try {
//           await fs.unlink(req.files.profilePicture[0].path);
//         } catch {}
//       }
//       if (req.files.documentation) {
//         for (const file of req.files.documentation) {
//           try {
//             await fs.unlink(file.path);
//           } catch {}
//         }
//       }
//     }
//     return res.status(500).json({
//       success: false,
//       message: err.message,
//       data: {},
//       err: err.message,
//     });
//   }
// };
export const updateProfile = async (req, res) => {
  try {
    if (req.fileValidationError) {
      return res.status(400).json({
        success: false,
        message: req.fileValidationError,
        data: {},
        err: req.fileValidationError,
      });
    }

    const userId = req.user?._id?.toString();
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
        data: {},
        err: {},
      });
    }

    const allowedFields = [
      "fullName",
      "bio",
      "phone",
      "address",
      "education",
      "skills",
      "documentation",
      "company",
      "partnerInfo",
    ];
    const updateData = {};
    let oldImagePath;

    for (const field of allowedFields) {
      if (req.body[field]) {
        updateData[field] = req.body[field];
      }
    }

    // Phone validation (simple international format, 10-15 digits)
    if (updateData.phone) {
      const phoneRegex = /^\+?[0-9]{10,15}$/;
      if (!phoneRegex.test(updateData.phone)) {
        return res.status(400).json({
          success: false,
          message: "Invalid phone number format",
          data: {},
          err: "Invalid phone",
        });
      }
    }

    const currentUser = await userService.getUserById(userId);

    // Handle profile picture
    if (req.files?.profilePicture?.[0]) {
      if (
        currentUser?.profilePicture &&
        currentUser.profilePicture !== "default-profile.png"
      ) {
        oldImagePath = path.join("uploads", currentUser.profilePicture);
      }
      updateData.profilePicture = req.files.profilePicture[0].filename;
    }

    // Handle documentation uploads
    if (req.files?.documentation?.length) {
      const documentationArray = req.files.documentation.map((file, index) => {
        const docName =
          req.body[`documentation[${index}].name`] || file.originalname;
        return { name: docName, Doc: file.filename };
      });

      updateData.documentation = currentUser?.documentation?.length
        ? [...currentUser.documentation, ...documentationArray]
        : documentationArray;
    }

    // Parse complex fields
    if (req.body.role === "student" && req.body.enrolledCourses) {
      try {
        updateData.enrolledCourses = Array.isArray(req.body.enrolledCourses)
          ? req.body.enrolledCourses
          : JSON.parse(req.body.enrolledCourses);
      } catch {
        updateData.enrolledCourses = req.body.enrolledCourses;
      }
    }

    if (req.body.role === "instructor" && req.body.teachingCourses) {
      try {
        updateData.teachingCourses = Array.isArray(req.body.teachingCourses)
          ? req.body.teachingCourses
          : JSON.parse(req.body.teachingCourses);
      } catch {
        updateData.teachingCourses = req.body.teachingCourses;
      }
    }

    if (req.body.address) {
      try {
        updateData.address = JSON.parse(req.body.address);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: "Invalid address format",
          data: {},
          err: e.message,
        });
      }
    }

    if (req.body.role === "instructor" && req.body.qualifications) {
      try {
        updateData.qualifications = Array.isArray(req.body.qualifications)
          ? req.body.qualifications
          : JSON.parse(req.body.qualifications);
      } catch {
        updateData.qualifications = req.body.qualifications;
      }
    }

    if (req.body.company) {
      try {
        updateData.company = typeof req.body.company === "string" ? JSON.parse(req.body.company) : req.body.company;
      } catch (e) {
        console.error("Error parsing company:", e);
      }
    }

    if (req.body.partnerInfo) {
      try {
        updateData.partnerInfo = typeof req.body.partnerInfo === "string" ? JSON.parse(req.body.partnerInfo) : req.body.partnerInfo;
      } catch (e) {
        console.error("Error parsing partnerInfo:", e);
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update",
        data: {},
        err: {},
      });
    }

    const updatedUser = await userService.updateUserById(userId, updateData);

    if (!updatedUser) {
      await cleanUploadedFiles(req.files);
      return res.status(404).json({
        success: false,
        message: "User not found",
        data: {},
        err: {},
      });
    }

    // Delete old profile picture if needed
    if (oldImagePath) {
      try {
        await fs.unlink(oldImagePath);
      } catch { }
    }

    // Update Redis cache
    const redis = await initRedis();
    const userCacheData = {
      _id: updatedUser._id,
      email: updatedUser.email,
      fullName: updatedUser.fullName,
      roles: updatedUser.roles,
      profilePicture: updatedUser.profilePicture,
      bio: updatedUser.bio,
      phone: updatedUser.phone,
      address: updatedUser.address,
      company: updatedUser.company, // <-- add company object
      education: updatedUser.education,
      skills: updatedUser.skills,
      enrolledCourses: updatedUser.enrolledCourses,
      teachingCourses: updatedUser.teachingCourses,
      qualifications: updatedUser.qualifications,
      documentation: updatedUser.documentation,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };

    await redis.setEx(`user:${userId}`, 3600, JSON.stringify(userCacheData));
    const sessionKey = `user_session:${userId}`;
    if (await redis.exists(sessionKey)) {
      await redis.setEx(sessionKey, 3600, JSON.stringify(userCacheData));
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: { user: updatedUser },
      err: {},
    });
  } catch (err) {
    await cleanUploadedFiles(req.files);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
      data: {},
      err: err.message,
    });
  }
};

// 🔧 Helper: Delete uploaded files if needed
async function cleanUploadedFiles(files) {
  if (!files) return;

  if (files.profilePicture?.[0]) {
    try {
      await fs.unlink(files.profilePicture[0].path);
    } catch { }
  }

  if (files.documentation?.length) {
    for (const file of files.documentation) {
      try {
        await fs.unlink(file.path);
      } catch { }
    }
  }
}

const parseUserAgent = (userAgent) => {
  const browserRegex = /(chrome|firefox|safari|edge|opera)\/?\s*(\d+)/i;
  const match = userAgent.match(browserRegex);

  return {
    browserName: match ? match[1] : "Unknown",
    browserVersion: match ? match[2] : "Unknown",
  };
};

// Helper function to create login log
const createLoginLog = async (
  userId,
  deviceId,
  deviceInfo,
  loginStatus = "success",
  sessionId = null
) => {
  try {
    const loginLog = new LoginLog({
      userId: userId || null,
      deviceId: deviceId || "unknown",
      deviceInfo,
      loginStatus,
      sessionId: sessionId || null,
      loginTime: new Date(),
    });

    await loginLog.save();
    //console.log(
    //   `✅ Login log created: ${loginStatus} for deviceId: ${deviceId || "unknown"
    //   }`
    // );
    return loginLog;
  } catch (error) {
    console.error("❌ Error creating login log:", {
      error: error.message,
      userId,
      deviceId,
      loginStatus,
    });
    return null;
  }
};

// Login controller
export const login = async (req, res) => {
  try {
    //console.log("📩 Request Body user login:", req.body);

    const { email, password, deviceId } = req.body;
    const deviceInfo = {
      platform: req.body.platform || "android",
      userAgent: req.headers["user-agent"] || "",
      ipAddress: req.ip || req.connection.remoteAddress || "",
      deviceName: req.body.deviceName || "",
      ...parseUserAgent(req.headers["user-agent"] || ""),
    };

    // Validation
    if (!email || !password) {
      await createLoginLog(null, deviceId, deviceInfo, "failed");
      return res.status(400).json({
        message: "Email and password are required",
        data: {},
        success: false,
        err: { message: "Missing required fields" },
      });
    }

    // Authenticate user credentials
    const loginResult = await userService.login(email, password);

    // If login fails, log the attempt and return early
    if (!loginResult || !loginResult.success) {
      await createLoginLog(null, deviceId, deviceInfo, "failed");
      return res.status(401).json({
        message: "Invalid email or password",
        data: {},
        success: false,
        err: { message: "Invalid credentials" },
      });
    }

    const user = loginResult?.userObj;

    // ✅ CHECK: If user is a partner and status is pending_approval, block login
    if (user.role === 'partner' && user.status === 'pending_approval') {
      await createLoginLog(user._id, deviceId, deviceInfo, "failed");
      return res.status(403).json({
        success: false,
        message: "Your partner account is pending admin approval. Please wait for confirmation.",
        data: {},
        err: { message: "Account pending approval" },
      });
    }

    const userId = user._id.toString();

    let deviceStatus = "no_device_id";
    let deviceApproval = null;

    // Device approval checks only if login was successful and deviceId provided
    if (deviceId) {
      deviceApproval = await DeviceApproval.findOne({
        userId: user._id,
        deviceId: deviceId,
      });

      const existingDevicesCount = await DeviceApproval.countDocuments({
        userId: user._id,
      });

      if (!deviceApproval) {
        const isFirstDevice = existingDevicesCount === 0;

        try {
          if (!isFirstDevice) {
            await DeviceApproval.updateMany(
              { userId: user._id, isActive: true },
              { $set: { isActive: false } }
            );
          }

          deviceApproval = new DeviceApproval({
            userId: user._id,
            deviceId: deviceId,
            deviceInfo: deviceInfo,
            status: isFirstDevice ? "approved" : "pending",
            isFirstDevice: isFirstDevice,
            isActive: isFirstDevice,
            approvedAt: isFirstDevice ? new Date() : null,
          });

          await deviceApproval.save();
          deviceStatus = isFirstDevice ? "first_device_auto_approved" : "pending";

          if (!isFirstDevice) {
            await createLoginLog(user._id, deviceId, deviceInfo, "device_pending");
            return res.status(403).json({
              message: "Device approval required. Your request has been sent to admin for approval.",
              data: {},
              success: false,
              err: { message: "Device not approved", requiresApproval: true },
            });
          }
        } catch (error) {
          if (error.code === 11000) {
            await createLoginLog(user._id, deviceId, deviceInfo, "device_pending");
            return res.status(403).json({
              message: "Device approval request already exists. Please wait for admin approval.",
              data: {},
              success: false,
              err: { message: "Approval request already pending" },
            });
          }
          throw error;
        }
      } else {
        // Check existing device approval status
        if (deviceApproval.status === "pending") {
          await createLoginLog(user._id, deviceId, deviceInfo, "device_pending");
          return res.status(403).json({
            message: "Your device approval request is pending. Please wait for admin approval.",
            data: {},
            success: false,
            err: { message: "Device approval pending" },
          });
        }

        if (deviceApproval.status === "rejected") {
          await createLoginLog(user._id, deviceId, deviceInfo, "device_rejected");
          return res.status(403).json({
            message: deviceApproval.rejectionReason || "Contact admin for more information.",
            data: {},
            success: false,
            err: { message: "Device access denied" },
          });
        }

        // Check if device is active - if not, require new approval
        if (deviceApproval.status === "approved" && !deviceApproval.isActive) {
          // Device was approved before but is now inactive (another device was approved)
          // Reset to pending status and require new approval
          deviceApproval.status = "pending";
          deviceApproval.isActive = false;
          deviceApproval.approvedAt = null;
          deviceApproval.approvedBy = null;
          await deviceApproval.save();

          await createLoginLog(user._id, deviceId, deviceInfo, "device_pending");
          return res.status(403).json({
            message: "Device approval required. Another device was approved for your account. Please request approval again.",
            data: {},
            success: false,
            err: { message: "Device not active - new approval required", requiresApproval: true },
          });
        }

        deviceStatus = "approved";
      }
    }

    // Only generate tokens if everything is successful
    const { accessToken, refreshToken } = await Token.generateTokens(user);

    // Connect to Redis
    const redis = await initRedis();

    // Store tokens in Redis (no expiry)
    await redis.set(`accessToken:${accessToken}`, "valid");
    await redis.set(`refreshToken:${refreshToken}`, userId);

    // Cache user data in Redis (expires in 1 hour)
    await redis.setEx(
      `user:${userId}`,
      3600,
      JSON.stringify({
        _id: user._id,
        email: user.email,
        fullName: user.fullName,
        roles: user.roles,
        profilePicture: user.profilePicture,
        bio: user.bio,
        phone: user.phone,
        address: user.address,
        company: user.company, // <-- add company object
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
    );

    // Set tokens as HTTP-only cookies (no maxAge)
    Token.setTokensCookies(res, accessToken, refreshToken);

    // Create successful login log
    const sessionId = jwt.decode(accessToken)?.jti || accessToken.substring(0, 10);
    await createLoginLog(userId, deviceId || "unknown", deviceInfo, "success", sessionId);

    // If student has a parent referral code, fetch partner info and include in response
    let referredByPartner = null;
    let referralCode = null;
    if (user.role === 'student' && user.referredBy) {
      try {
        const partner = await User.findOne(
          { _id: user.referredBy },
          { fullName: 1, email: 1, 'company.referralCode': 1 }
        ).lean();
        if (partner) {
          referralCode = partner.company?.referralCode || null;
          referredByPartner = {
            _id: partner._id,
            fullName: partner.fullName,
            email: partner.email,
            referralCode
          };
        }
      } catch (partnerErr) {
        console.error("⚠️ Could not fetch partner referral info:", partnerErr.message);
      }
    }

    // Modified response structure
    return res.status(200).json({
      success: true,
      message: "✅ Successfully logged in",
      data: {
        user: loginResult.userObj,  // Direct user object without nesting
        accessToken,
        refreshToken,
        deviceStatus: deviceStatus,
        deviceApproval: deviceApproval ? {
          id: deviceApproval._id,
          status: deviceApproval.status,
          isFirstDevice: deviceApproval.isFirstDevice,
          isActive: deviceApproval.isActive
        } : null,
        // Referral info: only present if student was referred by a partner
        referralCode: referralCode || null,
        referredByPartner: referredByPartner || null
      },
      err: {},
    });
  } catch (err) {
    console.error("❌ Login Error:", err?.message);
    const deviceInfo = {
      platform: req.body.platform || "android",
      userAgent: req.headers["user-agent"] || "",
      ipAddress: req.ip || req.connection.remoteAddress || "",
      deviceName: req.body.deviceName || "",
      ...parseUserAgent(req.headers["user-agent"] || ""),
    };
    await createLoginLog(null, req.body.deviceId || "unknown", deviceInfo, "failed");
    return res.status(500).json({
      message: "An error occurred during login",
      data: {},
      success: false,
      err: err.message,
    });
  }
};

export const getUserById = async (req, res) => {
  try {
    // //console.log("📩 Request Params getUserById:", req.user);

    // //console.log("📩 Authenticated User:", req);

    const id = req.user?._id; // Get user ID from request params or authenticated user

    // Validate if ID is provided
    if (!id) {
      return res.status(400).json({
        message: "User ID is required",
        data: {},
        success: false,
        err: { message: "Missing user ID parameter" },
      });
    }

    // Get user by ID
    const user = await userService.getUserById(id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
        data: {},
        success: false,
        err: { message: "User with this ID does not exist" },
      });
    }

    // Remove sensitive information before sending response
    const { password, ...userResponse } = user.toObject
      ? user.toObject()
      : user;

    // Populate leaderboard for this user
    let leaderboard = null;
    try {
      leaderboard = await getUserLeaderboard(id);
    } catch (err) {
      leaderboard = null;
    }

    // Attach latest personality test result
    let personality = null;
    try {
      const PersonalitySubmission = (await import('../models/PersonalitySubmission.js')).default;
      personality = await PersonalitySubmission.findOne({ userId: user._id }).sort({ createdAt: -1 }).lean();
    } catch (e) {
      console.error('Error fetching personality submission:', e);
    }
    return res.status(200).json({
      success: true,
      message: "✅ User retrieved successfully",
      data: {
        user: {
          ...userResponse,
          leaderboard, // <-- Add leaderboard to response
          personality: personality ? {
            resultType: personality.resultType,
            scores: personality.scores,
            createdAt: personality.createdAt
          } : null
        },
      },
      err: {},
    });
  } catch (err) {
    console.error("❌ Get User By ID Error:", err);
    return res.status(500).json({
      message: err.message,
      data: {},
      success: false,
      err: err.message,
    });
  }
};

export const blockUser = async (req, res) => {
  try {
    //console.log("📩 Request Body blockUser:", req.body);

    const { userId, isActive, isBanned, banReason } = req.body;

    if (!userId || typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "User ID and isActive (boolean) are required",
        data: {},
        err: { message: "Missing or invalid required fields" },
      });
    }

    // Check if the user exists
    const user = await userService.getUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        data: {},
        err: { message: "User with this ID does not exist" },
      });
    }

    // Update isActive and ban status
    const updatedUser = await userService.blockUserById(userId, {
      isActive,
      isBanned,
      banReason: isBanned ? banReason : undefined,
    });

    //console.log(
    //   `✅ User ${isBanned ? "banned" : isActive ? "unblocked" : "blocked"
    //   } successfully:`,
    //   updatedUser._id
    // );

    // Connect to Redis
    const redis = await initRedis();

    // Update Redis cache with new user data
    const userCacheData = {
      _id: updatedUser._id,
      email: updatedUser.email,
      fullName: updatedUser.fullName,
      roles: updatedUser.roles,
      profilePicture: updatedUser.profilePicture,
      bio: updatedUser.bio,
      phone: updatedUser.phone,
      address: updatedUser.address,
      company: updatedUser.company, // <-- add company object
      education: updatedUser.education,
      skills: updatedUser.skills,
      enrolledCourses: updatedUser.enrolledCourses,
      teachingCourses: updatedUser.teachingCourses,
      qualifications: updatedUser.qualifications,
      isActive: updatedUser.isActive,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };

    // Cache updated user data (expires in 1 hour)
    await redis.setEx(`user:${userId}`, 3600, JSON.stringify(userCacheData));

    // Update user session cache if exists
    const userSessionKey = `user_session:${userId}`;
    const sessionExists = await redis.exists(userSessionKey);
    if (sessionExists) {
      await redis.setEx(userSessionKey, 3600, JSON.stringify(userCacheData));
    }

    //console.log("🗂️ Redis cache updated for user:", userId);

    return res.status(200).json({
      success: true,
      message: isBanned
        ? `User banned${banReason ? `: ${banReason}` : ""}`
        : `User ${isActive ? "unblocked" : "blocked"} successfully`,
      data: { user: updatedUser },
      err: {},
    });
  } catch (err) {
    console.error("❌ Block User Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};

export const changeUserPassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;

    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message:
          "Old password, new password, and confirm password are required",
      });
    }

    const result = await userService.changeUserPassword(
      userId,
      oldPassword,
      newPassword,
      confirmPassword
    );

    return res.status(200).json({
      success: true,
      message: result.message || "Password changed successfully",
    });
  } catch (err) {
    console.error("❌ Change password error:", err);
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to change password",
    });
  }
};

// Fixed Forgot Password Controller
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    //console.log("📩 Forgot password request for:", email);

    // Validate email
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
        data: {},
        err: { message: "Missing email field" },
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
        data: {},
        err: { message: "Invalid email format" },
      });
    }

    // Check if user exists
    const user = await userService.getUserByEmail(email);
    if (!user) {
      // Don't reveal if email exists or not for security
      return res.status(200).json({
        success: true,
        message:
          "If an account with that email exists, we've sent a password reset link.",
        data: {},
        err: {},
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is blocked. Please contact support.",
        data: {},
        err: { message: "User account is not active" },
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    //console.log("🔑 Generated reset token for user:", user.email);

    // Save reset token to database
    await userService.savePasswordResetToken(
      user._id,
      resetToken,
      resetTokenExpiry
    );

    // Send reset email
    try {
      await emailService.sendPasswordResetEmail(
        email,
        resetToken,
        user.fullName || "User"
      );
      //console.log("✅ Password reset email sent successfully");
    } catch (emailError) {
      console.error("❌ Email sending failed:", emailError);
      // Continue with success response to avoid revealing issues
    }

    return res.status(200).json({
      success: true,
      message:
        "If an account with that email exists, we've sent a password reset link.",
      data: {},
      err: {},
    });
  } catch (error) {
    console.error("❌ Forgot password error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again later.",
      data: {},
      err: error.message,
    });
  }
};

// Fixed Reset Password Controller
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    //console.log("🔄 Password reset attempt with token");

    // Validate inputs
    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Token, new password, and confirm password are required",
        data: {},
        err: { message: "Missing required fields" },
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirm password do not match",
        data: {},
        err: { message: "Password mismatch" },
      });
    }

    // Password strength validation
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
        data: {},
        err: { message: "Password too short" },
      });
    }

    // Additional password strength checks
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must contain at least one uppercase letter, one lowercase letter, and one number",
        data: {},
        err: { message: "Password not strong enough" },
      });
    }

    // Reset password using service
    const result = await userService.resetPassword(token, newPassword);

    if (result.success) {
      //console.log("✅ Password reset successful");

      return res.status(200).json({
        success: true,
        message:
          "Password has been reset successfully. You can now login with your new password.",
        data: {},
        err: {},
      });
    }
  } catch (error) {
    console.error("❌ Reset password error:", error);

    // Handle specific error types
    if (error.message.includes("Invalid or expired")) {
      return res.status(400).json({
        success: false,
        message:
          "Reset token is invalid or has expired. Please request a new password reset.",
        data: {},
        err: error.message,
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to reset password",
      data: {},
      err: error.message,
    });
  }
};

// Helper function to invalidate all user tokens
const invalidateUserTokens = async (userId) => {
  try {
    const redis = await initRedis();

    // Get all refresh token keys
    const refreshTokenKeys = await redis.keys(`refreshToken:*`);

    // Find and delete tokens belonging to this user
    for (const key of refreshTokenKeys) {
      const storedUserId = await redis.get(key);
      if (storedUserId === userId) {
        await redis.del(key);
        //console.log(`🗑️ Deleted refresh token: ${key}`);
      }
    }

    // Get all access token keys
    const accessTokenKeys = await redis.keys(`accessToken:*`);

    // Delete all access tokens (more secure approach)
    // In a production environment, you might want to maintain a user-token mapping
    for (const key of accessTokenKeys) {
      const tokenValue = await redis.get(key);
      if (tokenValue === "valid") {
        // You could implement additional logic here to check if token belongs to user
        // For now, we'll clear user-specific cache
      }
    }

    // Clear user cache
    await redis.del(`user:${userId}`);
    await redis.del(`user_session:${userId}`);

    //console.log(`🗑️ User tokens and cache cleared for: ${userId}`);
  } catch (error) {
    console.error("❌ Error invalidating user tokens:", error);
  }
};

export const deleteDocument = async (req, res) => {
  try {
    const userId = req.user._id;
    const { documentId } = req.params;

    //console.log("🗑️ Deleting document:", { userId, documentId });

    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document ID format",
        data: {},
        err: "Invalid ObjectId",
      });
    }

    const deletedDoc = await userService.deleteDocumentById(userId, documentId);

    if (!deletedDoc) {
      return res.status(404).json({
        success: false,
        message: "Document not found or already deleted",
        data: {},
        err: "Document not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Document "${deletedDoc.name}" deleted successfully`,
      data: {
        name: deletedDoc.name,
        file: deletedDoc.Doc,
      },
      err: {},
    });
  } catch (error) {
    console.error("❌ Delete document error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete document",
      data: {},
      err: error.message,
    });
  }
};

export const deleteEducation = async (req, res) => {
  try {
    const userId = req.user._id; // Extracted from JWT
    const { educationId } = req.params;

    //console.log("🗑️ Deleting education:", { userId, educationId });

    // Validate education ID format
    if (!mongoose.Types.ObjectId.isValid(educationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid education ID format",
        data: {},
        err: "Invalid ObjectId",
      });
    }

    // Call service to delete education
    const deletedEducation = await userService.deleteEducationById(
      userId,
      educationId
    );

    if (!deletedEducation) {
      return res.status(404).json({
        success: false,
        message: "Education entry not found or already deleted",
        data: {},
        err: "Education not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Education entry from "${deletedEducation.institution}" deleted successfully`,
      data: {
        institution: deletedEducation.institution,
        degree: deletedEducation.degree,
        fieldOfStudy: deletedEducation.fieldOfStudy,
      },
      err: {},
    });
  } catch (error) {
    console.error("❌ Delete education error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete education entry",
      data: {},
      err: error.message,
    });
  }
};

export const getUserDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;
    const dashboardData = await userService.getUserDashboard(
      userId,
      parseInt(page),
      parseInt(limit)
    );

    if (!dashboardData.courses.length) {
      return res.status(404).json({
        success: false,
        message: "No active courses found.",
        data: {
          allCoursesCount: dashboardData.allCoursesCount,
          activeCoursesCount: 0,
          certificatesCount: dashboardData.certificatesCount,
          courses: [],
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    console.error("Get User Dashboard Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve dashboard data",
      error: error.message,
    });
  }
};

// API: POST /logout-all-sessions
export const logoutAllSessions = async (req, res) => {
  try {
    const userId = req.body.userId || req.user?._id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID required",
        data: {},
        err: { message: "Missing user ID" }
      });
    }

    // Use the service method
    const result = await userService.logoutFromAllDevices(userId);

    return res.status(200).json({
      success: true,
      message: result.message,
      data: { userId },
      err: {}
    });
  } catch (err) {
    console.error("❌ logoutAllSessions controller error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to logout all sessions",
      data: {},
      err: err.message
    });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const requester = req.user;

    //Allow only self or admin
    const isSelf = requester._id?.toString() === userId;
    const isAdmin =
      requester.roles?.includes("admin") || requester.role === "admin";

    if (!isSelf && !isAdmin) {
      return res
        .status(403)
        .json({
          success: false,
          message: "You are not authorized to delete this user",
        });
    }

    // 1. Delete all enrollments for this user
    await CourseEnrollment.deleteMany({ userId });

    // 2. Optionally: Remove user from enrolledStudents in Course and CourseBundle
    // (If you store user IDs in those arrays)
    await Course.updateMany({}, { $pull: { enrolledStudents: userId } });
    await CourseBundle.updateMany({}, { $pull: { enrolledStudents: userId } });

    // 3. Delete the user
    const deletedUser = await User.findByIdAndDelete(userId);

    // 4. Optionally: Remove user's created courses, assignments, etc. (if required)
    await Course.deleteMany({ instructorId: userId });
    await Assignment.deleteMany({ createdBy: userId });

    return res
      .status(200)
      .json({ success: true, message: "User and related records deleted" });
  } catch (error) {
    console.error("❌ Delete User Error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to delete user",
        error: error.message,
      });
  }
};

export const getOverviewDashboard = async (req, res) => {
  try {
    //console.log("📊 Fetching overview dashboard data");

    // Allow admin, instructor, student, and partner roles (temporary for development)
    const allowedRoles = ['admin', 'instructor', 'student', 'partner'];
    const userRole = req.user.role || (req.user.roles && req.user.roles[0]);

    if (!allowedRoles.includes(userRole) && !req.user.roles?.some(r => allowedRoles.includes(r))) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin, Instructor, Student, or Partner privileges required.",
        data: {},
        err: { message: "Unauthorized access" },
      });
    }

    // If requester is a partner, return partner-scoped overview
    const isPartner = userRole === 'partner' || (Array.isArray(req.user?.roles) && req.user.roles.includes('partner'));
    const partnerId = isPartner ? req.user._id : null;

    const dashboardData = await userService.getOverviewDashboard(partnerId);

    return res.status(200).json({
      success: true,
      message: "✅ Overview dashboard data retrieved successfully",
      data: dashboardData,
      err: {},
    });
  } catch (error) {
    console.error("❌ Get Overview Dashboard Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve overview dashboard data",
      data: {},
      err: error.message,
    });
  }
};

export const banOrShadowBanUser = async (req, res) => {
  try {
    const { userId, banType, banReason } = req.body;
    if (!userId || !banType || !["ban", "shadowBan"].includes(banType)) {
      return res.status(400).json({
        success: false,
        message: "userId and banType ('ban' or 'shadowBan') are required",
        err: {},
      });
    }

    // Only admin can ban/shadow-ban
    if (!req.user.roles?.includes("admin") && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin privileges required",
        err: {},
      });
    }

    const updatedUser = await userService.banOrShadowBanUser(
      userId,
      banType,
      banReason
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        err: {},
      });
    }

    return res.status(200).json({
      success: true,
      message:
        banType === "ban"
          ? `User banned${banReason ? `: ${banReason}` : ""}`
          : `User shadow banned${banReason ? `: ${banReason}` : ""}`,
      data: { user: updatedUser },
      err: {},
    });
  } catch (err) {
    console.error("❌ Ban/ShadowBan User Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
      err: err.message,
    });
  }
};

export const unbanUser = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
        err: {},
      });
    }

    // Only admin can unban
    if (!req.user.roles?.includes("admin") && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin privileges required",
        err: {},
      });
    }

    const updatedUser = await userService.unbanUser(userId);

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        err: {},
      });
    }

    return res.status(200).json({
      success: true,
      message: "User unbanned successfully",
      data: { user: updatedUser },
      err: {},
    });
  } catch (err) {
    console.error("❌ Unban User Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
      err: err.message,
    });
  }
};

export const listDeviceApprovalRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", status } = req.query;

    // Convert query params to numbers
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    if (isNaN(pageNum) || pageNum < 1 || isNaN(limitNum) || limitNum < 1) {
      return res.status(400).json({
        message: "Invalid page or limit parameters",
        data: {},
        success: false,
        err: { message: "Page and limit must be positive numbers" },
      });
    }

    // Validate status if provided
    const allowedStatuses = ["pending", "approved", "rejected"];
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status parameter",
        data: {},
        success: false,
        err: { message: "Status must be one of: pending, approved, rejected" },
      });
    }

    // Build search query
    const searchQuery = {};
    if (search) {
      searchQuery.$or = [
        { deviceId: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
        { "deviceInfo.platform": { $regex: search, $options: "i" } },
        { "deviceInfo.deviceName": { $regex: search, $options: "i" } },
      ];
    }
    if (status) {
      searchQuery.status = status;
    }

    // Get total count of matching documents
    const totalDocuments = await DeviceApproval.countDocuments(searchQuery);

    // Fetch device approvals with pagination, user population, and sort desc
    const deviceApprovals = await DeviceApproval.find(searchQuery)
      .populate("userId")
      .select(
        "_id userId deviceId deviceInfo status requestedAt approvedAt approvedBy isActive isFirstDevice"
      )
      .sort({ requestedAt: -1 }) // <-- sort by requestedAt descending
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    // If search query is provided, filter by user fields (email, name)
    if (search) {
      const userSearchQuery = {
        $or: [
          { email: { $regex: search, $options: "i" } },
          { name: { $regex: search, $options: "i" } },
        ],
      };
      const matchingUsers = await User.find(userSearchQuery)
        .select("_id")
        .lean();
      const matchingUserIds = matchingUsers.map((user) => user._id);
      if (matchingUserIds.length > 0) {
        const userFilteredApprovals = await DeviceApproval.find({
          ...searchQuery,
          userId: { $in: matchingUserIds },
        })
          .populate("userId")
          .select(
            "_id userId deviceId deviceInfo status requestedAt approvedAt approvedBy isActive isFirstDevice"
          )
          .sort({ requestedAt: -1 }) // <-- sort by requestedAt descending
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum)
          .lean();

        // Combine results, avoiding duplicates
        const combinedApprovals = [
          ...deviceApprovals,
          ...userFilteredApprovals,
        ];
        const uniqueApprovals = Array.from(
          new Map(
            combinedApprovals.map((item) => [item._id.toString(), item])
          ).values()
        );

        return res.status(200).json({
          success: true,
          message: "✅ Device approval requests retrieved successfully",
          data: {
            deviceApprovals: uniqueApprovals,
            total:
              totalDocuments +
              (matchingUsers.length > 0
                ? await DeviceApproval.countDocuments({
                  userId: { $in: matchingUserIds },
                })
                : 0),
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(totalDocuments / limitNum),
          },
          err: {},
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "✅ Device approval requests retrieved successfully",
      data: {
        deviceApprovals,
        total: totalDocuments,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalDocuments / limitNum),
      },
      err: {},
    });
  } catch (err) {
    console.error(
      "❌ Error retrieving device approval requests:",
      err?.message
    );
    return res.status(500).json({
      message: "Failed to retrieve device approval requests",
      data: {},
      success: false,
      err: err.message,
    });
  }
};

// Approve a device approval request
export const manageDeviceRequest = async (req, res) => {
  try {
    const { deviceApprovalId, status, rejectionReason } = req.body;
    const adminId = req.user._id; // Assuming req.user is set by passport middleware

    // Validate inputs
    if (!deviceApprovalId) {
      return res.status(400).json({
        message: "Device approval ID is required",
        data: {},
        success: false,
        err: { message: "Missing required field" },
      });
    }

    if (!status || !["approve", "reject"].includes(status)) {
      return res.status(400).json({
        message: "Status must be 'approve' or 'reject'",
        data: {},
        success: false,
        err: { message: "Invalid status" },
      });
    }

    if (status === "reject" && !rejectionReason) {
      return res.status(400).json({
        message: "Rejection reason is required for rejecting a device",
        data: {},
        success: false,
        err: { message: "Missing rejection reason" },
      });
    }

    const deviceApproval = await DeviceApproval.findById(deviceApprovalId);
    if (!deviceApproval) {
      return res.status(404).json({
        message: "Device approval request not found",
        data: {},
        success: false,
        err: { message: "Device approval not found" },
      });
    }

    if (deviceApproval.status !== "pending") {
      return res.status(400).json({
        message: `Device is already ${deviceApproval.status}`,
        data: {},
        success: false,
        err: { message: `Device already ${deviceApproval.status}` },
      });
    }

    // Handle approve or reject
    if (status === "approve") {
      // Deactivate all other devices for the same user
      await DeviceApproval.updateMany(
        { userId: deviceApproval.userId, isActive: true },
        { $set: { isActive: false } }
      );

      // Approve the device
      deviceApproval.status = "approved";
      deviceApproval.isActive = true;
      deviceApproval.approvedAt = new Date();
      deviceApproval.approvedBy = adminId;
      deviceApproval.rejectionReason = null; // Clear any previous rejection reason
    } else {
      // Reject the device
      deviceApproval.status = "rejected";
      deviceApproval.isActive = false;
      deviceApproval.approvedAt = null;
      deviceApproval.approvedBy = adminId;
      deviceApproval.rejectionReason = rejectionReason;
    }

    await deviceApproval.save();

    // Log the action in LoginLog
    const deviceInfo = deviceApproval.deviceInfo || {};
    const logStatus =
      status === "approve" ? "device_approved" : "device_rejected";
    await createLoginLog(
      deviceApproval.userId,
      deviceApproval.deviceId,
      deviceInfo,
      logStatus
    );

    return res.status(200).json({
      success: true,
      message: `✅ Device approval request ${status}d successfully`,
      data: { deviceApproval },
      err: {},
    });
  } catch (err) {
    console.error(
      `❌ Error ${status === "approve" ? "approving" : "rejecting"
      } device request:`,
      err?.message
    );
    return res.status(500).json({
      message: `Failed to ${status === "approve" ? "approve" : "reject"
        } device request`,
      data: {},
      success: false,
      err: err.message,
    });
  }
};

// Add this to your routes file
export const searchUsers = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Authentication failed" });
    }

    const { q } = req.query;
    const currentUserId = req.user._id;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ message: "Search query is required" });
    }

    // Search users by name or email, exclude current user
    const users = await User.find({
      _id: { $ne: currentUserId },
      $or: [
        { fullName: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ],
    })
      .select("fullName email")
      .limit(20)
      .lean();

    return res.status(200).json({
      message: "Users found successfully",
      users,
    });
  } catch (error) {
    console.error("Search users error:", error);
    return res.status(500).json({ message: "Failed to search users" });
  }
};


export const sendOtpviaemail = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
        data: {},
        err: { message: "Missing email field" },
      });
    }

    //check email already exist and verify 

    const user = await userService.getUserByEmail(email);
    if (user && user.is_verify) {
      return res.status(400).json({
        success: false,
        is_exist: true,
        is_verify: user.is_verify,
        message: "Email is already registered and verified please login",
        data: {},
        err: { message: "Email is already registered and verified please login" },
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        is_exist: false,
        is_verify: false,
        message: "Please provide a valid email address",
        data: {},
        err: { message: "Invalid email format" },
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Connect to Redis
    const redis = await initRedis();

    // Store OTP in Redis with 10-minute expiration
    await redis.setEx(`otp:${email}`, 600, otp);

    // Send OTP email
    try {
      await emailService.sendOtpEmail(email, otp);
      //console.log("✅ OTP email sent successfully");
    } catch (emailError) {
      console.error("❌ Email sending failed:", emailError);
      // Continue with success to avoid revealing issues
    }

    return res.status(200).json({
      success: true,
      is_exist: user ? true : false,
      is_verify: user ? user.is_verify : false,
      message: "OTP has been sent to the provided email.",
      data: {},
      err: {},
    });
  } catch (error) {
    console.error("❌ Send OTP error:", error);
    return res.status(500).json({
      success: false,
      is_exist: false,
      is_verify: false,
      message: "Something went wrong. Please try again later.",
      data: {},
      err: error.message,
    });
  }
};

export const googleLogin = async (req, res) => {
  try {
    const { email, password, fullName, deviceId, platform } = req.body;

    // Validate input
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({
        message: "Please enter a valid email address",
        success: false,
        err: { email: "Invalid email format" },
      });
    }

    if (!deviceId) {
      return res.status(400).json({
        message: "deviceId required",
        success: false,
      });
    }

    // Build device info same as login
    const deviceInfo = {
      platform: platform || "android",
      userAgent: req.headers["user-agent"] || "",
      ipAddress: req.ip || req.connection.remoteAddress || "",
      deviceName: req.body.deviceName || "",
      ...parseUserAgent(req.headers["user-agent"] || "")
    };

    // Google signup or find user
    const newUser = await userService.googlesignup(
      { email, password, fullName, role: "student", is_verify: true },
      res
    );

    const userId = newUser._id.toString();
    // DEVICE APPROVAL CHECK (same as login)

    let deviceStatus = "no_device_id";
    let deviceApproval = null;

    // Count total devices for this user
    const totalDeviceCount = await DeviceApproval.countDocuments({ userId });

    // Check if this particular deviceId exists already
    deviceApproval = await DeviceApproval.findOne({ userId, deviceId });

    if (!deviceApproval) {
      const isFirstDevice = totalDeviceCount === 0;

      try {
        if (!isFirstDevice) {
          // Make all old devices inactive
          await DeviceApproval.updateMany(
            { userId, isActive: true },
            { $set: { isActive: false } }
          );
        }

        // Create this user's device entry
        deviceApproval = new DeviceApproval({
          userId,
          deviceId,
          deviceInfo,
          status: isFirstDevice ? "approved" : "pending",
          isFirstDevice,
          isActive: isFirstDevice,
          approvedAt: isFirstDevice ? new Date() : null,
        });

        await deviceApproval.save();
        deviceStatus = isFirstDevice ? "first_device_auto_approved" : "pending";

        if (!isFirstDevice) {
          return res.status(403).json({
            success: false,
            message:
              "Device approval required. Your request has been sent to admin.",
            err: { requiresApproval: true },
            data: {},
          });
        }
      } catch (error) {
        if (error.code === 11000) {
          return res.status(403).json({
            success: false,
            message:
              "Device approval request already exists. Please wait for admin approval.",
            err: { message: "Approval request already pending" },
            data: {},
          });
        }
        throw error;
      }
    } else {
      // If the device exists

      if (deviceApproval.status === "pending") {
        return res.status(403).json({
          success: false,
          message: "Your device approval request is pending.",
          err: { message: "Device approval pending" },
          data: {},
        });
      }

      if (deviceApproval.status === "rejected") {
        return res.status(403).json({
          success: false,
          message:
            deviceApproval.rejectionReason ||
            "Your device was rejected. Contact admin.",
          err: { message: "Device access denied" },
          data: {},
        });
      }

      if (deviceApproval.status === "approved" && !deviceApproval.isActive) {
        // The approved device is no longer active
        deviceApproval.status = "pending";
        deviceApproval.isActive = false;
        deviceApproval.approvedAt = null;
        deviceApproval.approvedBy = null;
        await deviceApproval.save();

        return res.status(403).json({
          success: false,
          message:
            "Device approval required again. Another device is currently active.",
          err: { requiresApproval: true },
          data: {},
        });
      }

      deviceStatus = "approved";
    }
    // Now generate tokens ONLY if approved

    const { accessToken, refreshToken } = await Token.generateTokens(newUser);

    const redis = await initRedis();

    await redis.set(`accessToken:${accessToken}`, "valid");
    await redis.set(`refreshToken:${refreshToken}`, userId);

    await redis.setEx(
      `user:${userId}`,
      3600,
      JSON.stringify({
        _id: newUser._id,
        email: newUser.email,
        fullName: newUser.fullName,
        roles: newUser.roles,
        profilePicture: newUser.profilePicture,
        bio: newUser.bio,
        phone: newUser.phone,
        address: newUser.address,
        company: newUser.company,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
        is_verify: newUser.is_verify,
      })
    );

    Token.setTokensCookies(res, accessToken, refreshToken);

    return res.status(200).json({
      success: true,
      message: "Google login successful",
      data: {
        user: newUser,
        accessToken,
        refreshToken,
        deviceStatus,
        deviceApproval: deviceApproval
          ? {
            id: deviceApproval._id,
            status: deviceApproval.status,
            isFirstDevice: deviceApproval.isFirstDevice,
            isActive: deviceApproval.isActive,
          }
          : null,
      },
    });
  } catch (err) {
    return res.status(500).json({
      message: "Google login error",
      success: false,
      err: err.message,
    });
  }
};



export const requestManualPartnerPayment = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      console.error("❌ Manual Payment Error: No userId in req.user");
      return res.status(401).json({ success: false, message: "User authentication failed. Please re-login." });
    }
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.role !== 'partner') {
      return res.status(403).json({ success: false, message: "Only partners can request manual payment" });
    }

    if (user.registrationPayment?.status === 'completed') {
       return res.status(400).json({ success: false, message: "Registration payment is already completed." });
    }

    const { courseId, planId, transactionId } = req.body;
    let registrationFee = await Setting.getPartnerRegistrationFee();

    if (courseId && planId) {
      const plan = await CoursePlan.findOne({ _id: planId, courseId });
      if (plan) {
        registrationFee = plan.salePrice || plan.price;
      }
    }

    const GST_RATE = await Setting.getGstRate();
    const tax = parseFloat((registrationFee * GST_RATE).toFixed(2));
    const grandTotal = parseFloat((registrationFee + tax).toFixed(2));

    if (grandTotal <= 0) {
       return res.status(400).json({ success: false, message: "Payment amount is 0, cannot request payment." });
    }

    const orderNo = await generateOrderNumber();

    // Create Order document for admin visibility
    const newOrder = await Order.create({
      orderNo,
      userId,
      items: [{
        courseId,
        coursePlanId: planId,
        type: 'partnerRegistration',
        pricePaid: registrationFee,
        currency: 'INR'
      }],
      subTotal: registrationFee,
      tax,
      gstRate: GST_RATE,
      grandTotal,
      payment: {
        provider: 'manual',
        paymentIntent: transactionId || "MANUAL_PENDING",
        status: 'pending'
      }
    });

    console.log(`✅ Order created for manual payment: ${newOrder.orderNo} for user ${userId}`);

    user.status = 'pending_approval';
    user.registrationPayment = {
      ...user.registrationPayment,
      courseId,
      planId,
      transactionId: transactionId || "MANUAL_PENDING",
      amount: grandTotal,
      method: 'manual',
      status: 'pending',
      paidAt: null
    };
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Manual payment request submitted successfully. It will be reviewed by admin in orders section.",
      data: {
        registrationPayment: user.registrationPayment,
        order: newOrder
      }
    });
  } catch (error) {
    console.error("❌ Manual Payment Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit manual payment request",
      err: error.message
    });
  }
};

export const verifyOtpviaemail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Validate inputs
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
        data: {},
        err: { message: "Missing required fields" },
      });
    }

    // Connect to Redis
    const redis = await initRedis();

    // Get stored OTP
    const storedOtp = await redis.get(`otp:${email}`);

    if (!storedOtp) {
      return res.status(400).json({
        success: false,
        message: "OTP is invalid or expired",
        data: {},
        err: { message: "Invalid or expired OTP" },
      });
    }

    if (storedOtp !== otp.toString()) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
        data: {},
        err: { message: "OTP mismatch" },
      });
    }

    // Delete OTP from Redis after successful verification
    await redis.del(`otp:${email}`);

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      data: {},
      err: {},
    });
  } catch (error) {
    console.error("❌ Verify OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify OTP",
      data: {},
      err: error.message,
    });
  }
};

// Update user role (Admin only)
export const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
        data: {},
        err: { message: 'userId is required' },
      });
    }

    if (!role || !['admin', 'instructor', 'student'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Valid role is required (admin, instructor, or student)',
        data: {},
        err: { message: 'Invalid role' },
      });
    }

    const user = await userService.getUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        data: {},
        err: {},
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    ).select('-password');

    return res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      data: { user: updatedUser },
      err: {},
    });
  } catch (error) {
    console.error('❌ Update User Role Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {},
      err: error.message,
    });
  }
};

export const initiatePartnerPayment = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      console.error("❌ Cashfree Payment Error: No userId in req.user");
      return res.status(401).json({ success: false, message: "User authentication failed. Please re-login." });
    }
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.role !== 'partner') {
      return res.status(403).json({ success: false, message: "Only partners can initiate this payment" });
    }

    if (user.registrationPayment?.status === 'completed') {
       return res.status(400).json({ success: false, message: "Registration payment is already completed." });
    }

    const { courseId, planId } = req.body;
    let registrationFee = await Setting.getPartnerRegistrationFee();

    if (courseId && planId) {
      const plan = await CoursePlan.findOne({ _id: planId, courseId });
      if (plan) {
        registrationFee = plan.salePrice || plan.price;
      }
    }

    const GST_RATE = await Setting.getGstRate();
    const tax = parseFloat((registrationFee * GST_RATE).toFixed(2));
    const grandTotal = parseFloat((registrationFee + tax).toFixed(2));

    if (grandTotal <= 0) {
       return res.status(400).json({ success: false, message: "Payment amount is 0, cannot initiate payment." });
    }

    const cfHeaders = await getCashfreeHeaders();
    const cfBaseUrl = getCashfreeBaseUrl();
    const cashfreeOrderId = `partner_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // Sanitize customer phone (Cashfree requires a clean 10-digit number)
    let sanitizedPhone = (user.phone || "9999999999").replace(/\D/g, '');
    if (sanitizedPhone.length > 10) {
      sanitizedPhone = sanitizedPhone.slice(-10);
    } else if (sanitizedPhone.length < 10) {
      sanitizedPhone = "9999999999"; // Fallback if invalid
    }

    const orderNo = await generateOrderNumber();

    // Create Order document for admin visibility
    const newOrder = await Order.create({
      orderNo,
      userId,
      items: [{
        courseId,
        coursePlanId: planId,
        type: 'partnerRegistration',
        pricePaid: registrationFee,
        currency: 'INR'
      }],
      subTotal: registrationFee,
      tax,
      gstRate: GST_RATE,
      grandTotal,
      payment: {
        provider: 'cashfree',
        paymentIntent: cashfreeOrderId,
        status: 'pending' // Will be verified via webhook/verify API
      }
    });

    console.log(`✅ Order created for Cashfree payment: ${newOrder.orderNo} for user ${userId}`);

    user.status = 'pending_approval';
    user.registrationPayment = {
      ...user.registrationPayment,
      courseId,
      planId,
      transactionId: cashfreeOrderId,
      amount: grandTotal,
      method: 'online',
      status: 'pending'
    };
    await user.save();

    const cfPayload = {
      order_amount: grandTotal,
      order_currency: "INR",
      order_id: cashfreeOrderId,
      customer_details: {
        customer_id: `cust_${userId}`,
        customer_phone: sanitizedPhone,
        customer_email: user.email,
        customer_name: user.fullName?.replace(/[^\w\s]/gi, '') || "Partner User"
      },
      order_meta: {
        return_url: `${process.env.FRONTEND_URL || 'https://dipaniglobaledu.com'}/payment-success?order_id={order_id}&type=partner_registration`,
        notify_url: `${process.env.BACKEND_URL || 'https://api.dipaniglobaledu.com'}/api/checkout/verify-cashfree`
      },
      order_note: "Partner Registration Fee"
    };

    console.log("🚀 Initiating Cashfree Partner Payment:", JSON.stringify(cfPayload, null, 2));

    try {
      const cfResponse = await axiosCf.post(`${cfBaseUrl}/orders`, cfPayload, { 
        headers: cfHeaders,
        timeout: 45000 // 45 seconds timeout to prevent 504 Gateway Timeout
      });

      if (cfResponse.data && cfResponse.data.payment_session_id) {
        return res.status(200).json({
          success: true,
          message: "Payment session created",
          data: cfResponse.data
        });
      } else {
          throw new Error("Invalid response structure from Cashfree");
      }
    } catch (cfError) {
      console.error("❌ Cashfree API Post Error:", cfError.response?.data || cfError.message);
      throw cfError; // Re-throw to be caught by the outer catch block
    }

  } catch (error) {
    console.error("❌ Cashfree Session Error (initiatePartnerPayment):", error?.response?.data || error.message);
    return res.status(500).json({
      message: "Failed to initiate payment session",
      success: false,
      err: error.response?.data?.message || error.message
    });
  }
};



