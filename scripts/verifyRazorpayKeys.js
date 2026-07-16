import mongoose from "mongoose";
import dotenv from "dotenv";
import Setting from "../models/setting.js";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const verifyRazorpayKeys = async () => {
    try {
        const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!mongoUri) {
            console.error("❌ MONGO_URI not found");
            process.exit(1);
        }

        await mongoose.connect(mongoUri);
        console.log("✅ Connected to MongoDB\n");

        const keyId = await Setting.findOne({ key: "RAZORPAY_KEY_ID" });
        const keySecret = await Setting.findOne({ key: "RAZORPAY_KEY_SECRET" });

        if (keyId && keySecret) {
            console.log("✅ Razorpay keys found in database:");
            console.log(`   RAZORPAY_KEY_ID: ${keyId.value}`);
            console.log(`   RAZORPAY_KEY_SECRET: ${keySecret.value.substring(0, 10)}...`);
            console.log("\n✅ Keys are configured correctly!");
        } else {
            console.log("❌ Razorpay keys not found:");
            if (!keyId) console.log("   - RAZORPAY_KEY_ID is missing");
            if (!keySecret) console.log("   - RAZORPAY_KEY_SECRET is missing");
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error.message);
        await mongoose.disconnect();
        process.exit(1);
    }
};

verifyRazorpayKeys();

