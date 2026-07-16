
import mongoose from 'mongoose';
import User from './models/user.js';
import CourseEnrollment from './models/CourseEnrollment.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkReferrals() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB.");

        const partners = await User.find({ role: 'partner' }).select('fullName email company.referralCode');
        console.log("\n--- Partners ---");
        partners.forEach(p => {
            console.log(`Partner: ${p.fullName} (${p.email}) - Code: ${p.company?.referralCode} - ID: ${p._id}`);
        });

        const students = await User.find({ referredBy: { $ne: null } }).select('fullName email referredBy');
        console.log("\n--- Referred Students ---");
        if (students.length === 0) {
            console.log("No students found with referredBy set.");
        } else {
            for (const s of students) {
                const enrollments = await CourseEnrollment.find({ userId: s._id }).countDocuments();
                console.log(`Student: ${s.fullName} (${s.email}) - ReferredBy ID: ${s.referredBy} - Courses: ${enrollments}`);
            }
        }

        // Check recent student signups even without referredBy
        const recentStudents = await User.find({ role: 'student' }).sort({ createdAt: -1 }).limit(5).select('fullName email referredBy createdAt');
        console.log("\n--- Recent Students ---");
        recentStudents.forEach(s => {
            console.log(`Student: ${s.fullName} (${s.email}) - ReferredBy: ${s.referredBy} - Created: ${s.createdAt}`);
        });

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkReferrals();
