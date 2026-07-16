import mongoose from 'mongoose';
import Course from './models/Course.js';
import CoursePlan from './models/CoursePlan.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function check() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const specificId = '691d8153bb431062706f1c43';
        const course = await Course.findById(specificId);
        if (!course) {
            console.log('Course not found:', specificId);
            const allCourses = await Course.find({ isDeleted: false }).limit(20);
            console.log('All course IDs:', allCourses.map(c => c._id.toString()));
        } else {
            console.log('Course found:', course.title);
            const plans = await CoursePlan.find({ courseId: course._id, isDeleted: { $ne: true } });
            console.log('Plans found:', plans.length);
            plans.forEach(p => console.log(`  - Plan: ${p.duration} ${p.durationType}, Status: ${p.status}, ID: ${p._id}`));
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
