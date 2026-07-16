
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load env vars
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error("❌ MONGO_URI not found in .env");
    process.exit(1);
}

// Define minimal User schema to avoid importing the whole model file and its dependencies
const userSchema = new mongoose.Schema({
    fullName: String,
    email: String,
    role: String,
    company: {
        referralCode: String,
        name: String
    },
    referralCode: String // Check if this exists at top level too
}, { strict: false }); // strict false to see everything

const User = mongoose.model('User', userSchema);

async function checkPartners() {
    try {
        console.log("Connecting to DB...");
        await mongoose.connect(MONGO_URI);
        console.log("✅ Connected to DB");

        const partners = await User.find({ role: 'partner' }).lean();

        console.log(`Found ${partners.length} partners.`);

        partners.forEach(p => {
            console.log("---------------------------------------------------");
            console.log(`ID: ${p._id}`);
            console.log(`Name: ${p.fullName}`);
            console.log(`Email: ${p.email}`);
            console.log(`Top-level referralCode:`, p.referralCode);
            console.log(`Company object:`, p.company);
            console.log("---------------------------------------------------");
        });

    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected.");
    }
}

checkPartners();
