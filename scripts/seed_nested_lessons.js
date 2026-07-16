import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

import Course from "../models/Course.js";
import Module from "../models/Module.js";
import Lesson from "../models/Lesson.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const seedNestedLessons = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("❌ MONGO_URI not found");
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    // 1. Find Course
    const targetSlug = "class-11-physics-mechanics-thermodynamics-masterclass";
    const course = await Course.findOne({ slug: targetSlug });
    if (!course) {
      console.error("❌ Course not found. Please run scripts/create_class11_course.js first.");
      process.exit(1);
    }
    console.log(`ℹ️ Found course: ${course.title} (ID: ${course._id})`);

    // 2. Clear existing modules and lessons for this course
    const existingModules = await Module.find({ courseId: course._id });
    const moduleIds = existingModules.map(m => m._id);
    await Lesson.deleteMany({ section: course._id });
    await Module.deleteMany({ courseId: course._id });
    console.log("✅ Cleared existing modules and lessons for this course");

    // 3. Create a Module "Unit 1: Kinematics"
    const kinematicsModule = new Module({
      courseId: course._id,
      title: "Unit 1: Kinematics",
      description: "Study of motion of points, bodies, and systems of bodies without consideration of the forces that cause the motion.",
      order: 1,
      estimatedDuration: 180,
      isPublished: true,
      lessons: []
    });
    await kinematicsModule.save();
    console.log(`✅ Created Module: ${kinematicsModule.title} (ID: ${kinematicsModule._id})`);

    // 4. Create Chapter: "Chapter 1: Motion in a Straight Line"
    const chapter1 = new Lesson({
      title: "Chapter 1: Motion in a Straight Line",
      description: "Basics of 1D rectilinear motion, coordinate system, path length, and displacement.",
      type: "chapter",
      parentId: null,
      section: course._id,
      moduleId: kinematicsModule._id,
      order: 1,
      isRequired: true,
      language: "English"
    });
    await chapter1.save();
    console.log(`   ✅ Created Chapter: ${chapter1.title} (ID: ${chapter1._id})`);

    // 5. Create Topic: "Topic 1.1: Speed and Velocity" under Chapter 1
    const topic1 = new Lesson({
      title: "Topic 1.1: Speed and Velocity",
      description: "Concept of speed, velocity, average velocity, and instantaneous velocity.",
      type: "topic",
      parentId: chapter1._id,
      section: course._id,
      moduleId: kinematicsModule._id,
      order: 1,
      isRequired: true,
      language: "English"
    });
    await topic1.save();
    console.log(`      ✅ Created Topic: ${topic1.title} (ID: ${topic1._id})`);

    // 6. Create Content Lesson: "Instantaneous Velocity Derivation" under Topic 1.1
    const lesson1 = new Lesson({
      title: "Instantaneous Velocity Derivation",
      description: "Mathematical derivation of instantaneous velocity using limits and calculus.",
      type: "video-lesson",
      parentId: topic1._id,
      section: course._id,
      moduleId: kinematicsModule._id,
      order: 1,
      isRequired: true,
      language: "English"
    });
    await lesson1.save();
    console.log(`         ✅ Created Lesson: ${lesson1.title} (ID: ${lesson1._id})`);

    // 7. Create Text Lesson: "Speed vs Velocity Comparison Table" under Topic 1.1
    const lesson2 = new Lesson({
      title: "Speed vs Velocity Comparison Table",
      description: "A summary table listing differences between speed and velocity, scalars vs vectors.",
      type: "text",
      parentId: topic1._id,
      section: course._id,
      moduleId: kinematicsModule._id,
      order: 2,
      isRequired: true,
      language: "English"
    });
    await lesson2.save();
    console.log(`         ✅ Created Lesson: ${lesson2.title} (ID: ${lesson2._id})`);

    // 8. Create another Topic: "Topic 1.2: Acceleration" under Chapter 1
    const topic2 = new Lesson({
      title: "Topic 1.2: Acceleration",
      description: "Understanding positive, negative, and zero acceleration.",
      type: "topic",
      parentId: chapter1._id,
      section: course._id,
      moduleId: kinematicsModule._id,
      order: 2,
      isRequired: true,
      language: "English"
    });
    await topic2.save();
    console.log(`      ✅ Created Topic: ${topic2.title} (ID: ${topic2._id})`);

    // 9. Update module's lessons list with all created lesson IDs
    kinematicsModule.lessons = [
      chapter1._id,
      topic1._id,
      lesson1._id,
      lesson2._id,
      topic2._id
    ];
    await kinematicsModule.save();
    console.log(`✅ Updated Module lessons list with ${kinematicsModule.lessons.length} items`);

    // Update course totalLessons count
    course.totalLessons = kinematicsModule.lessons.length;
    course.modules = [kinematicsModule._id];
    await course.save();
    console.log(`✅ Updated Course totalLessons and modules list`);

    await mongoose.disconnect();
    console.log("\n🎉 Seeding complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding error:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedNestedLessons();
