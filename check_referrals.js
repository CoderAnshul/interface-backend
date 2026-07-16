import mongoose from 'mongoose';
import User from './models/user.js';
import dotenv from 'dotenv';
dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/dipani_edu';

async function checkPartners() {
    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const partners = await User.find({ role: 'partner' }).select('fullName email company.referralCode').lean();
        console.log('Partners found:', JSON.stringify(partners, null, 2));

        const students = await User.find({ role: 'student' }).sort({ createdAt: -1 }).limit(5).select('fullName email referredBy').lean();
        console.log('Latest students:', JSON.stringify(students, null, 2));

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkPartners();
