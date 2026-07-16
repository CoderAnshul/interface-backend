import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/user.js";
import Order from "../models/Order.js";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const testPartnerReferralFlow = async () => {
    try {
        console.log("🧪 Starting Partner Referral Flow Test...\n");

        // Connect to MongoDB
        const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!mongoUri) {
            console.error("❌ MONGO_URI not found");
            process.exit(1);
        }

        await mongoose.connect(mongoUri);
        console.log("✅ Connected to MongoDB\n");

        // Test 1: Check if there are any partners
        const partners = await User.find({ role: 'partner' }).limit(5);
        console.log(`📊 Found ${partners.length} partner(s)`);
        if (partners.length > 0) {
            partners.forEach((p, i) => {
                console.log(`   ${i + 1}. ${p.fullName} - Code: ${p.company?.referralCode || 'N/A'}`);
            });
        }

        // Test 2: Check students with referrals
        const studentsWithReferrals = await User.find({ 
            role: 'student',
            referredBy: { $ne: null }
        }).limit(10);

        console.log(`\n📊 Found ${studentsWithReferrals.length} student(s) with partner referrals`);
        if (studentsWithReferrals.length > 0) {
            for (const student of studentsWithReferrals.slice(0, 5)) {
                const partner = await User.findById(student.referredBy);
                console.log(`   - ${student.fullName} (${student.email})`);
                console.log(`     Referred by: ${partner?.fullName || 'Unknown'} (${partner?.company?.referralCode || 'N/A'})`);
            }
        }

        // Test 3: Check orders with partner referrals
        const ordersWithReferrals = await Order.find({
            "referredByPartner.partnerId": { $ne: null }
        }).limit(10);

        console.log(`\n📊 Found ${ordersWithReferrals.length} order(s) with partner referrals`);
        if (ordersWithReferrals.length > 0) {
            for (const order of ordersWithReferrals.slice(0, 5)) {
                const student = await User.findById(order.userId);
                console.log(`   Order: ${order.orderNo}`);
                console.log(`   Student: ${student?.fullName || 'Unknown'} (${student?.email || 'N/A'})`);
                console.log(`   Partner: ${order.referredByPartner?.partnerName || 'Unknown'} (${order.referredByPartner?.referralCode || 'N/A'})`);
                console.log(`   Amount: ₹${parseFloat(order.grandTotal.toString()).toFixed(2)}`);
                console.log(`   Date: ${order.createdAt.toLocaleDateString()}`);
                console.log("");
            }
        } else {
            console.log("   ⚠️  No orders found with partner referrals");
            console.log("   💡 Make sure students have purchased after signing up with referral codes");
        }

        // Test 4: Statistics
        const totalOrders = await Order.countDocuments({
            "referredByPartner.partnerId": { $ne: null },
            "payment.status": "paid"
        });

        const totalRevenue = await Order.aggregate([
            {
                $match: {
                    "referredByPartner.partnerId": { $ne: null },
                    "payment.status": "paid"
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $toDouble: "$grandTotal" } }
                }
            }
        ]);

        const uniqueStudents = await Order.distinct("userId", {
            "referredByPartner.partnerId": { $ne: null }
        });

        console.log("\n📈 Statistics:");
        console.log(`   Total Paid Orders: ${totalOrders}`);
        console.log(`   Total Revenue: ₹${totalRevenue[0]?.total?.toFixed(2) || 0}`);
        console.log(`   Unique Students: ${uniqueStudents.length}`);

        // Test 5: Partner breakdown
        const partnerBreakdown = await Order.aggregate([
            {
                $match: {
                    "referredByPartner.partnerId": { $ne: null },
                    "payment.status": "paid"
                }
            },
            {
                $group: {
                    _id: "$referredByPartner.partnerId",
                    partnerName: { $first: "$referredByPartner.partnerName" },
                    referralCode: { $first: "$referredByPartner.referralCode" },
                    totalOrders: { $sum: 1 },
                    totalRevenue: { $sum: { $toDouble: "$grandTotal" } },
                    students: { $addToSet: "$userId" }
                }
            },
            {
                $project: {
                    partnerName: 1,
                    referralCode: 1,
                    totalOrders: 1,
                    totalRevenue: 1,
                    totalStudents: { $size: "$students" }
                }
            },
            { $sort: { totalRevenue: -1 } }
        ]);

        if (partnerBreakdown.length > 0) {
            console.log("\n👥 Partner Breakdown:");
            partnerBreakdown.forEach((p, i) => {
                console.log(`   ${i + 1}. ${p.partnerName || 'Unknown'} (${p.referralCode || 'N/A'})`);
                console.log(`      Orders: ${p.totalOrders}, Revenue: ₹${p.totalRevenue.toFixed(2)}, Students: ${p.totalStudents}`);
            });
        }

        // Test 6: Check for orders without partner referrals (should still work)
        const ordersWithoutReferrals = await Order.countDocuments({
            $or: [
                { "referredByPartner.partnerId": null },
                { "referredByPartner": { $exists: false } }
            ]
        });

        console.log(`\n📊 Orders without partner referrals: ${ordersWithoutReferrals}`);
        console.log("   ✅ These orders should still work normally");

        // Summary
        console.log("\n" + "=".repeat(50));
        console.log("✅ Test Summary:");
        console.log(`   - Partners: ${partners.length}`);
        console.log(`   - Students with referrals: ${studentsWithReferrals.length}`);
        console.log(`   - Orders with referrals: ${ordersWithReferrals.length}`);
        console.log(`   - Total revenue from referrals: ₹${totalRevenue[0]?.total?.toFixed(2) || 0}`);
        console.log("=".repeat(50));

        if (ordersWithReferrals.length > 0) {
            console.log("\n✅ Partner referral tracking is WORKING!");
        } else {
            console.log("\n⚠️  No orders with partner referrals found.");
            console.log("   This could mean:");
            console.log("   1. No students have purchased yet");
            console.log("   2. Students didn't sign up with referral codes");
            console.log("   3. Orders were created before the feature was implemented");
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error("❌ Test Error:", error);
        await mongoose.disconnect();
        process.exit(1);
    }
};

testPartnerReferralFlow();

