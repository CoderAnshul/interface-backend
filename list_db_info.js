import mongoose from 'mongoose';
import CourseCategory from './models/CourseCategory.js';
import SubCategory from './models/SubCategory.js';
import User from './models/user.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI;

async function listInfo() {
    try {
        console.log('Connecting with MONGO_URI:', MONGO_URI ? 'FOUND (hidden for security)' : 'NOT FOUND');
        if (!MONGO_URI) {
            throw new Error('MONGO_URI is undefined. Check if .env exists in INTERFACE-backend.');
        }
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const categories = await CourseCategory.find({ isDeleted: false });
        console.log('--- Categories ---');
        categories.forEach(c => console.log(`Category: "${c.name}", Slug: "${c.slug}", ID: ${c._id}`));

        const subcategories = await SubCategory.find({ isDeleted: false });
        console.log('\n--- Subcategories ---');
        subcategories.forEach(s => console.log(`Subcategory: "${s.name}", CategoryId: ${s.categoryId}, ID: ${s._id}`));

        const users = await User.find({ role: { $in: ['admin', 'instructor'] } }).limit(5);
        console.log('\n--- Users (Admins/Instructors) ---');
        users.forEach(u => console.log(`User: "${u.name}", Email: "${u.email}", Role: "${u.role}", ID: ${u._id}`));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

listInfo();
