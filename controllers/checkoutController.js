import mongoose from 'mongoose';

// Helper to safely find CoursePlan with fallback support
const safeFindCoursePlan = async (CoursePlan, planId, courseId = null, lean = false) => {
  const findId = (planId && typeof planId === 'object' && planId.toString) ? planId.toString() : planId;
  if (typeof findId === 'string' && findId.startsWith('fallback-')) {
    return { _id: findId, courseId: courseId || findId.replace('fallback-', ''), status: 'active' };
  }
  if (!mongoose.Types.ObjectId.isValid(findId)) return null;
  const query = CoursePlan.findById(findId);
  return lean ? await query.lean() : await query;
};


import Cart from "../models/Cart.js";
import Order from "../models/Order.js";
import CourseEnrollment from "../models/CourseEnrollment.js";
import Course from "../models/Course.js";
import CourseBundle from "../models/CourseBundle.js";
import Coupon from "../models/Coupon.js";
import { generateOrderNumber } from "../utils/generateOrderNo.js";
import LessonProgress from "../models/LessonProgress.js";
import Certificate from "../models/Certificate.js";
import UserService from "../service/userService.js";
import User from "../models/user.js";
import { Token } from "../utils/index.js"; // contains generateToken, setTokensCookies, etc.
import { initRedis } from "../config/redisClient.js";
import emailService from '../utils/emailService.js';
import notificationService from '../utils/notificationService.js';
import jwt from 'jsonwebtoken';
import Setting from "../models/setting.js";
import fcmTokenss from "../models/fcmTokens.js";
import Notification from "../models/Notifications.js";
import user from "../models/user.js";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import puppeteer from "puppeteer";
// import getRazorpayInstance from "../config/razorpay.js"; // ← Razorpay (commented out)
import { getCashfreeHeaders, getCashfreeBaseUrl } from "../config/cashfree.js";
import axiosCf from 'axios'; // used for Cashfree REST calls
import axios from 'axios';
import VideoLesson from '../models/video.js';
import xlsx from "xlsx";
import courseCompletionService from '../service/CourseCompletionService.js';
import CourseChatRoom from "../models/CourseChatRoom.js";
import Ebook from "../models/Ebook.js"; // Added Ebook import


const userService = new UserService();

// Helper function to get partner referral info for a user
const getPartnerReferralInfo = async (userId) => {
  try {
    const user = await User.findById(userId).select('referredBy company.referralCode');
    if (!user || !user.referredBy) {
      return null;
    }

    const partner = await User.findById(user.referredBy)
      .select('fullName email company.referralCode')
      .lean();

    if (!partner) {
      return null;
    }

    return {
      partnerId: partner._id,
      referralCode: partner.company?.referralCode || user.company?.referralCode || null,
      partnerName: partner.fullName,
      partnerEmail: partner.email
    };
  } catch (error) {
    console.error("Error fetching partner referral info:", error);
    return null;
  }
};

// Helper to render invoice HTML
function renderInvoiceHtml(order, guestUser, company) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <title>Lapaas Invoice</title>
    <style>
      * { 
        box-sizing: border-box; 
        margin: 0;
        padding: 0;
      }
      
      body { 
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: white;
        color: #1e293b;
        line-height: 1.5;
        font-size: 14px;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }
      
      .invoice-wrapper {
        width: 100%;
        max-width: 210mm;
        margin: 0 auto;
        background: white;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        padding: 0;
      }
      
      .invoice-header {
        background: #B1E346;
        color: #1e293b;
        padding: 20px 40px;
        border-bottom: 3px solid #9DD333;
      }
      
      .header-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
      }
      
      .company-info h1 {
        font-size: 1.8rem;
        font-weight: 800;
        margin-bottom: 2px;
        letter-spacing: -0.02em;
        color: #1e293b;
      }
      
      .company-tagline {
        font-size: 0.85rem;
        font-weight: 500;
        color: #374151;
      }
      
      .invoice-details {
        text-align: right;
      }
      
      .invoice-number {
        font-size: 1.1rem;
        font-weight: 700;
        margin-bottom: 2px;
        color: #1e293b;
      }
      
      .invoice-date {
        font-size: 0.9rem;
        color: #374151;
        font-weight: 500;
      }
      
      .invoice-body {
        padding: 40px;
        flex: 1;
        width: 100%;
      }
      
      .billing-section {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 40px;
        margin-bottom: 20px;
        width: 100%;
      }
      
      .billing-card {
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 24px;
        background: #fafafa;
      }
      
      .billing-card h3 {
        color: #1e293b;
        font-size: 1rem;
        font-weight: 700;
        margin-bottom: 16px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border-bottom: 2px solid #B1E346;
        padding-bottom: 8px;
        display: inline-block;
      }
      
      .billing-item {
        margin-bottom: 10px;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }
      
      .billing-label {
        font-size: 0.85rem;
        font-weight: 600;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        min-width: 80px;
      }
      
      .billing-value {
        color: #1e293b;
        font-weight: 500;
        text-align: right;
        flex: 1;
        word-break: break-all;
      }
      
      .items-section {
        margin-bottom: 20px;
        width: 100%;
      }
      
      .items-title {
        font-size: 1.2rem;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 20px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .items-table {
        width: 100%;
        border-collapse: collapse;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        overflow: hidden;
      }
      
      .items-table th {
        background: #f3f4f6;
        color: #1e293b;
        padding: 14px 16px;
        text-align: left;
        font-weight: 700;
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        border-bottom: 2px solid #B1E346;
      }
      
      .items-table td {
        padding: 14px 16px;
        border-bottom: 1px solid #f3f4f6;
        vertical-align: middle;
        font-size: 0.9rem;
      }
      
      .items-table tbody tr:last-child td {
        border-bottom: none;
      }
      
      .items-table tbody tr:hover {
        background: #f9fafb;
      }
      
      .item-badge {
        display: inline-flex;
        align-items: center;
        padding: 3px 10px;
        border-radius: 4px;
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .badge-course {
        background: #dcfce7;
        color: #16a34a;
        border: 1px solid #bbf7d0;
      }
      
      .badge-bundle {
        background: rgba(177, 227, 70, 0.15);
        color: #65a30d;
        border: 1px solid #B1E346;
      }
      
      .item-code {
        font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
        background: #f1f5f9;
        padding: 3px 6px;
        border-radius: 3px;
        font-size: 0.8rem;
        color: #475569;
        font-weight: 600;
      }
      
      .price-cell {
        font-weight: 700;
        color: #1e293b;
        font-size: 0.95rem;
      }
      
      .summary-section {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: flex-start;
        width: 100%;
        margin-top: auto;
        padding-top: 20px;
        gap: 15px;
      }
      
      .payment-info {
        flex: 1;
        width: 100%;
      }
      
      .payment-info h4 {
        font-size: 1rem;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 12px;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }
      
      .payment-detail {
        margin-bottom: 8px;
        display: flex;
        justify-content: space-between;
        font-size: 0.9rem;
      }
      
      .payment-label {
        color: #6b7280;
        font-weight: 600;
      }
      
      .payment-value {
        color: #1e293b;
        font-weight: 500;
      }
      
      .summary-card {
        background: #fafafa;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 14px;
        min-width: 100%;
      }
      
      .summary-title {
        font-size: 1rem;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 16px;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        text-align: center;
        border-bottom: 2px solid #B1E346;
        padding-bottom: 8px;
      }
      
      .summary-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        font-size: 0.9rem;
      }
      
      .summary-row:not(:last-child) {
        border-bottom: 1px solid #f3f4f6;
      }
      
      .summary-row:last-child {
        border-top: 2px solid #B1E346;
        margin-top: 12px;
        padding-top: 16px;
        font-weight: 700;
        font-size: 1.1rem;
        color: #16a34a;
        /* background: rgba(177, 227, 70, 0.1); */
        margin-left: -24px;
        margin-right: -24px;
        padding-left: 24px;
        padding-right: 24px;
        border-radius: 0 0 4px 4px;
      }
      
      .summary-label {
        color: #6b7280;
        font-weight: 600;
      }
      
      .summary-value {
        font-weight: 700;
        color: #1e293b;
      }
      
      .invoice-footer {
        background: #1e293b;
        color: white;
        padding: 16px 40px;
        text-align: center;
        margin-top: auto;
        width: 100%;
      }
      
      .footer-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        max-width: 100%;
      }
      
      .footer-left {
        text-align: left;
      }
      
      .footer-right {
        text-align: right;
      }
      
      .footer-text {
        font-size: 0.95rem;
        font-weight: 600;
        margin-bottom: 4px;
      }
      
      .support-info {
        font-size: 0.85rem;
        opacity: 0.9;
      }
      
      .support-email {
        color: #B1E346;
        text-decoration: none;
        font-weight: 600;
      }
      
      .support-email:hover {
        text-decoration: underline;
      }
      
      /* Print optimizations */
      @media print {
        body {
          background: white;
          font-size: 12px;
          margin: 0;
          padding: 0;
        }
        
        .invoice-wrapper {
          max-width: none;
          margin: 0;
          padding: 0;
          box-shadow: none;
          min-height: 100vh;
        }
        
        .invoice-header {
          background: #B1E346 !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        
        .invoice-footer {
          position: absolute;
          bottom: 0;
          width: 100%;
          margin-top: 0;
        }
        
        .invoice-body {
          padding-bottom: 80px;
        }
      }
      
      @media (max-width: 768px) {
        .invoice-header,
        .invoice-body,
        .invoice-footer {
          padding-left: 20px;
          padding-right: 20px;
        }
        
        .billing-section {
          grid-template-columns: 1fr;
          gap: 20px;
        }
        
        .summary-section {
          flex-direction: column;
        }
        
        .summary-card {
          margin-left: 0;
          margin-top: 20px;
          min-width: auto;
        }
        
        .footer-content {
          flex-direction: column;
          gap: 10px;
        }
        
        .footer-left,
        .footer-right {
          text-align: center;
        }
      }
    </style>
  </head>
  <body>
    <div class="invoice-wrapper">
      <header class="invoice-header">
        <div class="header-content">
          <div class="company-info">
            <h1>Lapaas</h1>
            <p class="company-tagline">Educational Excellence Platform</p>
          </div>
          <div class="invoice-details">
            <div class="invoice-number">Invoice #${order.orderNo}</div>
            <div class="invoice-date">${order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : ""}</div>
          </div>
        </div>
      </header>
      
      <main class="invoice-body">
        <div class="billing-section">
          <div class="billing-card">
            <h3>Student Details</h3>
            <div class="billing-item">
              <span class="billing-label">Name:</span>
              <div class="billing-value">${guestUser.fullName}</div>
            </div>
            <div class="billing-item">
              <span class="billing-label">Email:</span>
              <div class="billing-value">${guestUser.email}</div>
            </div>
          </div>
          
          ${company && company.name ? `
          <div class="billing-card">
            <h3>Company Details</h3>
            ${company.name ? `
            <div class="billing-item">
              <span class="billing-label">Company:</span>
              <div class="billing-value">${company.name}</div>
            </div>
            ` : ""}
          </div>
          ` : `
          <div class="billing-card">
            <h3>Payment Status</h3>
            <div class="billing-item">
              <span class="billing-label">Status:</span>
              <div class="billing-value">âœ… Completed</div>
            </div>
            <div class="billing-item">
              <span class="billing-label">Method:</span>
              <div class="billing-value">Online Payment</div>
            </div>
          </div>
          `}
        </div>
        
        <div class="items-section">
          <h3 class="items-title">Learning Items</h3>
          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 50px;">#</th>
                <th>Item Type</th>
                <th style="width: 160px;">Item ID</th>
                <th style="width: 120px;">Price</th>
                <th style="width: 100px;">Currency</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map((item, idx) => `
                <tr>
                  <td><strong>${idx + 1}</strong></td>
                  <td>
                    <span class="item-badge ${item.type === "course" ? "badge-course" : "badge-bundle"}">
                      ${item.type === "course" ? "Course" : "Bundle"}
                    </span>
                  </td>
                  <td><span class="item-code">${item.courseId || item.courseBundleId}</span></td>
                  <td class="price-cell">â‚¹${parseFloat(item.pricePaid).toFixed(2)}</td>
                  <td>${item.currency}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
        
        <div class="summary-section">
          <div class="payment-info">
            <h4>Payment Information</h4>
            <div class="payment-detail">
              <span class="payment-label">Payment Method:</span>
              <span class="payment-value">Online Payment</span>
            </div>
            <div class="payment-detail">
              <span class="payment-label">Transaction Status:</span>
              <span class="payment-value">Completed</span>
            </div>
            <div class="payment-detail">
              <span class="payment-label">Invoice Date:</span>
              <span class="payment-value">${order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-US') : ""}</span>
            </div>
          </div>
          
          <div class="summary-card">
            <h3 class="summary-title">Payment Summary</h3>
            <div class="summary-row">
              <span class="summary-label">Subtotal</span>
              <span class="summary-value">â‚¹${parseFloat(order.subTotal).toFixed(2)}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Discount</span>
              <span class="summary-value">-â‚¹${parseFloat(order.discount).toFixed(2)}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Total Amount</span>
              <span class="summary-value">â‚¹${parseFloat(order.grandTotal).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </main>
      
      <footer class="invoice-footer">
        <div class="footer-content">
          <div class="footer-left">
            <div class="footer-text">Thank you for choosing Lapaas! ðŸŽ“</div>
            <div class="support-info">Your trusted learning partner</div>
          </div>
          <div class="footer-right">
            <div class="footer-text">Need Support?</div>
            <div class="support-info">
              Contact us at <a href="mailto:support@lapaas.com" class="support-email">support@lapaas.com</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  </body>
  </html>
  `;
}

// Helper to generate PDF buffer from HTML using puppeteer
async function htmlToPdfBuffer(html) {
  let browser;
  try {
    const launchOptions = {
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
      ],
    };

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    //console.log("Launching puppeteer for invoice PDF generation...");
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    await page.setViewport({ width: 1122, height: 794, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "networkidle0" });
    const buffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    //console.log("Invoice PDF buffer generated successfully.");
    return buffer;
  } catch (err) {
    console.error("Error generating invoice PDF:", err?.message);
    throw new Error("Failed to generate invoice PDF");
  } finally {
    if (browser) await browser.close();
  }
}

export const checkout = async (req, res) => {
  const userId = req.user._id;
  const { couponCode, paymentProvider = "cashfree" } = req.body;

  try {
    // Validate Content-Type
    if (!req.is('application/json')) {
      return res.status(400).json({ message: "Content-Type must be application/json" });
    }

    // Step 1: Get cart
    const cart = await Cart.findOne({ userId })
      .populate("items.courseId")
      .populate("items.courseBundleId");
    if (!cart || !cart.items.length) {
      return res.status(400).json({ message: "Your cart is empty." });
    }

    // Step 2: Build order items and calculate subtotal
    let subTotal = 0;
    const items = [];
    const courseIdsToEnroll = new Set();

    for (const item of cart.items) {
      // Use salePrice if available
      let price = item.priceSnapshot;
      if (item.type === "course" && item.courseId && item.courseId.salePrice) {
        price = parseFloat(item.courseId.salePrice.toString());
      } else if (item.type === "course" && item.courseId && item.courseId.discountPrice) {
        price = parseFloat(item.courseId.discountPrice.toString());
      } else {
        price = parseFloat(item.priceSnapshot.toString());
      }
      subTotal += price;

      if (item.type === "course" && item.courseId) {
        items.push({
          courseId: item.courseId._id,
          type: "course",
          pricePaid: price,
          currency: item.currency || "INR",
        });
        courseIdsToEnroll.add(item.courseId._id.toString());
      } else if (item.type === "courseBundle" && item.courseBundleId) {
        items.push({
          courseBundleId: item.courseBundleId._id,
          type: "courseBundle",
          pricePaid: price,
          currency: item.currency || "INR",
        });
        const bundle = await CourseBundle.findById(item.courseBundleId).populate("courses");
        if (!bundle || !bundle.courses) {
          throw new Error(`Course bundle ${item.courseBundleId} or its courses not found`);
        }
        bundle.courses.forEach((course) => courseIdsToEnroll.add(course._id.toString()));
      } else {
        throw new Error(`Invalid cart item: type=${item.type}, courseId=${item.courseId}, courseBundleId=${item.courseBundleId}`);
      }
    }

    // Step 3: Apply coupon
    let discount = 0;
    if (couponCode) {
      const validationResult = await validateCoupon(couponCode, subTotal, userId);
      discount = validationResult.discountAmount;

      const coupon = await Coupon.findById(validationResult.coupon._id);
      if (!coupon) {
        throw new Error("Coupon not found");
      }

      const userIndex = coupon.usedBy.findIndex(
        (user) => user.userId.toString() === userId.toString()
      );

      if (userIndex !== -1) {
        coupon.usedBy[userIndex].usageCount += 1;
      } else {
        coupon.usedBy.push({ userId: userId, usageCount: 1 });
      }

      await coupon.save();
    }

    const taxableAmount = subTotal - discount;
    const tax = 0; // GST removed
    const grandTotal = parseFloat(taxableAmount.toFixed(2)); 
    const GST_RATE = 0; // GST removed

    // Step 4.5: Get partner referral info if user was referred by a partner
    const partnerReferralInfo = await getPartnerReferralInfo(userId);

    // ✅ Step 4.6: Block duplicate manual payment if one is already pending
    if (paymentProvider === 'manual') {
      const existingPendingOrder = await Order.findOne({
        userId,
        'payment.provider': 'manual',
        'payment.status': 'pending',
      });
      if (existingPendingOrder) {
        return res.status(400).json({
          message: 'Your payment is already pending. Please wait for admin approval.',
        });
      }
    }

    // Step 5: Create order
    const newOrder = await Order.create({
      orderNo: await generateOrderNumber(),
      userId,
      items,
      subTotal,
      discount,
      tax,
      gstRate: GST_RATE, // Save the applied GST rate
      grandTotal,
      payment: {
        provider: paymentProvider,
        status: paymentProvider === "cashfree" ? "paid" : "pending",
      },
      referredByPartner: partnerReferralInfo || {
        partnerId: null,
        referralCode: null,
        partnerName: null,
        partnerEmail: null
      }
    });

    let defaultEnrolledStudentsCount;
    try {
      defaultEnrolledStudentsCount = await Setting.getDefaultEnrolledStudentsCount();
    } catch (err) {
      console.error("Error fetching default enrolled students count:", err);
      return res.status(500).json({ message: "Failed to fetch default enrolled students count", error: err.message });
    }

    // Step 6: Create enrollments
    for (const item of items) {
      if (item.type === "course" && item.courseId) {
        const existingEnrollment = await CourseEnrollment.findOne({
          userId,
          courseId: item.courseId,
          status: "active",
        });
        const course = await Course.findById(item.courseId);
        if (!course) {
          throw new Error(`Course ${item.courseId} not found`);
        }
        let accessType = course.accessType || "lifetime";
        let enrolledAt = new Date();
        let accessExpiry = null;
        if (
          (accessType === "limited" || accessType === "subscription") &&
          course.accessPeriod
        ) {
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
          if (years > 0 || months > 0 || days > 0) {
            accessExpiry = expiry;
          }
        }
        if (!existingEnrollment) {
          await CourseEnrollment.create({
            userId,
            courseId: item.courseId,
            type: "course",
            enrolledAt,
            enrollmentSource: "purchase",
            accessType,
            accessExpiry,
            orderId: newOrder._id,
          });

          if (!course.enrolledStudents.includes(userId)) {
            course.enrolledStudents.push(userId);
            if (course.enrolledStudentsCount === 0) {
              course.enrolledStudentsCount = defaultEnrolledStudentsCount;
            }
            course.enrolledStudentsCount += 1;
            await course.save();
          }
        }
        // Add user to course chat room
        const room = await CourseChatRoom.findOne({ courseId: item.courseId });
        if (room && !room.participants.includes(userId)) {
          room.participants.push(userId);
          await room.save();
        }
      } else if (item.type === "courseBundle" && item.courseBundleId) {
        const bundle = await CourseBundle.findById(item.courseBundleId).populate("courses");
        if (!bundle || !bundle.courses) {
          throw new Error(`Course bundle ${item.courseBundleId} or its courses not found`);
        }
        for (const course of bundle.courses) {
          if (course._id) {
            const existingEnrollment = await CourseEnrollment.findOne({
              userId,
              courseId: course._id,
              status: "active",
            });
            let accessType = course.accessType || "lifetime";
            let enrolledAt = new Date();
            let accessExpiry = null;
            if (
              (accessType === "limited" || accessType === "subscription") &&
              course.accessPeriod
            ) {
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
              if (years > 0 || months > 0 || days > 0) {
                accessExpiry = expiry;
              }
            }
            if (!existingEnrollment) {
              await CourseEnrollment.create({
                userId,
                courseId: course._id,
                type: "groupCourse",
                enrolledAt,
                enrollmentSource: "purchase",
                accessType,
                accessExpiry,
                orderId: newOrder._id,
              });
              const courseToUpdate = await Course.findById(course._id);
              if (!courseToUpdate) {
                throw new Error(`Course ${course._id} not found`);
              }
              if (!courseToUpdate.enrolledStudents.includes(userId)) {
                courseToUpdate.enrolledStudents.push(userId);
                if (courseToUpdate.enrolledStudentsCount === 0) {
                  courseToUpdate.enrolledStudentsCount = defaultEnrolledStudentsCount;
                }
                courseToUpdate.enrolledStudentsCount += 1;
                await courseToUpdate.save();
              }
            }
            // Add user to course chat room for each course in bundle
            const room = await CourseChatRoom.findOne({ courseId: course._id });
            if (room && !room.participants.includes(userId)) {
              room.participants.push(userId);
              await room.save();
            }
          }
        }
        let bundleAccessType = bundle.accessType || "lifetime";
        let bundleEnrolledAt = new Date();
        let bundleAccessExpiry = null;
        if (
          (bundleAccessType === "limited" || bundleAccessType === "subscription") &&
          bundle.accessPeriod
        ) {
          const periodStr = bundle.accessPeriod.trim().toLowerCase();
          let years = 0, months = 0, days = 0;
          const yearMatch = periodStr.match(/(\d+)\s*year/);
          const monthMatch = periodStr.match(/(\d+)\s*month/);
          const dayMatch = periodStr.match(/(\d+)\s*day/);
          if (yearMatch) years = parseInt(yearMatch[1], 10);
          if (monthMatch) months = parseInt(monthMatch[1], 10);
          if (dayMatch) days = parseInt(dayMatch[1], 10);
          let expiry = new Date(bundleEnrolledAt);
          if (years > 0) expiry.setFullYear(expiry.getFullYear() + years);
          if (months > 0) expiry.setMonth(expiry.getMonth() + months);
          if (days > 0) expiry.setDate(expiry.getDate() + days);
          if (years > 0 || months > 0 || days > 0) {
            bundleAccessExpiry = expiry;
          }
        }
        await CourseEnrollment.create({
          userId,
          courseBundleId: item.courseBundleId,
          type: "courseBundle",
          enrolledAt: bundleEnrolledAt,
          enrollmentSource: "purchase",
          accessType: bundleAccessType,
          accessExpiry: bundleAccessExpiry,
          orderId: newOrder._id,
        });

        if (!bundle.enrolledStudents.includes(userId)) {
          bundle.enrolledStudents.push(userId);
          await bundle.save();
        }
      }
    }

    // Step 7: Clear cart
    await Cart.deleteOne({ userId });


    //send push notification
    const fcmTokens = await fcmTokenss.findOne({ userId });

    if (fcmTokens) {
      // Send push notification
      const data = {
        title: "Order Notification",
        description: "Your order has been placed successfully.",
        order_id: newOrder._id.toString(),
        type: "new_order",
      };
      const notiresponse = await notificationService.sendPushNotification(fcmTokens.token, data);
      //console.log("Push notification response:", notiresponse);

      //save notification response
      if (notiresponse.success) {
        const notification = new Notification({
          data,
          status: 0,
          user_id: userId,
        });
        await notification.save();
      }
    }

    return res.status(201).json({
      message: "Checkout successful",
      order: {
        ...newOrder.toObject(),
        tax: newOrder.tax.toString(), // Convert Decimal128 to string
        gstRate: newOrder.gstRate.toString(), // Convert Decimal128 to string
        subTotal: newOrder.subTotal.toString(), // Convert Decimal128 to string
        discount: newOrder.discount.toString(), // Convert Decimal128 to string
        grandTotal: newOrder.grandTotal.toString(), // Convert Decimal128 to string
      },
    });
  } catch (err) {
    console.error("Checkout Error:", err);
    return res
      .status(500)
      .json({ message: "Checkout failed", error: err.message });
  }
};

//mypurchase from order model
export const getMyPurchases = async (req, res) => {
  const userId = req.query.userid || req.user._id;

  try {
    const purchases = await Order.find({ userId }).lean();
    return res.status(200).json({ message: "My purchases fetched", data: purchases });
  } catch (err) {
    console.error("Error fetching my purchases:", err);
    return res.status(500).json({ message: "Error fetching my purchases", error: err.message });
  }
};

export const getMyEnrollments = async (req, res) => {
  const userId = req.query.userid || req.user._id;

  try {
    // Fetch enrollments without populating lastVideoPlayed
    const enrollments = await CourseEnrollment.find({
      userId

    })
      .populate('orderId', 'orderNo subTotal discount gstRate grandTotal invoice_url')
      .lean();

    if (!enrollments.length) {
      return res.status(404).json({ message: 'No enrollments found.' });
    }

    const populatedEnrollments = await Promise.all(
      enrollments.map(async (enrollment) => {
        // Manually fetch lastVideoPlayed from VideoLesson collection
        let lastVideoPlayed = null;
        if (enrollment.lastVideoPlayed) {
          lastVideoPlayed = await VideoLesson.findById(enrollment.lastVideoPlayed)
            .setOptions({ virtuals: true })
            .lean();
          //console.log('Last video played found:', lastVideoPlayed);
          if (lastVideoPlayed) {
            // Fetch progress for this user, course, and lesson (video)
            //console.log('Fetching progress for lastVideoPlayed:', lastVideoPlayed.lessonId);
            //console.log('Enrollment lastVideoPlayed:', userId);
            const progress = await LessonProgress.findOne({
              userId,
              lessonId: lastVideoPlayed?.lessonId
            }).lean();
            lastVideoPlayed.lastProgress = progress || null;
          }
        }

        if (enrollment.type === 'course' && enrollment.courseId) {
          const course = await Course.findById(enrollment.courseId).lean();

          let certificate = null;

          if (course && course._id) {
            const { overallProgress } = await courseCompletionService.checkCourseCompletion(userId, course._id);
            course.overallProgress = overallProgress;

            certificate = await Certificate.findOne({
              user_id: userId,
              course_id: course._id,
            }).lean();

            return {
              ...enrollment,
              course,
              certificate,
              order: enrollment.orderId,
              lastVideoPlayed
            };
          }
          return {
            ...enrollment,
            course: null,
            certificate: null,
            lastVideoPlayed,
            error: `Course with ID ${enrollment.courseId} not found`,
          };
        } else if (enrollment.type === 'courseBundle' && enrollment.courseBundleId) {
          const bundle = await CourseBundle.findById(enrollment.courseBundleId)
            .populate('courses')
            .lean();

          if (bundle && bundle.courses && bundle.courses.length > 0) {
            const coursesWithProgress = await Promise.all(
              bundle.courses.map(async (course) => {
                const { overallProgress } = await courseCompletionService.checkCourseCompletion(userId, course._id);
                course.overallProgress = overallProgress;

                const certificate = await Certificate.findOne({
                  user_id: userId,
                  courseId: course._id,
                }).lean();

                return {
                  ...course,
                  certificate,
                };
              })
            );
            bundle.courses = coursesWithProgress;
          }
          return {
            ...enrollment,
            bundle,
            order: enrollment.orderId,
            lastVideoPlayed, // Manually fetched VideoLesson
          };
        } else if (enrollment.type === 'coursePlan' && enrollment.coursePlanId) {
          // Fetch plan and course
          const CoursePlan = (await import('../models/CoursePlan.js')).default;
          const plan = await safeFindCoursePlan(CoursePlan, enrollment.coursePlanId, null, true);
          let course = null;
          if (plan && plan.courseId) {
            course = await Course.findById(plan.courseId).lean();
            // Optionally, calculate progress/certificate as in course block
            let certificate = null;
            if (course && course._id) {
              const { overallProgress } = await courseCompletionService.checkCourseCompletion(userId, course._id);
              course.overallProgress = overallProgress;

              certificate = await Certificate.findOne({
                user_id: userId,
                course_id: course._id,
              }).lean();
            }
            return {
              ...enrollment,
              course,
              coursePlan: plan,
              certificate,
              order: enrollment.orderId,
              lastVideoPlayed
            };
          }
          return {
            ...enrollment,
            course: null,
            coursePlan: plan,
            certificate: null,
            lastVideoPlayed,
            error: `Course with ID ${plan?.courseId} not found`,
          };

        } else if (enrollment.type === 'ebook' && enrollment.ebookId) {
          const ebook = await Ebook.findById(enrollment.ebookId).lean();
          if (ebook) {
            return {
              ...enrollment,
              ebook,
              order: enrollment.orderId
            };
          }
          return {
            ...enrollment,
            error: `Ebook with ID ${enrollment.ebookId} not found`
          };
        }
        return {
          ...enrollment,
          order: enrollment.orderId,
          lastVideoPlayed, // Manually fetched VideoLesson
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: populatedEnrollments,
    });
  } catch (err) {
    console.error('Get My Enrollments Error:', err);
    return res
      .status(500)
      .json({ message: 'Failed to retrieve enrollments', error: err.message });
  }
};

export const validateCoupon = async (code, orderAmount, userId) => {
  try {
    const coupon = await Coupon.findOne({
      code: code.toUpperCase(),
      isActive: true,
    });

    if (!coupon) {
      throw new Error("Invalid coupon code");
    }

    if (!coupon.isActive) {
      throw new Error("Coupon is not active");
    }

    const now = new Date();
    if (now < coupon.startDate) {
      throw new Error("Coupon is not yet valid");
    }

    if (now > coupon.endDate) {
      throw new Error("Coupon has expired");
    }

    if (orderAmount < coupon.minOrderAmount) {
      throw new Error(
        `Minimum order amount of â‚¹${coupon.minOrderAmount} required`
      );
    }

    if (coupon.usageLimit > 0) {
      const totalUsage = coupon.usedBy.reduce(
        (sum, user) => sum + user.usageCount,
        0
      );
      if (totalUsage >= coupon.usageLimit) {
        throw new Error("Coupon usage limit exceeded");
      }
    }

    let discountAmount = 0;
    if (coupon.discountType === "flat") {
      discountAmount = coupon.discountAmount;
    } else if (coupon.discountType === "percentage") {
      discountAmount = (orderAmount * coupon.discountPercent) / 100;
      if (
        coupon.maxDiscountValue > 0 &&
        discountAmount > coupon.maxDiscountValue
      ) {
        discountAmount = coupon.maxDiscountValue;
      }
    }

    const finalAmount = orderAmount - discountAmount;

    return {
      coupon: {
        _id: coupon._id,
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountAmount: coupon.discountAmount,
        discountPercent: coupon.discountPercent,
      },
      orderAmount,
      discountAmount,
      finalAmount,
      isValid: true,
    };
  } catch (error) {
    throw error;
  }
};

//checkOrder
export const checkOrder = async (req, res) => {
  console.log(">>> CHECK ORDER VERSION 2 - LOGGING START <<<");
  console.log("Request body:", JSON.stringify(req.body, null, 2));
  try {
    const {
      courseId,
      courseBundleId,
      coursePlanId,
      guestEmail,
      guestName,
      couponCode,
      is_verify,
      referralCode,
      ebookId // <-- support ebook
    } = req.body;

    console.log("checkOrder - Received referralCode:", referralCode);

    // Remove fallback- prefix if present in coursePlanId
    const effectiveCoursePlanId = (coursePlanId && typeof coursePlanId === 'string' && coursePlanId.startsWith('fallback-'))
      ? coursePlanId.replace('fallback-', '')
      : coursePlanId;

    if (!guestEmail) {
      return res.status(400).json({ message: "Guest email is required", is_valid: false });
    }

    // Check if user exists and is already verified - auto-verify existing DB users
    const existingUser = await User.findOne({ email: guestEmail });
    const autoVerified = existingUser && existingUser.is_verify === true;

    // Only block guest (new) users who haven't completed OTP verification
    if (!autoVerified && !is_verify) {
      return res.status(400).json({ message: "Email not verified", is_valid: false, success: false, err: { email: "Please verify your email before proceeding" } });
    }

    if (courseId && courseBundleId) {
      return res.status(400).json({ message: "Provide either courseId or courseBundleId, not both", is_valid: false });
    }

    // Allow courseId+coursePlanId if plan belongs to course
    if (
      (courseId && courseBundleId) ||
      (coursePlanId && courseBundleId) ||
      (ebookId && (courseId || courseBundleId || coursePlanId))
    ) {
      return res.status(400).json({ message: "Provide either courseId/coursePlanId or courseBundleId or ebookId, not mixed" });
    }
    if (courseId && effectiveCoursePlanId) {
      // Check if plan belongs to course
      try {
        const CoursePlan = (await import('../models/CoursePlan.js')).default;
        const isFallback = typeof coursePlanId === "string" && coursePlanId.startsWith("fallback-");
        let plan;

        if (isFallback) {
          plan = { courseId: courseId };
        } else if (mongoose.Types.ObjectId.isValid(effectiveCoursePlanId)) {
          plan = await safeFindCoursePlan(CoursePlan, effectiveCoursePlanId, (typeof courseId !== 'undefined' ? courseId : null));
        } else {
          return res.status(400).json({ message: "Invalid Course Plan ID format", is_valid: false });
        }

        if (!plan) {
          return res.status(404).json({ message: "Course plan not found", is_valid: false });
        }

        if (plan.courseId && plan.courseId.toString() !== courseId.toString()) {
          return res.status(400).json({ message: "Course plan does not belong to the specified course", is_valid: false });
        }
        // If valid, proceed and ignore courseId for item creation (use plan.courseId)
      } catch (planValidationError) {
        console.error("Error validating course plan:", planValidationError);
        return res.status(500).json({
          message: "Error validating course plan",
          error: planValidationError.message,
          is_valid: false
        });
      }
    }

    let guestUser = await User.findOne({ email: guestEmail });

    if (guestUser) {
      // Check coupon already used by user
      if (couponCode) {
        const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
        if (coupon) {
          const userIndex = coupon.usedBy.findIndex(
            (user) => user.userId.toString() === guestUser._id.toString()
          );
          if (userIndex !== -1) {
            return res.status(400).json({ message: "Coupon already used by this user", is_valid: false });
          }
        }
      }

      if (courseId) {
        const course = await Course.findById(courseId);
        if (!course) return res.status(404).json({ message: "Course not found", is_valid: false });
        const existingEnrollment = await CourseEnrollment.findOne({
          userId: guestUser._id,
          courseId: courseId,
          status: "active",
        });

        if (existingEnrollment) {
          return res.status(400).json({ message: "User already enrolled in this course", is_valid: false });
        }
      }

      // Check enrollment for coursePlan if only courseId or coursePlanId is provided
      if (effectiveCoursePlanId) {
        try {
          const CoursePlan = (await import('../models/CoursePlan.js')).default;
          const isFallback = typeof coursePlanId === "string" && coursePlanId.startsWith("fallback-");
          if (!isFallback && mongoose.Types.ObjectId.isValid(effectiveCoursePlanId)) {
            const plan = await safeFindCoursePlan(CoursePlan, effectiveCoursePlanId, null);
            if (plan && plan.courseId) {
              const existingEnrollment = await CourseEnrollment.findOne({
                userId: guestUser._id,
                courseId: plan.courseId,
                status: "active",
              });
              if (existingEnrollment) {
                return res.status(400).json({ message: "User already enrolled in this course", is_valid: false });
              }
            }
          }
        } catch (planCheckError) {
          console.error("Error checking plan enrollment:", planCheckError);
          // Continue - enrollment check is not critical
        }
      }
    }

    // Validate that at least one ID is provided
    if (!courseId && !courseBundleId && !coursePlanId && !req.body.ebookId) {
      return res.status(400).json({
        message: "At least one of courseId, courseBundleId, coursePlanId, or ebookId is required",
        is_valid: false
      });
    }

    let amount = 0;

    const isFallbackPlanOrder = typeof coursePlanId === 'string' && coursePlanId.startsWith('fallback-');
    if (coursePlanId && !isFallbackPlanOrder && mongoose.Types.ObjectId.isValid(coursePlanId)) {
      try {
        const CoursePlan = (await import('../models/CoursePlan.js')).default;
        if (!CoursePlan) {
          return res.status(500).json({
            message: "CoursePlan model not found",
            is_valid: false
          });
        }
        const plan = await safeFindCoursePlan(CoursePlan, coursePlanId, (typeof courseId !== 'undefined' ? courseId : null));
        if (!plan) {
          console.error("Course plan not found for ID:", coursePlanId);
          return res.status(404).json({ message: "Course plan not found", is_valid: false });
        }
        amount = plan.salePrice !== undefined && plan.salePrice > 0
          ? Number(plan.salePrice)
          : Number(plan.price || 0);
        console.log("Course plan found, amount:", amount);
      } catch (planError) {
        console.error("Error fetching course plan:", planError);
        console.error("Plan error stack:", planError.stack);
        return res.status(500).json({
          message: "Error fetching course plan",
          error: planError.message,
          is_valid: false
        });
      }
    } else if (courseId) {
      try {
        const course = await Course.findById(courseId);
        if (!course) return res.status(404).json({ message: "Course not found", is_valid: false });
        amount = course.salePrice && parseFloat(course.salePrice) > 0
          ? parseFloat(course.salePrice)
          : parseFloat(course.price || 0);
      } catch (courseError) {
        console.error("Error fetching course:", courseError);
        return res.status(500).json({
          message: "Error fetching course",
          error: courseError.message,
          is_valid: false
        });
      }
    } else if (courseBundleId) {
      try {
        const bundle = await CourseBundle.findById(courseBundleId).populate("courses");
        if (!bundle) return res.status(404).json({ message: "Bundle not found", is_valid: false });
        amount = parseFloat(bundle.price || 0);
      } catch (bundleError) {
        console.error("Error fetching bundle:", bundleError);
        return res.status(500).json({
          message: "Error fetching bundle",
          error: bundleError.message,
          is_valid: false
        });
      }
    } else if (ebookId) {
      try {
        const ebook = await Ebook.findById(ebookId);
        if (!ebook) return res.status(404).json({ message: "Ebook not found", is_valid: false });
        amount = parseFloat(ebook.price || 0);
      } catch (ebookError) {
        console.error("Error fetching ebook:", ebookError);
        return res.status(500).json({
          message: "Error fetching ebook",
          error: ebookError.message,
          is_valid: false
        });
      }
    }

    // Ensure amount is rounded to 2 decimals before further calculations
    amount = parseFloat(amount.toFixed(2));

    let discount = 0;
    if (couponCode) {
      try {
        const validationResult = await validateCoupon(couponCode, amount, guestUser ? guestUser._id : null);
        discount = validationResult.discountAmount;
      } catch (err) {
        return res.status(400).json({ message: err.message, is_valid: false });
      }
    }

    const taxableAmount = parseFloat(amount) - parseFloat(discount);
    const tax = 0; // GST removed
    amount = parseFloat(taxableAmount.toFixed(2));
    const GST_RATE = 0; // GST removed

    if (amount > 0) {
      // ── Cashfree: Create a payment session ───────────────────────────────
      // (Razorpay code commented out above)
      let cfHeaders, cfBaseUrl;
      try {
        cfHeaders = await getCashfreeHeaders();
        cfBaseUrl = getCashfreeBaseUrl();
      } catch (cfConfigError) {
        return res.status(500).json({
          message: "Payment gateway configuration error",
          error: cfConfigError.message,
          is_valid: false
        });
      }

      const cashfreeOrderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

      const cashfreePayload = {
        order_id: cashfreeOrderId,
        order_amount: amount,                 // in rupees (Cashfree uses decimals, not paise)
        order_currency: 'INR',
        customer_details: {
          customer_id: guestUser ? guestUser._id.toString() : `guest_${Date.now()}`,
          customer_name: guestName || 'Guest User',
          customer_email: guestEmail,
          customer_phone: req.body.phone || '9999999999',  // Cashfree requires a phone
        },
        order_meta: {
          return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-success?order_id={order_id}`,
          // notify_url if needed
        }
      };

      try {
        const cfResponse = await axiosCf.post(`${cfBaseUrl}/orders`, cashfreePayload, { headers: cfHeaders });

        if (cfResponse.data && cfResponse.data.payment_session_id) {
          return res.status(200).json({
            success: true,
            is_valid: true,
            cashfree: {
              order_id: cfResponse.data.order_id,
              payment_session_id: cfResponse.data.payment_session_id,
              order_status: cfResponse.data.order_status,
              order_amount: cfResponse.data.order_amount,
              order_currency: cfResponse.data.order_currency,
            },
            data: { message: "Cashfree session created" }
          });
        }
        return res.status(400).json({ message: "Failed to create Cashfree session", is_valid: false });
      } catch (cfApiError) {
        console.error("Cashfree API Error:", cfApiError.response?.data || cfApiError.message);
        return res.status(500).json({
          message: "Payment gateway error",
          error: cfApiError.response?.data || cfApiError.message,
          is_valid: false
        });
      }
    } else {
      // Free order
      return res.status(200).json({
        success: true,
        is_valid: true,
        data: { message: "Free order, no payment required" }
      });
    }
  } catch (err) {
    console.error("checkOrder error:", err);
    return res.status(500).json({ message: "Server error during checkOrder", error: err.message, is_valid: false });
  }
};




//importStudents
// export const importStudents = async (req, res) => {
//   try {
//     //read uploaded excel file
//     if (!req.file) {
//       return res.status(400).json({ message: "No file uploaded" });
//     }

//     if (!req.body.courseId) {
//       return res.status(400).json({ message: "Course ID  is required" });
//     }

//     const filePath = req.file.path;

//     const workbook = xlsx.readFile(filePath);
//     const sheetName = workbook.SheetNames[1];
//     if (!sheetName) {
//       return res.status(400).json({ message: "Second sheet not found in Excel file" });
//     }
//     const sheet = workbook.Sheets[sheetName];
//     const rows = xlsx.utils.sheet_to_json(sheet);
//     const courseId = req.body.courseId;
//     const courseBundleId = req.body.courseBundleId;

//     if (rows.length === 0) {
//       return res.status(400).json({ message: "Excel file is empty" });
//     }

//     const results = [];
//     // Only import CoursePlan dynamically if needed
//     let CoursePlan = null;
//     var enrolledStudentsCount = 0;
//     for (const [index, row] of rows.entries()) {
//       const rowNumber = index + 2;
//       const fullName = row["Name"] || row["Full Name"];
//       const email = row["Email"];
//       let phone = row["Phone No"] || row["Phone"];
//       if (typeof phone === "string" && phone.startsWith("+91")) {
//         phone = phone.slice(3);
//       }
//       const password = row["Password"] || "student";

//       const coursePlanId = row["Plan Id"];
//       const purchaseDate = row["Purchase Date"];
//       //Expiring On
//       let expiryDate = row["Expiring On"];

//       const is_verify = true;
//       const errors = [];
//       if (!fullName) {
//         errors.push("Full Name is required");
//       }
//       if (!email) {
//         errors.push("Email is required");
//       }
//       if (courseId && courseBundleId) {
//         errors.push("Provide either Course ID or Course Bundle ID, not both");
//       }
//       if (!courseId && !courseBundleId && !coursePlanId) {
//         errors.push("At least one of Course ID, Course Bundle ID, or Course Plan ID is required");
//       }

//       let course = null;
//       let coursePlan = null;
//       let bundle = null;
//       if (courseId) {
//         course = await Course.findById(courseId);
//         if (!course) {
//           errors.push(`Course with ID ${courseId} not found`);
//         }
//       }
//       if (coursePlanId) {
//         if (!CoursePlan) {
//           CoursePlan = (await import('../models/CoursePlan.js')).default;
//         }
//         coursePlan = await safeFindCoursePlan(CoursePlan, coursePlanId, (typeof courseId !== 'undefined' ? courseId : null));
//         if (!coursePlan) {
//           errors.push(`Course Plan with ID ${coursePlanId} not found`);
//         }

//         if (course && coursePlan && coursePlan.courseId.toString() !== course._id.toString()) {
//           errors.push(`Course Plan ${coursePlanId} does not belong to Course ${courseId}`);
//         }

//         if (!course && coursePlan) {
//           course = await Course.findById(coursePlan.courseId);
//           if (!course) {
//             errors.push(`Course with ID ${coursePlan.courseId} (from Course Plan) not found`);
//           }
//         }
//       }

//       if (errors.length > 0) {
//         results.push({ row: rowNumber, success: false, errors });
//         continue;
//       }

//       let user = await User.findOne({ email });
//       let isNewUser = false;
//       if (!user) {
//         user = await userService.signup({
//           fullName,
//           email,
//           password,
//           role: "student",
//           is_verify,
//           phone,
//         });
//         isNewUser = true;
//       }
//       const userId = user._id;

//       if (course) {
//         const existingEnrollment = await CourseEnrollment.findOne({
//           userId,
//           courseId: course._id,
//         });
//         if (!existingEnrollment) {

//           //handle purchaseDate and expiryDate
//           let enrolledAt = new Date();
//           if (purchaseDate) {
//             const parsedDate = new Date(purchaseDate);
//             if (!isNaN(parsedDate)) {
//               enrolledAt = parsedDate;
//             }
//           }
//           if (expiryDate) {
//             const parsedExpiry = new Date(expiryDate);
//             if (!isNaN(parsedExpiry)) {
//               // If enrolledAt is after expiryDate, ignore expiryDate
//               if (enrolledAt < parsedExpiry) {
//                 course.accessType = "limited";
//                 course.accessPeriod = null; // Clear accessPeriod since we have explicit expiry
//               }
//             }
//           } else {
//             //generate plan base 
//             if (coursePlan) {
//               if (coursePlan.durationType === "lifetime") {
//                 // No expiry
//                 course.accessType = "lifetime";
//                 course.accessPeriod = null;
//               }
//               else if (coursePlan.durationType === "limited" && coursePlan.duration) {
//                 course.accessType = "limited";
//                 course.accessPeriod = coursePlan.duration; // e.g., "6 months"
//               }
//               else if (coursePlan.durationType === "Month" && coursePlan.duration) {
//                 course.accessType = "month";
//                 course.accessPeriod = coursePlan.duration + " months"; // e.g., "6 months"
//                 expiryDate = new Date(enrolledAt);
//                 expiryDate.setMonth(expiryDate.getMonth() + coursePlan.duration);
//               }
//               else if (coursePlan.durationType === "Year" && coursePlan.duration) {
//                 course.accessType = "year";
//                 course.accessPeriod = coursePlan.duration + " years";
//                 expiryDate = new Date(enrolledAt);
//                 expiryDate.setFullYear(expiryDate.getFullYear() + coursePlan.duration);
//               } else if (coursePlan.durationType === "Day" && coursePlan.duration) {
//                 course.accessType = "day";
//                 course.accessPeriod = coursePlan.duration + " days";
//                 expiryDate = new Date(enrolledAt);
//                 expiryDate.setDate(expiryDate.getDate() + coursePlan.duration);
//               } else {
//                 course.accessType = "lifetime";
//                 course.accessPeriod = null;
//               }
//             }
//           }

//           await CourseEnrollment.create({
//             userId,
//             courseId: course._id,
//             coursePlanId: coursePlan ? coursePlan._id : null,
//             type: "course",
//             enrolledAt: enrolledAt,
//             enrollmentSource: "import",
//             accessType: coursePlan ? (coursePlan.durationType || "lifetime") : (course.accessType || "lifetime"),
//             accessExpiry: expiryDate && !isNaN(new Date(expiryDate)) ? new Date(expiryDate) : null,
//           });
//           enrolledStudentsCount++; 
//           // //console.log('course?.enrolledStudents', course?.enrolledStudents);
//           if (!course?.enrolledStudents?.includes(userId)) {
//             course?.enrolledStudents?.push(userId);
//             course.enrolledStudentsCount = enrolledStudentsCount;
//             await course?.save();
//           }
//         }
//       }
//       //console.log("Import student processed:", email, "Row:", rowNumber, "New User:", isNewUser);
//       results.push({ row: rowNumber, success: true, isNewUser });
//     }
//      console?.log("Imported Students Count:", results);
//      console?.log("Total Enrolled Students Count:", enrolledStudentsCount);


//     return res.status(200).json({ message: "Import completed", results });
//   } catch (err) {
//     console.error("Import Students Error:", err);
//     return res.status(500).json({ message: "Import Students failed", error: err.message });
//   }
// };



export const importStudents = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    if (!req.body.courseId) return res.status(400).json({ message: "Course ID is required" });

    const filePath = req.file.path;
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[1];
    if (!sheetName)
      return res.status(400).json({ message: "Sheet not found in Excel file" });

    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet);
    const courseId = req.body.courseId;
    const courseBundleId = req.body.courseBundleId;

    if (rows.length === 0) return res.status(400).json({ message: "Excel file is empty" });

    // Log column names for debugging
    const columnNames = Object.keys(rows[1]);
    console.log("ðŸ“‹ Excel Column Names:", columnNames);

    const results = [];
    let CoursePlan = null;
    let enrolledStudentsCount = 0;

    console.log("ðŸ”¹ Starting student import for course:", courseId);

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;
      const fullName = row["Name"] || row["Full Name"];
      const email = row["Email"];
      let phone = row["Phone No"] || row["Phone"];
      if (typeof phone === "string" && phone.startsWith("+91")) phone = phone.slice(3);
      const password = row["Password"] || "student";
      const coursePlanId = row["Plan Id"];
      const purchaseDate = row["Purchase Date"];
      let expiryDate = row["Expiring On"] || row["Expiry Date"] || row["Expiration Date"];

      // Debug: Log raw Excel data
      console.log(`\nðŸ” Row ${rowNumber} Raw Data:`, {
        email,
        purchaseDate,
        expiryDate,
        purchaseDateType: typeof purchaseDate,
        expiryDateType: typeof expiryDate,
      });

      const errors = [];
      if (!fullName) errors.push("Full Name is required");
      if (!email) errors.push("Email is required");
      if (courseId && courseBundleId)
        errors.push("Provide either Course ID or Course Bundle ID, not both");
      if (!courseId && !courseBundleId && !coursePlanId)
        errors.push("At least one of Course ID, Course Bundle ID, or Course Plan ID is required");

      let course = null;
      let coursePlan = null;

      if (courseId) {
        course = await Course.findById(courseId);
        if (!course) errors.push(`Course with ID ${courseId} not found`);
      }

      if (coursePlanId) {
        if (!CoursePlan) CoursePlan = (await import("../models/CoursePlan.js")).default;
        coursePlan = await safeFindCoursePlan(CoursePlan, coursePlanId, (typeof courseId !== 'undefined' ? courseId : null));
        if (!coursePlan) errors.push(`Course Plan with ID ${coursePlanId} not found`);
        if (course && coursePlan && coursePlan.courseId.toString() !== course._id.toString())
          errors.push(`Course Plan ${coursePlanId} does not belong to Course ${courseId}`);
        if (!course && coursePlan) {
          course = await Course.findById(coursePlan.courseId);
          if (!course) errors.push(`Course with ID ${coursePlan.courseId} not found`);
        }
      }

      if (errors.length > 0) {
        results.push({ row: rowNumber, success: false, errors });
        continue;
      }

      // Create or find user
      let user = await User.findOne({ email });
      let isNewUser = false;
      if (!user) {
        user = await userService.signup({
          fullName,
          email,
          password,
          role: "student",
          is_verify: true,
          phone,
        });
        isNewUser = true;
      }

      const userId = user._id;

      // Enrollment handling
      if (course) {
        let enrolledAt = new Date();
        if (purchaseDate) {
          console.log(`ðŸ“… Parsing purchase date for ${email}:`, purchaseDate);
          let parsedPurchaseDate;
          if (typeof purchaseDate === "number") {
            // Handle Excel numeric date
            const excelDate = xlsx.SSF.parse_date_code(purchaseDate);
            parsedPurchaseDate = new Date(excelDate.y, excelDate.m - 1, excelDate.d);
          } else {
            // Normalize date string (e.g., 2025-8-22 to 2025-08-22)
            let cleanDate = purchaseDate.toString();
            cleanDate = cleanDate.match(/(\d{4})-(\d{1,2})-(\d{1,2})(T\d{2}:\d{2}:\d{2}\.\d{3}Z)?/);
            if (cleanDate) {
              const year = cleanDate[1];
              const month = cleanDate[2].padStart(2, "0");
              const day = cleanDate[3].padStart(2, "0");
              const time = cleanDate[4] || "T00:00:00.000Z";
              parsedPurchaseDate = new Date(`${year}-${month}-${day}${time}`);
            } else {
              parsedPurchaseDate = new Date(purchaseDate);
            }
          }
          if (!isNaN(parsedPurchaseDate)) {
            enrolledAt = parsedPurchaseDate;
            console.log(`âœ… Valid purchase date found: ${enrolledAt.toDateString()}`);
          } else {
            console.log("âš ï¸ Purchase date format invalid, using current date.");
          }
        }

        let parsedExpiryDate = null;
        if (expiryDate) {
          console.log(`ðŸ“… Parsing expiry date for ${email}:`, expiryDate);
          if (typeof expiryDate === "number") {
            // Handle Excel numeric date
            const excelDate = xlsx.SSF.parse_date_code(expiryDate);
            parsedExpiryDate = new Date(excelDate.y, excelDate.m - 1, excelDate.d);
          } else {
            // Normalize date string (e.g., 2025-8-22 to 2025-08-22)
            let cleanExpiryDate = expiryDate.toString();
            cleanExpiryDate = cleanExpiryDate.match(/(\d{4})-(\d{1,2})-(\d{1,2})(T\d{2}:\d{2}:\d{2}\.\d{3}Z)?/);
            if (cleanExpiryDate) {
              const year = cleanExpiryDate[1];
              const month = cleanExpiryDate[2].padStart(2, "0");
              const day = cleanExpiryDate[3].padStart(2, "0");
              const time = cleanExpiryDate[4] || "T00:00:00.000Z";
              parsedExpiryDate = new Date(`${year}-${month}-${day}${time}`);
            } else {
              parsedExpiryDate = new Date(expiryDate);
            }
          }
          if (!isNaN(parsedExpiryDate)) {
            expiryDate = parsedExpiryDate;
            console.log(`âœ… Valid expiry date parsed: ${expiryDate.toDateString()}`);
          } else {
            console.log(`âš ï¸ Invalid expiry date format: ${expiryDate}, setting to null`);
            expiryDate = null;
          }
        }

        const existingEnrollment = await CourseEnrollment.findOne({
          userId,
          courseId: course._id,
        }).sort({ enrolledAt: -1 });

        // ===========================
        // ðŸ§  SMART RE-ENROLLMENT LOGIC
        // ===========================
        if (existingEnrollment) {
          console.log(`\nðŸ” Re-enrollment detected for ${email} in ${course.title}`);

          const oldEnrollDate = new Date(existingEnrollment.enrolledAt);
          const oldExpiry = existingEnrollment.accessExpiry ? new Date(existingEnrollment.accessExpiry) : null;
          const importedEnrollDate = new Date(enrolledAt);
          const importedExpiry = expiryDate ? new Date(expiryDate) : null;

          console.log("ðŸ“… Old Enrollment:", {
            enrolledAt: oldEnrollDate,
            expiry: oldExpiry,
          });
          console.log("ðŸ“… Imported Enrollment:", {
            enrolledAt: importedEnrollDate,
            expiry: importedExpiry,
          });

          // ðŸ§© CASE 1: Imported enrollment is OLDER
          if (importedExpiry && oldExpiry && importedExpiry < oldExpiry) {
            console.log("âš ï¸ Imported enrollment is older â€” calculating inactive gap...");

            const inactiveGapDays = Math.floor(
              (importedExpiry - importedEnrollDate) / (1000 * 60 * 60 * 24)
            );

            console.log(`â³ Inactive gap: ${inactiveGapDays} days`);

            if (inactiveGapDays > 0) {
              const adjustedEnrollDate = new Date(oldEnrollDate);
              adjustedEnrollDate.setDate(adjustedEnrollDate.getDate() - inactiveGapDays);

              console.log(
                `ðŸ“… Adjusted enrollment start date: ${adjustedEnrollDate.toDateString()}`
              );

              existingEnrollment.enrolledAt = adjustedEnrollDate;
              await existingEnrollment.save();

              results.push({
                row: rowNumber,
                success: true,
                updatedExisting: true,
                note: `Adjusted enrollment backward by ${inactiveGapDays} days (older import)`,
              });
            } else {
              console.log("âœ… No inactive gap detected â€” skipping update.");
              results.push({
                row: rowNumber,
                success: true,
                skippedOlder: true,
                note: "Older import â€” no change",
              });
            }
          }

          // ðŸ§© CASE 2: Imported enrollment is NEWER (extends expiry)
          else if (importedExpiry && oldExpiry && importedExpiry > oldExpiry) {
            console.log("ðŸ†• Imported enrollment extends expiry â€” processing renewal...");

            let adjustedEnrollDate = oldEnrollDate;
            if (importedEnrollDate > oldExpiry) {
              const inactiveGapDays = Math.floor(
                (importedEnrollDate - oldExpiry) / (1000 * 60 * 60 * 24)
              );

              adjustedEnrollDate = new Date(oldEnrollDate);
              adjustedEnrollDate.setDate(adjustedEnrollDate.getDate() + inactiveGapDays);

              console.log(
                `â³ Inactive gap between old expiry and new start: ${inactiveGapDays} days`
              );
              console.log(
                `ðŸ“… Adjusted new enrollment start: ${adjustedEnrollDate.toDateString()}`
              );
            } else {
              console.log("âœ… Continuous enrollment â€” keeping original start date.");
            }

            existingEnrollment.enrolledAt = adjustedEnrollDate;
            existingEnrollment.accessExpiry = importedExpiry;
            await existingEnrollment.save();

            results.push({
              row: rowNumber,
              success: true,
              renewed: true,
              note: "Extended expiry and adjusted start date (newer import)",
            });
          }

          // ðŸ§© CASE 3: Overlapping or no valid expiry date
          else {
            console.log("âš–ï¸ Overlapping enrollment or invalid/no expiry date â€” no change needed.");
            results.push({
              row: rowNumber,
              success: true,
              skipped: true,
              note: "Overlapping enrollment or invalid/no expiry date â€” unchanged",
            });
          }
        }

        // ===========================
        // ðŸ†• FIRST-TIME ENROLLMENT
        // ===========================
        else {
          let finalExpiryDate = null;

          if (expiryDate) {
            console.log(`ðŸ“… Using provided expiry date for ${email}:`, expiryDate);
            finalExpiryDate = new Date(expiryDate);
          } else if (coursePlan) {
            if (coursePlan.durationType === "Month" && coursePlan.duration) {
              finalExpiryDate = new Date(enrolledAt);
              finalExpiryDate.setMonth(finalExpiryDate.getMonth() + coursePlan.duration);
            } else if (coursePlan.durationType === "Year" && coursePlan.duration) {
              finalExpiryDate = new Date(enrolledAt);
              finalExpiryDate.setFullYear(finalExpiryDate.getFullYear() + coursePlan.duration);
            } else if (coursePlan.durationType === "Day" && coursePlan.duration) {
              finalExpiryDate = new Date(enrolledAt);
              finalExpiryDate.setDate(finalExpiryDate.getDate() + coursePlan.duration);
            }
          } else {
            console.log(`âš ï¸ No coursePlan or expiryDate provided for ${email}, setting default expiry (1 year)`);
            finalExpiryDate = new Date(enrolledAt);
            finalExpiryDate.setFullYear(finalExpiryDate.getFullYear() + 1);
          }

          console.log(`ðŸ“… Finalized expiry date for ${email}:`, finalExpiryDate);
          console.log(
            `ðŸ•’ Setting accessExpiry for ${email}:`,
            finalExpiryDate,
            "Valid:",
            finalExpiryDate && !isNaN(finalExpiryDate)
          );

          await CourseEnrollment.create({
            userId,
            courseId: course._id,
            coursePlanId: coursePlan ? coursePlan._id : null,
            type: "course",
            enrolledAt,
            enrollmentSource: "import",
            accessType: coursePlan ? (coursePlan.durationType || "lifetime") : "limited",
            accessExpiry: finalExpiryDate && !isNaN(finalExpiryDate) ? finalExpiryDate : null,
          });

          if (!course.enrolledStudents?.includes(userId)) {
            course.enrolledStudents?.push(userId);
            await course.save();
          }

          enrolledStudentsCount++;
          results.push({ row: rowNumber, success: true, newEnrollment: true });
        }
      }

      console.log(`âœ… Processed ${email} (Row ${rowNumber}) | New User: ${isNewUser}`);
    }

    console.log("ðŸ“Š Import completed.");
    console.log("Total rows processed:", results.length);
    console.log("Total enrolled students:", enrolledStudentsCount);

    return res.status(200).json({ message: "Import completed", results });
  } catch (err) {
    console.error("Import Students Error:", err);
    return res.status(500).json({ message: "Import Students failed", error: err.message });
  }
};



export const buyNow = async (req, res) => {
  try {
    // Validate Content-Type
    if (!req.is('application/json')) {
      return res.status(400).json({ message: "Content-Type must be application/json" });
    }

    const {
      courseId,
      courseBundleId,
      coursePlanId, // <-- support plan
      guestEmail,
      guestName,
      paymentId,
      paymentProvider = "razorpay",
      couponCode,
      deviceId,
      fcmToken,
      company,
      referralCode, // <-- Support referral code in buyNow
      ebookId // <-- Support ebook
    } = req.body;

    console.log("buyNow - Destructured referralCode:", referralCode);

    // Remove fallback- prefix if present in coursePlanId
    const isFallback = (coursePlanId && typeof coursePlanId === 'string' && coursePlanId.startsWith('fallback-'));
    const effectiveCoursePlanId = isFallback ? coursePlanId.replace('fallback-', '') : coursePlanId;



    // Validate required fields
    if (!courseId && !courseBundleId && !coursePlanId && !ebookId) {
      return res.status(400).json({ message: "Course, bundle, plan, or ebook ID is required" });
    }
    if (!guestEmail) {
      return res.status(400).json({ message: "Guest email is required" });
    }
    // Allow courseId+coursePlanId if plan belongs to course
    if (
      (courseId && courseBundleId) ||
      (coursePlanId && courseBundleId) ||
      (ebookId && (courseId || courseBundleId || coursePlanId))
    ) {
      return res.status(400).json({ message: "Provide either courseId/coursePlanId or courseBundleId or ebookId, not mixed" });
    }
    if (courseId && effectiveCoursePlanId) {
      // Check if plan belongs to course
      const CoursePlan = (await import('../models/CoursePlan.js')).default;
      const isFallback = typeof coursePlanId === "string" && coursePlanId.startsWith("fallback-"); let plan; if (isFallback) { plan = { courseId: courseId }; } else if (mongoose.Types.ObjectId.isValid(effectiveCoursePlanId)) { plan = await safeFindCoursePlan(CoursePlan, effectiveCoursePlanId, (typeof courseId !== 'undefined' ? courseId : null)); } else { return res.status(400).json({ message: "Invalid Course Plan ID format" }); }
      if (!plan) {
        return res.status(404).json({ message: "Course plan not found" });
      }
      if (plan.courseId.toString() !== courseId.toString()) {
        return res.status(400).json({ message: "Course plan does not belong to the specified course" });
      }
      // If valid, proceed and ignore courseId for item creation (use plan.courseId)
    }

    // if (!deviceId && !fcmToken) {
    //   return res.status(400).json({ message: "Device ID or FCM token is required" }); 
    // }

    console.log(">>> BUY NOW START <<<");
    console.log("Request Body:", JSON.stringify(req.body, null, 2));

    // Step 1: Find or create guest user
    let guestUser = await User.findOne({ email: guestEmail });
    let isNewUser = false; // <-- Track if user is new
    if (!guestUser) {
      try {
        guestUser = await userService.signup({
          fullName: guestName,
          email: guestEmail,
          password: "", // Guest user, will be set or handled by userService
          role: "student",
          is_verify: true,
          phone: "", // guest phone during buyNow signup (optional or separate)
          referralCode: referralCode || "" // Pass referral code for linking
        });
      } catch (signupError) {
        console.error("Error during guest user signup:", signupError);
        return res.status(500).json({ message: "Failed to create guest user", error: signupError.message });
      }
      isNewUser = true;
    } else if (!guestUser.referredBy && referralCode) {
      // Retroactive link: If existing user has no partner but provides a referral code
      const partner = await User.findOne({
        "company.referralCode": { $regex: new RegExp(`^${referralCode}$`, "i") },
        role: "partner"
      });
      if (partner) {
        guestUser.referredBy = partner._id;
        await guestUser.save();
        console.log("✅ Retroactively linked existing user to partner:", partner.fullName);
      }
    }
    const userId = guestUser._id;
    let userfcmtoken;
    userfcmtoken = await fcmTokenss.findOne({ userId });
    if (deviceId) {
      if (!userfcmtoken) {
        userfcmtoken = await fcmTokenss.findOne({ deviceId });
      }

      if (!userfcmtoken) {
        const newFcmToken = new fcmTokenss({
          userId,
          deviceId,
          token: fcmToken,
        });
        userfcmtoken = await newFcmToken.save();
      }

      //update userfcmtoken
      userfcmtoken.token = fcmToken;
      userfcmtoken.userId = userId;
      await userfcmtoken.save();

    }

    if (company && (company.name || company.gstNumber)) {
      await User.findByIdAndUpdate(userId, {
        $set: {
          "company.name": company.name || "",
          "company.gstNumber": company.gstNumber || null
        }
      });
    }

    // Step 2: Prepare items and price
    let items = [];
    let subTotal = 0;
    let courseIdsToEnroll = new Set();

    if (effectiveCoursePlanId && (isFallback || mongoose.Types.ObjectId.isValid(effectiveCoursePlanId))) {
      const CoursePlan = (await import('../models/CoursePlan.js')).default;
      let plan;
      if (isFallback) {
        plan = { _id: effectiveCoursePlanId, courseId: courseId, price: 0, salePrice: 0, status: 'active' };
        // If it's a fallback, we skip DB lookup and use provided info
      } else {
        plan = await safeFindCoursePlan(CoursePlan, effectiveCoursePlanId, (typeof courseId !== 'undefined' ? courseId : null));
      }
      if (!plan) return res.status(404).json({ message: "Course plan not found" });
      subTotal += plan.salePrice !== undefined ? Number(plan.salePrice) : Number(plan.price || 0);
      items.push({
        courseId: plan.courseId,
        coursePlanId: plan._id,
        type: "coursePlan",
        pricePaid: plan.salePrice !== undefined ? Number(plan.salePrice) : Number(plan.price || 0),
        currency: plan.currency || "INR",
      });
      courseIdsToEnroll.add(plan.courseId.toString());
    } else if (courseId) {
      const course = await Course.findById(courseId);
      if (!course) return res.status(404).json({ message: "Course not found" });
      const price = course.salePrice && parseFloat(course.salePrice) > 0
        ? parseFloat(course.salePrice)
        : parseFloat(course.price || 0);
      subTotal += price;
      items.push({
        courseId: course._id,
        type: "course",
        pricePaid: price,
        currency: course.currency || "INR",
      });
      courseIdsToEnroll.add(course._id.toString());
    } else if (courseBundleId) {
      const bundle = await CourseBundle.findById(courseBundleId).populate("courses");
      if (!bundle) return res.status(404).json({ message: "Bundle not found" });
      const price = parseFloat(bundle.price || 0);
      subTotal += price;
      items.push({
        courseBundleId: bundle._id,
        type: "courseBundle",
        pricePaid: price,
        currency: bundle.currency || "INR",
      });
      bundle.courses.forEach((course) => courseIdsToEnroll.add(course._id.toString()));
    } else if (ebookId) {
      const ebook = await Ebook.findById(ebookId);
      if (!ebook) return res.status(404).json({ message: "Ebook not found" });
      const price = parseFloat(ebook.price || 0);
      subTotal += price;
      items.push({
        ebookId: ebook._id,
        type: "ebook",
        pricePaid: price,
        currency: "INR",
      });
    }

    // Razorpay payment capture logic will be moved after grandTotal calculation

    // Step 3: Apply coupon
    let discount = 0;
    if (couponCode) {
      try {
        const validationResult = await validateCoupon(couponCode, subTotal, userId);
        discount = validationResult.discountAmount;
        const coupon = await Coupon.findById(validationResult.coupon._id);
        if (coupon) {
          const userIndex = coupon.usedBy.findIndex(
            (user) => user.userId.toString() === userId.toString()
          );
          if (userIndex !== -1) {
            coupon.usedBy[userIndex].usageCount += 1;
          } else {
            coupon.usedBy.push({ userId: userId, usageCount: 1 });
          }
          await coupon.save();
        }
      } catch (err) {
        return res.status(400).json({ message: `Coupon validation failed: ${err.message}` });
      }
    }

    // Step 4: Fetch GST rate
    let GST_RATE;
    try {
      GST_RATE = await Setting.getGstRate(); // Get GST rate (defaults to 0.18)
    } catch (err) {
      console.error("Error fetching GST rate:", err);
      return res.status(500).json({ message: "Failed to fetch GST rate", error: err.message });
    }
    const taxableAmount = subTotal - discount;
    const tax = parseFloat((taxableAmount * GST_RATE).toFixed(2)); // Calculate GST
    const grandTotal = parseFloat((taxableAmount + tax).toFixed(2)); // Add GST to grand total

    // Validate paymentId only if not free
    if (grandTotal > 0 && paymentProvider === "razorpay" && !paymentId) {
      return res.status(400).json({ message: "Payment ID is required for Razorpay" });
    }


    // Razorpay payment capture logic (Moved here after grandTotal calculation)
    if (paymentProvider === "razorpay" && paymentId && grandTotal > 0) {
      const keySetting = await Setting.findOne({ key: "RAZORPAY_KEY_ID" });
      const secretSetting = await Setting.findOne({ key: "RAZORPAY_KEY_SECRET" });
      const apiKey = keySetting?.value;
      const apiSecret = secretSetting?.value;
      if (!apiKey || !apiSecret) {
        return res.status(500).json({ message: "Razorpay credentials not found in settings" });
      }

      const razorpayPaymentId = paymentId;
      const amount = Math.round(grandTotal * 100); // Use grandTotal in paise
      const currency = 'INR';
      const url = `https://api.razorpay.com/v1/payments/${razorpayPaymentId}`;
      const captureUrl = `${url}/capture`;
      const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      };

      console.log(`Razorpay Capture: Amount=${amount}, Currency=${currency}, PaymentId=${razorpayPaymentId}`);
      // Check payment status before capturing
      try {
        const paymentRes = await axios.get(url, { headers });
        console.log("Razorpay Payment Status:", paymentRes.data.status);
        if (paymentRes.data && paymentRes.data.status === "captured") {
          console.log("Razorpay payment already captured, skipping capture step.");
        } else {
          const postData = { amount, currency };
          const razorpayRes = await axios.post(captureUrl, postData, { headers });
          console.log("Razorpay Capture Response Status:", razorpayRes.status);
          if (razorpayRes.status !== 200 && razorpayRes.status !== 201) {
            console.error("Razorpay Capture Failed:", razorpayRes.data);
            return res.status(400).json({ message: 'Failed to capture payment with Razorpay.' });
          }
        }
      } catch (err) {
        console.error("Razorpay Capture Error:", err.response?.data || err.message);
        if (err.response?.data?.error?.code === "BAD_REQUEST_ERROR" &&
          err.response?.data?.error?.description?.includes("already been captured")) {
          console.log("Razorpay payment already captured (error response), skipping capture step.");
        } else {
          return res.status(400).json({ message: 'Failed to capture payment with Razorpay: ' + (err.response?.data?.error?.description || err.message) });
        }
      }
    }

    // Get partner referral info if user was referred by a partner
    const partnerReferralInfo = await getPartnerReferralInfo(userId);

    // ✅ Block duplicate manual payment if one is already pending for this user
    if (paymentProvider === 'manual') {
      const existingPendingOrder = await Order.findOne({
        userId,
        'payment.provider': 'manual',
        'payment.status': 'pending',
      });
      if (existingPendingOrder) {
        return res.status(400).json({
          message: 'Your payment is already pending. Please wait for admin approval.',
        });
      }
    }

    let defaultEnrolledStudentsCount;
    try {
      defaultEnrolledStudentsCount = await Setting.getDefaultEnrolledStudentsCount();
      //console.log("Default enrolled students count fetched:", defaultEnrolledStudentsCount); // Debug log
    } catch (err) {
      console.error("Error fetching default enrolled students count:", err);
      return res.status(500).json({ message: "Failed to fetch default enrolled students count", error: err.message });
    }

    // Step 5: Create order
    const newOrder = await Order.create({
      orderNo: await generateOrderNumber(),
      userId,
      items,
      subTotal,
      discount,
      tax,
      gstRate: GST_RATE,
      grandTotal,
      payment: {
        paymentIntent: paymentId || null,
        provider: paymentProvider,
        status: paymentProvider === "razorpay" ? "paid" : "pending",
      },
      company: {
        name: company?.name || "",
        gstNumber: company?.gstNumber || null
      },
      referredByPartner: partnerReferralInfo || {
        partnerId: null,
        referralCode: null,
        partnerName: null,
        partnerEmail: null
      }
    });

    // === HTML Invoice Generation with Puppeteer ===
    const invoiceDir = path.join(process.cwd(), "uploads", "invoices"); // <-- fixed directory name
    if (!fs.existsSync(invoiceDir)) {
      fs.mkdirSync(invoiceDir, { recursive: true });
    }
    const invoiceFileName = `invoice_${newOrder._id}.pdf`;
    const invoiceFilePath = path.join(invoiceDir, invoiceFileName);

    // Render HTML and generate PDF buffer
    try {
      //console.log("Generating invoice HTML for order:", newOrder._id);
      const invoiceHtml = renderInvoiceHtml(newOrder, guestUser, company);
      //console.log("Invoice HTML generated. Creating PDF...");
      const pdfBuffer = await htmlToPdfBuffer(invoiceHtml);
      fs.writeFileSync(invoiceFilePath, pdfBuffer);
      //console.log("Invoice PDF written to:", invoiceFilePath);
      // Update order with invoice file name only
      newOrder.invoice_url = invoiceFileName;
      await newOrder.save();
      //console.log("Order updated with invoice_url:", invoiceFileName);
    } catch (invoiceErr) {
      console.error("âŒ Invoice generation failed for order:", newOrder._id, invoiceErr);
      // Optionally: continue without failing the whole buyNow process
    }

    // Step 6: Enroll guest user
    if (paymentProvider !== "manual") {
      for (const item of items) {
        if (item.type === "coursePlan" && item.coursePlanId) {
          const CoursePlan = (await import('../models/CoursePlan.js')).default;
          const plan = await safeFindCoursePlan(CoursePlan, item.coursePlanId, (typeof item.courseId !== 'undefined' ? item.courseId : null));
          if (!plan) continue;
          // Only use plan's durationType/duration for accessType/expiry
          let accessType = (plan.durationType || "lifetime").toLowerCase();
          let enrolledAt = new Date();
          let accessExpiry = null;
          if (plan.duration && (accessType === "month" || accessType === "year" || accessType === "day")) {
            let expiry = new Date(enrolledAt);
            if (accessType === "month") {
              expiry.setMonth(expiry.getMonth() + Number(plan.duration));
            } else if (accessType === "year") {
              expiry.setFullYear(expiry.getFullYear() + Number(plan.duration));
            } else if (accessType === "day") {
              expiry.setDate(expiry.getDate() + Number(plan.duration));
            } else {
              expiry.setDate(expiry.getDate() + Number(plan.duration));
            }
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
            orderId: newOrder._id,
            coursePlanId: plan._id
          });
          // Update course enrolledStudents
          const course = await Course.findById(plan.courseId);
          if (course && !course.enrolledStudents.includes(userId)) {
            course.enrolledStudents.push(userId);
            if (course.enrolledStudentsCount == null || course.enrolledStudentsCount === 0) {
              course.enrolledStudentsCount = defaultEnrolledStudentsCount;
            }
            course.enrolledStudentsCount += 1;
            await course.save();
          }
          // Add user to course chat room
          const room = await CourseChatRoom.findOne({ courseId: plan.courseId });
          if (room && !room.participants.includes(userId)) {
            room.participants.push(userId);
            await room.save();
          }
        } else if (item.type === "course" && item.courseId) {
          const existingEnrollment = await CourseEnrollment.findOne({
            userId,
            courseId: item.courseId,
            status: "active",
          });
          const course = await Course.findById(item.courseId);
          if (!course) {
            throw new Error(`Course ${item.courseId} not found`);
          }
          let accessType = course.accessType || "lifetime";
          let enrolledAt = new Date();
          let accessExpiry = null;
          if (
            (accessType === "limited" || accessType === "subscription") &&
            course.accessPeriod
          ) {
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
            if (years > 0 || months > 0 || days > 0) {
              accessExpiry = expiry;
            }
          }
          if (!existingEnrollment) {
            await CourseEnrollment.create({
              userId,
              courseId: item.courseId,
              type: "course",
              enrolledAt,
              enrollmentSource: "purchase",
              accessType,
              accessExpiry,
              orderId: newOrder._id,
            });

            if (!course.enrolledStudents.includes(userId)) {
              course.enrolledStudents.push(userId);
              if (course.enrolledStudentsCount === 0) {
                course.enrolledStudentsCount = defaultEnrolledStudentsCount;
              }
              course.enrolledStudentsCount += 1;
              await course.save();
            }
          }
          // Add user to course chat room
          const room = await CourseChatRoom.findOne({ courseId: item.courseId });
          if (room && !room.participants.includes(userId)) {
            room.participants.push(userId);
            await room.save();
          }
        } else if (item.type === "courseBundle" && item.courseBundleId) {
          const bundle = await CourseBundle.findById(item.courseBundleId).populate("courses");
          if (!bundle || !bundle.courses) {
            throw new Error(`Course bundle ${item.courseBundleId} or its courses not found`);
          }
          for (const course of bundle.courses) {
            if (course._id) {
              const existingEnrollment = await CourseEnrollment.findOne({
                userId,
                courseId: course._id,
                status: "active",
              });
              let accessType = course.accessType || "lifetime";
              let enrolledAt = new Date();
              let accessExpiry = null;
              if (
                (accessType === "limited" || accessType === "subscription") &&
                course.accessPeriod
              ) {
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
                if (years > 0 || months > 0 || days > 0) {
                  accessExpiry = expiry;
                }
              }
              if (!existingEnrollment) {
                await CourseEnrollment.create({
                  userId,
                  courseId: course._id,
                  type: "groupCourse",
                  enrolledAt,
                  enrollmentSource: "purchase",
                  accessType,
                  accessExpiry,
                  orderId: newOrder._id,
                });
                const courseToUpdate = await Course.findById(course._id);
                if (!courseToUpdate) {
                  throw new Error(`Course ${course._id} not found`);
                }
                if (!courseToUpdate.enrolledStudents.includes(userId)) {
                  courseToUpdate.enrolledStudents.push(userId);
                  if (courseToUpdate.enrolledStudentsCount === 0) {
                    courseToUpdate.enrolledStudentsCount = defaultEnrolledStudentsCount;
                  }
                  courseToUpdate.enrolledStudentsCount += 1;
                  await courseToUpdate.save();
                }
              }
              // Add user to course chat room for each course in bundle
              const room = await CourseChatRoom.findOne({ courseId: course._id });
              if (room && !room.participants.includes(userId)) {
                room.participants.push(userId);
                await room.save();
              }
            }
          }
          let bundleAccessType = bundle.accessType || "lifetime";
          let bundleEnrolledAt = new Date();
          let bundleAccessExpiry = null;
          if (
            (bundleAccessType === "limited" || bundleAccessType === "subscription") &&
            bundle.accessPeriod
          ) {
            const periodStr = bundle.accessPeriod.trim().toLowerCase();
            let years = 0, months = 0, days = 0;
            const yearMatch = periodStr.match(/(\d+)\s*year/);
            const monthMatch = periodStr.match(/(\d+)\s*month/);
            const dayMatch = periodStr.match(/(\d+)\s*day/);
            if (yearMatch) years = parseInt(yearMatch[1], 10);
            if (monthMatch) months = parseInt(monthMatch[1], 10);
            if (dayMatch) days = parseInt(dayMatch[1], 10);
            let expiry = new Date(bundleEnrolledAt);
            if (years > 0) expiry.setFullYear(expiry.getFullYear() + years);
            if (months > 0) expiry.setMonth(expiry.getMonth() + months);
            if (days > 0) expiry.setDate(expiry.getDate() + days);
            if (years > 0 || months > 0 || days > 0) {
              bundleAccessExpiry = expiry;
            }
          }
          await CourseEnrollment.create({
            userId,
            courseBundleId: item.courseBundleId,
            type: "courseBundle",
            enrolledAt: bundleEnrolledAt,
            enrollmentSource: "purchase",
            accessType: bundleAccessType,
            accessExpiry: bundleAccessExpiry,
            orderId: newOrder._id,
          });

          if (!bundle.enrolledStudents.includes(userId)) {
            bundle.enrolledStudents.push(userId);
            await bundle.save();
          }
        } else if (item.type === "ebook" && item.ebookId) {
          // No enrollment needed for ebooks per user request
        }
      }
    }

    // Step 7: Token generation and email
    let oldAccessToken =
      req.cookies?.accessToken ||
      (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : undefined) ||
      req.headers["x-access-token"];

    // let oldAccessTokenExp = null;
    // if (oldAccessToken) {
    //   const decoded = jwt.decode(oldAccessToken);
    //   oldAccessTokenExp = decoded?.exp ? decoded.exp * 1000 : null;
    // }

    const { accessToken, refreshToken } =
      await Token.generateTokens(guestUser, oldAccessToken);

    const redis = await initRedis();
    if (redis) {
      // Corrected setEx signature: (key, seconds, value)
      // Setting a 7-day expiry (604800 seconds)
      await redis.setEx(`accessToken:${accessToken}`, 604800, "valid");
      await redis.setEx(`refreshToken:${refreshToken}`, 604800, userId.toString());
    }


    //console.log("ðŸ”§ Token expiration times:", {
    //   accessTokenExp,
    //   refreshTokenExp,
    //   currentTime,
    //   accessMaxAge,
    //   refreshMaxAge
    // });

    Token.setTokensCookies(res, accessToken, refreshToken);

    try {
      // Only send password if user is new
      await emailService.sendOrderConfirmationEmail(
        guestEmail,
        guestName || 'User',
        isNewUser ? "student" : undefined // <-- Only pass password if new user
      );
      //console.log("âœ… Order confirmation email sent successfully");
    } catch (emailError) {
      console.error("âŒ Email sending failed:", emailError);
    }

    userfcmtoken = await fcmTokenss.findOne({ userId });

    const fcmTokens = await fcmTokenss.findOne({ userId });

    if (fcmTokens) {
      // Send push notification
      const data = {
        title: "Course Purchase Notification",
        description: "Your course has been purchased successfully.",
        order_id: newOrder._id.toString(),
        type: "new_order",
      };
      const notiresponse = await notificationService.sendPushNotification(fcmTokens.token, data);
      //console.log("Push notification response:", notiresponse);

      //save notification response
      if (notiresponse.success) {
        const notification = new Notification({
          data,
          status: 0,
          user_id: userId,
        });
        await notification.save();
      }
    }

    // Verify final enrolledStudentsCount
    if (courseId) {
      const course = await Course.findById(courseId);
      //console.log("Final enrolledStudentsCount for course:", { courseId, enrolledStudentsCount: course.enrolledStudentsCount }); // Debug log
    }

    return res.status(201).json({
      message: "Buy Now successful",
      order: {
        ...newOrder.toObject(),
        tax: newOrder.tax.toString(),
        gstRate: newOrder.gstRate.toString(),
        subTotal: newOrder.subTotal.toString(),
        discount: newOrder.discount.toString(),
        grandTotal: newOrder.grandTotal.toString(),
        invoice_url: newOrder.invoice_url
      },
      guestUser,
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error("❌ Buy Now failed:", error);
    if (error.stack) console.error(error.stack);
    return res.status(500).json({
      message: "Buy Now failed",
      error: error.message,
      stack: error.stack // Add stack for debugging
    });
  }
};

/**
 * POST /checkout/verify-cashfree
 * Called by frontend after Cashfree redirects back with ?order_id=xxx
 * Verifies payment status with Cashfree API and marks order paid in DB.
 */
export const verifyCashfreePayment = async (req, res) => {
  try {
    const cashfreeOrderId = req.body.order_id || req.body.cashfreeOrderId; // Support both names

    if (!cashfreeOrderId) {
      return res.status(400).json({ success: false, message: 'cashfreeOrderId is required' });
    }

    const { getCashfreeHeaders: getHeaders, getCashfreeBaseUrl: getBaseUrl } = await import('../config/cashfree.js');
    const cfHeaders = await getHeaders();
    const cfBaseUrl = getBaseUrl();

    const cfRes = await axios.get(`${cfBaseUrl}/orders/${cashfreeOrderId}`, { headers: cfHeaders });
    const cfOrder = cfRes.data;

    if (!cfOrder || cfOrder.order_status !== 'PAID') {
      return res.status(402).json({
        success: false,
        message: `Payment not completed. Status: ${cfOrder?.order_status || 'unknown'}`,
        status: cfOrder?.order_status
      });
    }

    // Payment verified — update matching DB order if it exists
    const order = await Order.findOneAndUpdate(
      { 'payment.paymentIntent': cashfreeOrderId },
      { 'payment.status': 'paid' },
      { new: true }
    ).populate('userId');

    if (order) {
      const userId = order.userId._id;
      const items = order.items;

      for (const item of items) {
        if (item.type === 'partnerRegistration') {
          // Approve the partner user
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

                    const room = await CourseChatRoom.findOne({ courseId: plan.courseId });
                    if (room && !room.participants.includes(partnerUser._id)) {
                      room.participants.push(partnerUser._id);
                      await room.save();
                    }
                    console.log(`✅ Partner ${partnerUser.fullName} auto-enrolled in registration course: ${courseId}`);
                  }
                } catch (enrollErr) {
                  console.error("⚠️ Partner auto-enrollment failed during Cashfree verify:", enrollErr);
                }
              }
            }
            await partnerUser.save();
            console.log(`✅ Partner ${partnerUser.fullName} auto-approved via Cashfree Verify`);

            // Send confirmation email
            try {
              await emailService.sendOrderConfirmationEmail(partnerUser.email, partnerUser.fullName);
            } catch (emailErr) {
              console.error("Auto-approval email failed:", emailErr);
            }
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      order_id: cashfreeOrderId,
      order_status: cfOrder.order_status,
    });
  } catch (error) {
    console.error('❌ verifyCashfreePayment error:', error?.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: error?.response?.data?.message || error.message
    });
  }
};
