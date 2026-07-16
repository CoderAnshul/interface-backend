import mongoose from "mongoose";
import dotenv from "dotenv";
import Setting from "../models/setting.js";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const addRazorpayKeys = async () => {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!mongoUri) {
            console.error("❌ MONGO_URI not found in environment variables");
            console.log("Please set MONGO_URI in your .env file");
            process.exit(1);
        }

        await mongoose.connect(mongoUri);
        console.log("✅ Connected to MongoDB");

        // Your Razorpay keys
        const razorpayKeyId = "rzp_test_1234567890";
        const razorpayKeySecret = "rzp1234567890this is my keys";

        // Check if keys already exist
        let existingKeyId = await Setting.findOne({ key: "RAZORPAY_KEY_ID" });
        let existingKeySecret = await Setting.findOne({ key: "RAZORPAY_KEY_SECRET" });

        // Update or create RAZORPAY_KEY_ID
        if (existingKeyId) {
            existingKeyId.value = razorpayKeyId;
            await existingKeyId.save();
            console.log("✅ Updated RAZORPAY_KEY_ID");
        } else {
            await Setting.create({
                key: "RAZORPAY_KEY_ID",
                value: razorpayKeyId,
                description: "Razorpay API Key ID for payment processing"
            });
            console.log("✅ Created RAZORPAY_KEY_ID");
        }

        // Update or create RAZORPAY_KEY_SECRET
        if (existingKeySecret) {
            existingKeySecret.value = razorpayKeySecret;
            await existingKeySecret.save();
            console.log("✅ Updated RAZORPAY_KEY_SECRET");
        } else {
            await Setting.create({
                key: "RAZORPAY_KEY_SECRET",
                value: razorpayKeySecret,
                description: "Razorpay API Key Secret for payment processing"
            });
            console.log("✅ Created RAZORPAY_KEY_SECRET");
        }

        console.log("\n✅ Razorpay keys have been successfully added to the database!");
        console.log("\n📋 Summary:");
        console.log(`   RAZORPAY_KEY_ID: ${razorpayKeyId}`);
        console.log(`   RAZORPAY_KEY_SECRET: ${razorpayKeySecret.substring(0, 10)}...`);

        await mongoose.disconnect();
        console.log("\n✅ Database connection closed");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error adding Razorpay keys:", error.message);
        if (error.code === 11000) {
            console.error("   Duplicate key error - keys may already exist");
        }
        await mongoose.disconnect();
        process.exit(1);
    }
};

addRazorpayKeys();

