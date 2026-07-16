import mongoose from "mongoose";
import dotenv from "dotenv";
import Setting from "../models/setting.js";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const setupRazorpayKeys = async () => {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!mongoUri) {
            console.error("❌ MONGO_URI not found in environment variables");
            process.exit(1);
        }

        await mongoose.connect(mongoUri);
        console.log("✅ Connected to MongoDB");

        // Get Razorpay keys from environment variables or use defaults for testing
        const razorpayKeyId = process.env.RAZORPAY_KEY_ID || "rzp_test_xxxxxxxxxxxx";
        const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || "your_razorpay_secret_key";

        // Check if keys already exist
        const existingKeyId = await Setting.findOne({ key: "RAZORPAY_KEY_ID" });
        const existingKeySecret = await Setting.findOne({ key: "RAZORPAY_KEY_SECRET" });

        if (existingKeyId) {
            console.log("⚠️  RAZORPAY_KEY_ID already exists. Updating...");
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

        if (existingKeySecret) {
            console.log("⚠️  RAZORPAY_KEY_SECRET already exists. Updating...");
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

        console.log("\n✅ Razorpay keys setup completed successfully!");
        console.log("\n📝 Note: Make sure to update these values with your actual Razorpay keys:");
        console.log("   - RAZORPAY_KEY_ID: Your Razorpay Key ID");
        console.log("   - RAZORPAY_KEY_SECRET: Your Razorpay Key Secret");
        console.log("\n   You can update them via:");
        console.log("   1. Admin panel settings");
        console.log("   2. MongoDB directly");
        console.log("   3. Running this script with RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env");

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error("❌ Error setting up Razorpay keys:", error);
        await mongoose.disconnect();
        process.exit(1);
    }
};

setupRazorpayKeys();

