import EbookService from "../service/EbookService.js";
import path from "path";
import jwt from "jsonwebtoken";
import { ServerConfig } from "../config/server.config.js";
import Order from "../models/Order.js";
import Ebook from "../models/Ebook.js";
import User from "../models/user.js";
import UserService from "../service/userService.js";
import { generateOrderNumber } from "../utils/generateOrderNo.js";
import Setting from "../models/setting.js";
import Coupon from "../models/Coupon.js";
// import getRazorpayInstance from "../config/razorpay.js";
import axios from 'axios';
const axiosCf = axios;
import { getCashfreeHeaders, getCashfreeBaseUrl } from "../config/cashfree.js";
import { Token } from "../utils/index.js";
import { initRedis } from "../config/redisClient.js";
import emailService from '../utils/emailService.js';
import notificationService from '../utils/notificationService.js';
import fcmTokenss from "../models/fcmTokens.js";
import Notification from "../models/Notifications.js";
import CourseEnrollment from "../models/CourseEnrollment.js";

const ebookService = new EbookService();
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

// Helper function to get purchased ebook IDs for a user
const getPurchasedEbookIds = async (req) => {
    let authHeader = req.headers.authorization || req.headers["x-access-token"] || req.cookies?.accessToken;
    if (!authHeader) return [];

    let token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;
    try {
        const decoded = jwt.verify(token, ServerConfig.JWT_ACCESS_SECRET);
        const userId = decoded._id || decoded.id;

        if (userId) {
            const purchasedEbookIds = await Order.find({
                userId,
                "payment.status": "paid",
                "items.type": "ebook"
            }).distinct("items.ebookId");

            return purchasedEbookIds.map(id => id.toString());
        }
    } catch (err) {
        // Ignore token errors
    }
    return [];
};

export const createEbook = async (req, res) => {
    try {
        const ebookData = {
            ...req.body,
            thumbnail: req.files?.thumbnail?.[0]?.path.replace(/\\/g, "/"),
            previewFile: req.files?.previewFile?.[0]?.path.replace(/\\/g, "/"),
            fullFile: req.files?.fullFile?.[0]?.path.replace(/\\/g, "/"),
            isFree: req.body.isFree === 'true' || req.body.isFree === true,
            // Ensure numeric values for Decimal128 fields
            price: req.body.price ? parseFloat(req.body.price) : 0,
            salePrice: req.body.salePrice ? parseFloat(req.body.salePrice) : 0,
            pageCount: req.body.pageCount,
            language: req.body.language,
            format: req.body.format,
            authorBio: req.body.authorBio,
            authorImage: req.body.authorImage, // Assuming URL string, or handle file upload if needed separately
            chapters: req.body.chapters ? (typeof req.body.chapters === 'string' ? JSON.parse(req.body.chapters) : req.body.chapters) : [],
            whatYouLearn: req.body.whatYouLearn ? (typeof req.body.whatYouLearn === 'string' ? JSON.parse(req.body.whatYouLearn) : req.body.whatYouLearn) : [],
            requirements: req.body.requirements ? (typeof req.body.requirements === 'string' ? JSON.parse(req.body.requirements) : req.body.requirements) : [],
        };

        // If author image is uploaded file
        if (req.files?.authorImage) {
            ebookData.authorImage = req.files.authorImage[0].path.replace(/\\/g, "/");
        }

        const ebook = await ebookService.create(ebookData);
        return res.status(201).json({
            success: true,
            message: "Ebook created successfully",
            data: ebook,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const getAllEbooks = async (req, res) => {
    try {
        const { page, limit, sortBy, sortOrder, search, ...filter } = req.query;
        const result = await ebookService.getAll({ page, limit, sortBy, sortOrder, search, filter });

        const purchasedIdsStrings = await getPurchasedEbookIds(req);

        // Map over the results and add isPurchased key
        if (result.data && Array.isArray(result.data)) {
            result.data = result.data.map(ebook => {
                const ebookObj = ebook.toObject ? ebook.toObject() : ebook;
                return {
                    ...ebookObj,
                    isPurchased: purchasedIdsStrings.includes(ebookObj._id.toString())
                };
            });
        }

        return res.status(200).json({
            success: true,
            message: "Ebooks retrieved successfully",
            data: result,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const getEbookById = async (req, res) => {
    try {
        const ebook = await ebookService.getById(req.params.id);
        const purchasedIdsStrings = await getPurchasedEbookIds(req);

        const ebookObj = ebook.toObject ? ebook.toObject() : ebook;
        const data = {
            ...ebookObj,
            isPurchased: purchasedIdsStrings.includes(ebookObj._id.toString())
        };

        return res.status(200).json({
            success: true,
            message: "Ebook retrieved successfully",
            data: data,
        });
    } catch (error) {
        return res.status(404).json({
            success: false,
            message: error.message,
        });
    }
};

export const getEbookBySlug = async (req, res) => {
    try {
        const ebook = await ebookService.getBySlug(req.params.slug);
        const purchasedIdsStrings = await getPurchasedEbookIds(req);

        const ebookObj = ebook.toObject ? ebook.toObject() : ebook;
        const data = {
            ...ebookObj,
            isPurchased: purchasedIdsStrings.includes(ebookObj._id.toString())
        };

        return res.status(200).json({
            success: true,
            message: "Ebook retrieved successfully",
            data: data,
        });
    } catch (error) {
        return res.status(404).json({
            success: false,
            message: error.message,
        });
    }
};

export const updateEbook = async (req, res) => {
    try {
        const updateData = { ...req.body };
        if (req.files?.thumbnail) updateData.thumbnail = req.files.thumbnail[0].path.replace(/\\/g, "/");
        if (req.files?.previewFile) updateData.previewFile = req.files.previewFile[0].path.replace(/\\/g, "/");
        if (req.files?.fullFile) updateData.fullFile = req.files.fullFile[0].path.replace(/\\/g, "/");
        if (req.files?.authorImage) updateData.authorImage = req.files.authorImage[0].path.replace(/\\/g, "/");

        // Handle JSON parsing for arrays if they come as strings
        if (updateData.chapters && typeof updateData.chapters === 'string') updateData.chapters = JSON.parse(updateData.chapters);
        if (updateData.whatYouLearn && typeof updateData.whatYouLearn === 'string') updateData.whatYouLearn = JSON.parse(updateData.whatYouLearn);
        if (updateData.requirements && typeof updateData.requirements === 'string') updateData.requirements = JSON.parse(updateData.requirements);

        if (req.body.isFree !== undefined) updateData.isFree = req.body.isFree === 'true' || req.body.isFree === true;

        const ebook = await ebookService.update(req.params.id, updateData);
        return res.status(200).json({
            success: true,
            message: "Ebook updated successfully",
            data: ebook,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const deleteEbook = async (req, res) => {
    try {
        await ebookService.softDelete(req.params.id);
        return res.status(200).json({
            success: true,
            message: "Ebook deleted successfully",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const downloadEbook = async (req, res) => {
    try {
        const fileUrl = await ebookService.getDownloadUrl(req.params.id, req.user);

        // Generate a short-lived token (valid for 5 minutes)
        const downloadToken = jwt.sign(
            { filePath: fileUrl, action: 'download_ebook' },
            ServerConfig.JWT_ACCESS_SECRET,
            { expiresIn: '5m' }
        );

        // Construct the full clickable URL
        const protocol = req.protocol;
        const host = req.get('host');
        const clickableLink = `${protocol}://${host}/ebooks/download-file?token=${downloadToken}`;

        return res.status(200).json({
            success: true,
            message: "Clickable download link generated successfully. Link is valid for 5 minutes.",
            data: {
                downloadUrl: clickableLink
            },
        });
    } catch (error) {
        return res.status(403).json({
            success: false,
            message: error.message,
        });
    }
};

export const serveEbookFile = async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) {
            return res.status(400).send("Download token is missing.");
        }

        // Verify the token
        const decoded = jwt.verify(token, ServerConfig.JWT_ACCESS_SECRET);

        if (decoded.action !== 'download_ebook' || !decoded.filePath) {
            return res.status(400).send("Invalid download token.");
        }

        const filePath = path.join(process.cwd(), decoded.filePath);
        return res.download(filePath);
    } catch (error) {
        return res.status(401).send("Download link has expired or is invalid.");
    }
};

// Validate coupon helper function
const validateCoupon = async (code, orderAmount, userId) => {
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
                `Minimum order amount of ₹${coupon.minOrderAmount} required`
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

export const purchaseEbook = async (req, res) => {
    try {
        // Validate Content-Type
        if (!req.is('application/json')) {
            return res.status(400).json({ message: "Content-Type must be application/json" });
        }

        const {
            ebookId,
            guestEmail,
            guestName,
            paymentId,
            paymentProvider = "cashfree",
            couponCode,
            deviceId,
            fcmToken,
            company,
            referralCode // Extract referralCode
        } = req.body;

        // Step 1: Find or create guest user
        let guestUser = await User.findOne({ email: guestEmail });
        let isNewUser = false;
        if (!guestUser) {
            guestUser = await userService.signup({
                fullName: guestName || "Guest User",
                email: guestEmail,
                password: "student",
                role: "student",
                is_verify: true,
                referralCode: referralCode || "" // Pass referral code for new user
            });
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

        // Step 2: Get ebook and calculate price
        const ebook = await Ebook.findById(ebookId);
        if (!ebook) {
            return res.status(404).json({ message: "Ebook not found" });
        }

        // Calculate price (use salePrice if available, otherwise price)
        let subTotal = 0;
        if (ebook.isFree) {
            subTotal = 0;
        } else {
            subTotal = ebook.salePrice && parseFloat(ebook.salePrice) > 0
                ? parseFloat(ebook.salePrice)
                : parseFloat(ebook.price || 0);
        }

        // Validate paymentId only if not free
        if (subTotal > 0 && paymentProvider === "razorpay" && !paymentId) {
            return res.status(400).json({ message: "Payment ID is required for Razorpay" });
        }


        // Handle FCM token
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
            userfcmtoken.token = fcmToken;
            userfcmtoken.userId = userId;
            await userfcmtoken.save();
        }

        // Update company info if provided
        if (company && (company.name || company.gstNumber)) {
            await User.findByIdAndUpdate(userId, {
                $set: {
                    "company.name": company.name || ""
                }
            });
        }

        // Step 3: Apply coupon
        let discount = 0;
        if (couponCode && subTotal > 0) {
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

        const taxableAmount = subTotal - discount;
        const tax = 0; // GST removed
        const grandTotal = parseFloat(taxableAmount.toFixed(2));
        const GST_RATE = 0; // GST removed

        /*
        // Step 5: Handle Razorpay payment capture (if not free)
        if (paymentProvider === "razorpay" && paymentId && grandTotal > 0) {
            const keySetting = await Setting.findOne({ key: "RAZORPAY_KEY_ID" });
            const secretSetting = await Setting.findOne({ key: "RAZORPAY_KEY_SECRET" });
            const apiKey = keySetting?.value;
            const apiSecret = secretSetting?.value;
            if (!apiKey || !apiSecret) {
                return res.status(500).json({ message: "Razorpay credentials not found in settings" });
            }

            const razorpayPaymentId = paymentId;
            const amount = Math.round(grandTotal * 100); // amount in paise (must match authorized amount)
            if (amount <= 0) {
                return res.status(400).json({ message: "Invalid order amount for Razorpay payment capture." });
            }
            const currency = 'INR';
            const url = `https://api.razorpay.com/v1/payments/${razorpayPaymentId}`;
            const captureUrl = `${url}/capture`;
            const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}`,
            };

            // Check payment status before capturing
            try {
                const paymentRes = await axios.get(url, { headers });
                if (paymentRes.data && paymentRes.data.status === "captured") {
                    console.log("Razorpay payment already captured, skipping capture step.");
                } else {
                    const postData = { amount, currency };
                    const razorpayRes = await axios.post(captureUrl, postData, { headers });
                    if (razorpayRes.status !== 200 && razorpayRes.status !== 201) {
                        return res.status(400).json({ message: 'Failed to capture payment with Razorpay.' });
                    }
                }
            } catch (err) {
                if (err.response?.data?.error?.code === "BAD_REQUEST_ERROR" &&
                    err.response?.data?.error?.description?.includes("already been captured")) {
                    console.log("Razorpay payment already captured (error response), skipping capture step.");
                } else {
                    return res.status(400).json({ message: 'Failed to capture payment with Razorpay: ' + (err.response?.data?.error?.description || err.message) });
                }
            }
        }
        */

        // Get partner referral info if user was referred by a partner
        const partnerReferralInfo = await getPartnerReferralInfo(userId);

        // Step 6: Create order
        const items = [{
            ebookId: ebook._id,
            type: "ebook",
            pricePaid: subTotal,
            currency: ebook.currency || "INR",
        }];

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
                provider: grandTotal === 0 ? "free" : paymentProvider,
                status: grandTotal === 0 || paymentProvider === "razorpay" ? "paid" : "pending",
            },
            company: {
                name: company?.name || ""
            },
            referredByPartner: partnerReferralInfo || {
                partnerId: null,
                referralCode: null,
                partnerName: null,
                partnerEmail: null
            }
        });

        // ── Cashfree: Create a payment session if needed ──────────────────
        if (grandTotal > 0 && paymentProvider === "cashfree") {
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

            const cashfreeOrderId = `ebook_${newOrder._id}_${Date.now()}`;
            newOrder.payment.paymentIntent = cashfreeOrderId;
            await newOrder.save();
            const cashfreePayload = {
                order_id: cashfreeOrderId,
                order_amount: grandTotal,
                order_currency: 'INR',
                customer_details: {
                    customer_id: guestUser ? guestUser._id.toString() : `guest_${Date.now()}`,
                    customer_name: guestName || 'Guest User',
                    customer_email: guestEmail,
                    customer_phone: req.body.phone || '9999999999',
                },
                order_meta: {
                    return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-success?order_id={order_id}`,
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
                        },
                        data: {
                            message: "Cashfree session created",
                            orderId: newOrder._id
                        }
                    });
                }
            } catch (cfError) {
                console.error("Cashfree Session Error:", cfError.response?.data || cfError.message);
                return res.status(500).json({
                    message: "Failed to initiate Cashfree payment",
                    error: cfError.response?.data || cfError.message,
                    is_valid: false
                });
            }
        }

        // Step 8: Update ebook sales count
        ebook.salesCount = (ebook.salesCount || 0) + 1;
        await ebook.save();

        // Step 8: Token generation
        let oldAccessToken =
            req.cookies?.accessToken ||
            (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")
                ? req.headers.authorization.split(" ")[1]
                : undefined) ||
            req.headers["x-access-token"];

        const { accessToken, refreshToken } =
            await Token.generateTokens(guestUser, oldAccessToken);

        const redis = await initRedis();
        if (redis) {
            // Corrected setEx signature: (key, seconds, value)
            // Setting a 7-day expiry (604800 seconds)
            await redis.setEx(`accessToken:${accessToken}`, 604800, "valid");
            await redis.setEx(`refreshToken:${refreshToken}`, 604800, userId.toString());
        }


        Token.setTokensCookies(res, accessToken, refreshToken);

        // Step 9: Send email notification
        try {
            await emailService.sendOrderConfirmationEmail(
                guestEmail,
                guestName || 'User',
                isNewUser ? "student" : undefined
            );
        } catch (emailError) {
            console.error("Email sending failed:", emailError);
        }

        // Step 10: Send push notification
        const fcmTokens = await fcmTokenss.findOne({ userId });
        if (fcmTokens) {
            const data = {
                title: "Ebook Purchase Notification",
                description: "Your ebook has been purchased successfully.",
                order_id: newOrder._id.toString(),
                type: "ebook_purchase",
            };
            const notiresponse = await notificationService.sendPushNotification(fcmTokens.token, data);
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
            success: true,
            message: "Ebook purchased successfully",
            order: {
                ...newOrder.toObject(),
                tax: "0",
                gstRate: "0",
                subTotal: newOrder.subTotal.toString(),
                discount: newOrder.discount.toString(),
                grandTotal: newOrder.grandTotal.toString(),
            },
            ebook: {
                _id: ebook._id,
                title: ebook.title,
                slug: ebook.slug,
            },
            guestUser,
            accessToken,
            refreshToken
        });
    } catch (err) {
        console.error("Purchase Ebook Error:", err);
        return res.status(500).json({
            success: false,
            message: "Ebook purchase failed",
            error: err.message
        });
    }
};

export const getPurchasedEbooks = async (req, res) => {
    try {
        const userId = req.user._id;

        // Find all paid orders for this user that contain ebooks
        const orders = await Order.find({
            userId,
            "payment.status": "paid",
            "items.type": "ebook"
        }).populate("items.ebookId");

        console.log("DEBUG: getPurchasedEbooks found orders:", orders.length);

        // Extract ebook details from the orders
        const ebooksMap = new Map();
        orders.forEach(order => {
            console.log("DEBUG: Processing order:", order._id, "Items count:", order.items.length);
            order.items.forEach(item => {
                console.log("DEBUG: Item type:", item.type, "ebookId:", item.ebookId);
                if (item.type === "ebook" && item.ebookId) {
                    const idStr = item.ebookId._id ? item.ebookId._id.toString() : item.ebookId.toString();
                    console.log("DEBUG: Adding ebook to map with ID:", idStr);
                    ebooksMap.set(idStr, item.ebookId);
                }
            });
        });

        const ebooks = Array.from(ebooksMap.values());
        console.log("DEBUG: Final ebooks count:", ebooks.length);

        return res.status(200).json({
            success: true,
            message: "Purchased ebooks retrieved successfully",
            userId: userId,
            ordersCount: orders.length,
            debug: {
                totalEbooksFound: ebooks.length,
                orderIds: orders.map(o => o._id)
            },
            data: ebooks
        });
    } catch (error) {
        console.error("Get Purchased Ebooks Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve purchased ebooks",
            error: error.message
        });
    }
};
