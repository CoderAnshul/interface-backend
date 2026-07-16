import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

import Course from "../models/Course.js";
import Lesson from "../models/Lesson.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const inspect = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    const course = await Course.findOne({ slug: "class-11-pcm-comprehensive" });
    if (!course) {
      console.log("Course not found");
      process.exit(0);
    }

    const lessons = await Lesson.find({ section: course._id });
    console.log(`Found ${lessons.length} lessons`);
    
    // Log the first chapter and its topics
    const chapters = lessons.filter(l => l.type === 'chapter');
    const topics = lessons.filter(l => l.type === 'topic');
    const contents = lessons.filter(l => l.type !== 'chapter' && l.type !== 'topic');

    console.log("\n--- CHAPTERS ---");
    chapters.forEach(c => {
      console.log(`Chapter: ${c.title} (ID: ${c._id})`);
    });

    console.log("\n--- TOPICS ---");
    topics.forEach(t => {
      console.log(`Topic: ${t.title} (ID: ${t._id}), parentId: ${t.parentId} (type: ${typeof t.parentId})`);
    });

    console.log("\n--- CONTENTS ---");
    contents.slice(0, 3).forEach(c => {
      console.log(`Content: ${c.title} (ID: ${c._id}), parentId: ${c.parentId} (type: ${typeof c.parentId})`);
    });

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

inspect();
