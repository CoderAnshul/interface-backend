import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

import Course from "../models/Course.js";
import CourseCategory from "../models/CourseCategory.js";
import SubCategory from "../models/SubCategory.js";
import User from "../models/user.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const createDummyCourse = async () => {
    try {
        const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!mongoUri) {
            console.error("❌ MONGO_URI not found");
            process.exit(1);
        }

        await mongoose.connect(mongoUri);
        console.log("✅ Connected to MongoDB");

        // 1. Find or create Category: "Class 11"
        let category = await CourseCategory.findOne({ name: "Class 11", isDeleted: false });
        if (!category) {
            category = new CourseCategory({
                name: "Class 11",
                slug: "class-11",
                status: "active"
            });
            await category.save();
            console.log(`✅ Category "Class 11" created (ID: ${category._id})`);
        } else {
            console.log(`ℹ️ Category "Class 11" already exists (ID: ${category._id})`);
        }

        // 2. Find or create Subcategory: "Physics"
        let subCategory = await SubCategory.findOne({ name: "Physics", categoryId: category._id, isDeleted: false });
        if (!subCategory) {
            subCategory = new SubCategory({
                name: "Physics",
                slug: "physics",
                categoryId: category._id,
                status: "active"
            });
            await subCategory.save();
            console.log(`✅ Subcategory "Physics" created (ID: ${subCategory._id})`);
        } else {
            console.log(`ℹ️ Subcategory "Physics" already exists (ID: ${subCategory._id})`);
        }

        // 3. Find instructor (defaulting to the admin we retrieved, or any available admin/instructor)
        let instructor = await User.findOne({ role: { $in: ["admin", "instructor"] } });
        const instructorId = instructor ? instructor._id : new mongoose.Types.ObjectId();
        console.log(`ℹ️ Using instructor: ${instructor ? instructor.email : "Generated Dummy ID"} (ID: ${instructorId})`);

        // 4. Delete existing course with the target slug to avoid duplicates
        const targetSlug = "class-11-physics-mechanics-thermodynamics-masterclass";
        await Course.deleteMany({ slug: targetSlug });
        console.log("✅ Cleared any existing dummy course with matching slug");

        // 5. Create new Course with full details
        const dummyCourse = new Course({
            title: "Class 11 Physics: Mechanics and Thermodynamics Masterclass",
            subtitle: "Build a rock-solid foundation for CBSE, ISC, JEE, and NEET with comprehensive modules, conceptual animations, and practice problems.",
            slug: targetSlug,
            description: "Welcome to the ultimate Class 11 Physics course! This course is carefully crafted for students aiming to build deep conceptual clarity and excel in school examinations as well as competitive entrance tests like JEE and NEET. Over 50+ hours of video lectures, solved examples, quizzes, and homework sheets, you will master the principles of physical world, measurement, kinematics, laws of motion, work, energy, power, rotational mechanics, gravitation, and thermodynamics.",
            shortDescription: "Master Class 11 Physics topics from basic kinematics to advanced thermodynamics with top-tier pedagogy.",
            seoMetaDescription: "Class 11 Physics Mechanics and Thermodynamics masterclass for CBSE, ISC, JEE, and NEET preparation.",
            seoContent: "Class 11 Physics Mechanics, Thermodynamics, Kinematics, Laws of Motion, JEE, NEET, CBSE",
            
            // Media
            thumbnail: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?auto=format&fit=crop&q=80&w=800",
            coverImage: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80&w=1200",
            demoVideo: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",

            // Classification
            categoryId: category._id,
            subCategoryId: subCategory._id,
            level: ["intermediate", "advanced"],

            // Pricing
            price: 4999,
            salePrice: 2499,
            currency: "INR",

            // Details
            duration: 3000, // 50 hours
            totalLessons: 32,
            instructorId: instructorId,

            // Access
            isPublished: true,
            enrollmentType: "paid",
            maxStudents: 500,

            // Learning features
            tags: ["Class 11", "Physics", "Mechanics", "Thermodynamics", "JEE", "NEET"],
            prerequisites: "Basic understanding of Class 10 science and mathematics.",
            learningOutcomes: [
                "Understand the core concepts of Kinematics and Dynamics in 1D and 2D motion.",
                "Master Newton's Laws of Motion and their real-world applications.",
                "Solve complex work, power, and energy problems efficiently.",
                "Comprehend the laws of gravitation and planetary motion.",
                "Formulate a solid understanding of thermodynamics, heat transfer, and gas laws."
            ],
            requirements: [
                "A computer, tablet, or smartphone with internet connection.",
                "A notebook and pen to solve derivations and practice problems.",
                "Basic knowledge of algebra and trigonometry."
            ],
            targetAudience: [
                "Class 11 Science students (CBSE, ISC, and State Boards).",
                "JEE Main and Advanced aspirants looking to strengthen mechanics and thermodynamics.",
                "NEET aspirants aiming to build solid physics problem-solving speed."
            ],
            highlights: [
                "50+ Hours of Detailed Video Lectures",
                "120+ Conceptual Practice Problems",
                "Chapter-wise Solved Quizzes & Notes",
                "Dedicated Doubt Support Forum",
                "Certificate of Completion"
            ],

            // Mentor Info
            mentorName: "Dr. Sahil Sharma",
            mentorTitle: "Senior Physics Faculty & IIT Alumnus",
            mentorDescription: "Dr. Sahil Sharma has over 12 years of experience teaching Physics to thousands of students aspiring for JEE and NEET. He specializes in intuitive visual demonstrations of complex mechanical and thermodynamic concepts.",
            mentorAchievements: [
                "B.Tech & PhD in Physics from IIT Delhi",
                "Mentored 500+ students who cleared JEE Advanced with ranks under 2000",
                "Author of 'Physics Simplified for High School'"
            ],
            mentorSocialLinks: {
                linkedin: "https://linkedin.com/in/dummy-sahil-physics",
                twitter: "https://twitter.com/dummy-sahil-physics",
                youtube: "https://youtube.com/dummy-sahil-physics",
                website: "https://example.com"
            },

            // Brand Colors
            brandColors: {
                primary: "#0f172a",
                secondary: "#ffffff",
                accent: "#e11d48"
            },

            // Featured In
            featuredIn: [
                { name: "Times of India", logo: "https://upload.wikimedia.org/wikipedia/commons/8/8b/The_Times_of_India_logo.svg", url: "https://timesofindia.indiatimes.com" },
                { name: "Education World", logo: "https://example.com/ew-logo.png", url: "https://educationworld.in" }
            ],

            // FAQs
            faq: [
                { question: "Are video lessons recorded or live?", answer: "All lessons are pre-recorded in studio quality so you can study at your own pace. However, we host weekly live doubt-solving sessions.", category: "course" },
                { question: "Is this course aligned with the NCERT syllabus?", answer: "Yes, this course fully covers the NCERT Class 11 syllabus along with extra concepts required for competitive exams like JEE and NEET.", category: "course" },
                { question: "Will I get a certificate after completing the course?", answer: "Yes, once you complete all modules and pass the course assessment, you will receive a digital Certificate of Completion.", category: "course" }
            ],

            // Landing Page Custom Content sections
            contentSections: [
                {
                    sectionType: "hero",
                    sectionTitle: "Class 11 Physics Masterclass",
                    sectionSubtitle: "Ace your exams and build competitive skills",
                    sectionDescription: "The ultimate course to master high school physics from core concepts to JEE/NEET difficulty levels.",
                    order: 1,
                    isVisible: true
                },
                {
                    sectionType: "what_is",
                    sectionTitle: "Why Conceptual Clarity Matters in Class 11",
                    sectionDescription: "Class 11 physics represents a major jump in mathematical rigour and conceptual depth compared to Class 10. This course bridges that gap by using daily-life analogies and visual animations.",
                    order: 2,
                    isVisible: true
                },
                {
                    sectionType: "features",
                    sectionTitle: "Key Course Features",
                    order: 3,
                    listItems: [
                        { text: "Interactive animated lectures", icon: "🚀" },
                        { text: "Step-by-step mathematical derivations", icon: "📝" },
                        { text: "Doubt support forum monitored by subject experts", icon: "💬" }
                    ],
                    isVisible: true
                }
            ],

            isLive: false,
            courseForum: true,
            enableQA: true,
            enableReviews: true
        });

        await dummyCourse.save();
        console.log(`\n🎉 Successfully created Dummy Course!`);
        console.log(`   Title: ${dummyCourse.title}`);
        console.log(`   Slug: ${dummyCourse.slug}`);
        console.log(`   Category: Class 11`);
        console.log(`   Subcategory: Physics`);
        console.log(`   ID: ${dummyCourse._id}`);

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error("❌ Error creating dummy course:", error);
        await mongoose.disconnect();
        process.exit(1);
    }
};

createDummyCourse();
