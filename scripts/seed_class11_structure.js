import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

import Course from "../models/Course.js";
import CourseCategory from "../models/CourseCategory.js";
import SubCategory from "../models/SubCategory.js";
import Module from "../models/Module.js";
import Lesson from "../models/Lesson.js";
import User from "../models/user.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const seedClass11Structure = async () => {
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

    // 2. Find or create Subcategory: "Science (PCM)"
    let subCategory = await SubCategory.findOne({ name: "Science (PCM)", categoryId: category._id, isDeleted: false });
    if (!subCategory) {
      subCategory = new SubCategory({
        name: "Science (PCM)",
        slug: "science-pcm",
        categoryId: category._id,
        status: "active"
      });
      await subCategory.save();
      console.log(`✅ Subcategory "Science (PCM)" created (ID: ${subCategory._id})`);
    } else {
      console.log(`ℹ️ Subcategory "Science (PCM)" already exists (ID: ${subCategory._id})`);
    }

    // 3. Find instructor
    let instructor = await User.findOne({ role: { $in: ["admin", "instructor"] } });
    const instructorId = instructor ? instructor._id : new mongoose.Types.ObjectId();
    console.log(`ℹ️ Using instructor: ${instructor ? instructor.email : "Generated Dummy ID"} (ID: ${instructorId})`);

    // 4. Delete existing course with target slug to avoid duplicates
    const targetSlug = "class-11-pcm-comprehensive";
    await Course.deleteMany({ slug: targetSlug });
    console.log("✅ Cleared any existing comprehensive Class 11 course");

    // 5. Create new Course
    const course = new Course({
      title: "Class 11: Complete Course (Physics, Chemistry, Maths)",
      subtitle: "The ultimate CBSE, ISC, and competitive prep suite (JEE & NEET) featuring nested chapters, topics, and interactive materials.",
      slug: targetSlug,
      description: "Step into the most comprehensive Class 11 PCM curriculum designed by top-tier instructors. This course covers everything from base physical concepts, basic organic principles, to advanced mathematical operations, ensuring you excel in school assessments and competitive entrance examinations alike.",
      shortDescription: "Complete PCM course for Class 11 targeting CBSE, ISC, and JEE/NEET prep.",
      seoMetaDescription: "Class 11 Physics, Chemistry, and Mathematics complete course with structured lessons.",
      seoContent: "Class 11, PCM, Physics, Chemistry, Mathematics, JEE, NEET, CBSE",
      thumbnail: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?auto=format&fit=crop&q=80&w=800",
      coverImage: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80&w=1200",
      categoryId: category._id,
      subCategoryId: subCategory._id,
      level: ["intermediate", "advanced"],
      price: 9999,
      salePrice: 4999,
      currency: "INR",
      duration: 6000, // 100 hours total
      instructorId: instructorId,
      isPublished: true,
      enrollmentType: "paid",
      maxStudents: 1000,
      tags: ["Class 11", "PCM", "Physics", "Chemistry", "Maths", "JEE", "NEET"],
      learningOutcomes: [
        "Master Class 11 Physics (Mechanics, Waves, Thermodynamics).",
        "Build deep knowledge of Class 11 Chemistry (Stoichiometry, Atomic Structure, Periodic Trends, Organic Principles).",
        "Formulate strong math skills in Calculus, Trigonometry, and Coordinate Geometry.",
        "Solve numerical questions from JEE and NEET past papers."
      ]
    });

    await course.save();
    console.log(`🎉 Created course: ${course.title} (ID: ${course._id})`);

    // Clean up existing modules and lessons for this course ID just in case
    await Lesson.deleteMany({ section: course._id });
    await Module.deleteMany({ courseId: course._id });

    // 6. Define Modules, Chapters, Topics, and Lessons
    const courseData = [
      {
        moduleTitle: "Physics",
        moduleDesc: "Comprehensive lessons in Class 11 Physics covering units, measurement, mechanics, and thermodynamics.",
        order: 1,
        chapters: [
          {
            title: "Chapter 1: Physical World & Measurement",
            description: "Introduction to physical quantities, units, standards, and error calculations.",
            topics: [
              {
                title: "Topic 1.1: Units and Dimensional Analysis",
                description: "Dimensional formulas, homogeneity principle, and conversion of units.",
                contents: [
                  { title: "Introduction to SI Units", type: "video-lesson", duration: 15 },
                  { title: "SI Units and Dimensions Reference Sheet", type: "text", duration: 10 },
                  { title: "Units & Dimensions Mini-Quiz", type: "quiz", duration: 15 }
                ]
              },
              {
                title: "Topic 1.2: Errors in Measurement",
                description: "Absolute, relative, and percentage errors with combination of errors.",
                contents: [
                  { title: "Understanding Systematic and Random Errors", type: "video-lesson", duration: 20 },
                  { title: "Error Analysis Exercise Sheet", type: "text", duration: 15 }
                ]
              }
            ]
          },
          {
            title: "Chapter 2: Kinematics (Motion in 1D & 2D)",
            description: "Description of motion of bodies, projectile motion, and relative velocity.",
            topics: [
              {
                title: "Topic 2.1: Rectilinear Motion",
                description: "Motion along a straight line, equations of motion, and calculus applications.",
                contents: [
                  { title: "Position, Path Length, and Displacement", type: "video-lesson", duration: 18 },
                  { title: "Average Speed and Average Velocity", type: "video-lesson", duration: 22 },
                  { title: "Speed vs Velocity Detailed Notes", type: "text", duration: 10 }
                ]
              },
              {
                title: "Topic 2.2: Projectile Motion",
                description: "Two-dimensional motion under gravity, range, height, and time of flight.",
                contents: [
                  { title: "Analyzing Projectile Trajectory", type: "video-lesson", duration: 25 },
                  { title: "Projectile Range and Height Assignment", type: "assignment", duration: 30 }
                ]
              }
            ]
          }
        ]
      },
      {
        moduleTitle: "Chemistry",
        moduleDesc: "Fundamental chemical principles, atomic models, mole concepts, and organic basics.",
        order: 2,
        chapters: [
          {
            title: "Chapter 1: Some Basic Concepts of Chemistry",
            description: "Laws of chemical combinations, atomic mass, molecular mass, and empirical formulas.",
            topics: [
              {
                title: "Topic 1.1: Mole Concept and Stoichiometry",
                description: "Avogadro number, molar mass, stoichiometry, and limiting reagent.",
                contents: [
                  { title: "What is a Mole? Avogadro's Number", type: "video-lesson", duration: 20 },
                  { title: "Stoichiometric Calculations Formula Guide", type: "text", duration: 12 },
                  { title: "Mole Concept Concept-Check Quiz", type: "quiz", duration: 15 }
                ]
              }
            ]
          },
          {
            title: "Chapter 2: Structure of Atom",
            description: "Discovery of subatomic particles, electromagnetic radiation, and quantum models.",
            topics: [
              {
                title: "Topic 2.1: Bohr's Model of Hydrogen Atom",
                description: "Postulates, line spectrum of hydrogen, and energy states.",
                contents: [
                  { title: "Bohr Orbit Radius and Energy Derivation", type: "video-lesson", duration: 30 }
                ]
              }
            ]
          }
        ]
      },
      {
        moduleTitle: "Mathematics",
        moduleDesc: "High school algebra, sets, functions, coordinate geometry, and basic calculus.",
        order: 3,
        chapters: [
          {
            title: "Chapter 1: Sets and Relations",
            description: "Representation of sets, subsets, power sets, and Cartesian products.",
            topics: [
              {
                title: "Topic 1.1: Types of Sets & Venn Diagrams",
                description: "Empty, finite, infinite, and equal sets, union, intersection, and difference of sets.",
                contents: [
                  { title: "Visualizing Sets and Operations with Venn Diagrams", type: "video-lesson", duration: 18 }
                ]
              }
            ]
          },
          {
            title: "Chapter 2: Trigonometric Functions",
            description: "Positive and negative angles, measuring angles in radians and degrees, and trigonometric functions.",
            topics: [
              {
                title: "Topic 2.1: Trigonometric Ratios and Angles",
                description: "Unit circle definition, sign changes of trigonometric functions in quadrants.",
                contents: [
                  { title: "Sine, Cosine, Tangent on the Unit Circle", type: "video-lesson", duration: 25 },
                  { title: "Trigonometric Identities Practice Sheet", type: "assignment", duration: 30 }
                ]
              }
            ]
          }
        ]
      }
    ];

    const moduleIds = [];
    let courseTotalLessons = 0;

    for (const modData of courseData) {
      // 1. Create Module
      const moduleObj = new Module({
        courseId: course._id,
        title: modData.moduleTitle,
        description: modData.moduleDesc,
        order: modData.order,
        estimatedDuration: 600,
        isPublished: true,
        lessons: []
      });
      await moduleObj.save();
      console.log(`\n📦 Created Module: ${moduleObj.title}`);

      const moduleLessonsList = [];
      let chapterOrder = 1;

      for (const chapData of modData.chapters) {
        // 2. Create Chapter (parentId = null)
        const chapterLesson = new Lesson({
          title: chapData.title,
          description: chapData.description,
          type: "chapter",
          parentId: null,
          section: course._id,
          moduleId: moduleObj._id,
          order: chapterOrder++,
          isRequired: true,
          language: "English"
        });
        await chapterLesson.save();
        moduleLessonsList.push(chapterLesson._id);
        console.log(`   📁 Created Chapter: ${chapterLesson.title}`);

        let topicOrder = 1;
        for (const topData of chapData.topics) {
          // 3. Create Topic (parentId = chapterLesson._id)
          const topicLesson = new Lesson({
            title: topData.title,
            description: topData.description,
            type: "topic",
            parentId: chapterLesson._id,
            section: course._id,
            moduleId: moduleObj._id,
            order: topicOrder++,
            isRequired: true,
            language: "English"
          });
          await topicLesson.save();
          moduleLessonsList.push(topicLesson._id);
          console.log(`      📁 Created Topic: ${topicLesson.title}`);

          let contentOrder = 1;
          for (const contData of topData.contents) {
            // 4. Create Content Lesson (parentId = topicLesson._id)
            const contentLesson = new Lesson({
              title: contData.title,
              type: contData.type,
              parentId: topicLesson._id,
              section: course._id,
              moduleId: moduleObj._id,
              order: contentOrder++,
              duration: contData.duration || 10,
              isRequired: true,
              language: "English"
            });
            await contentLesson.save();
            moduleLessonsList.push(contentLesson._id);
            console.log(`         📄 Created Content: ${contentLesson.title} (${contentLesson.type})`);
          }
        }
      }

      // Update module with all lessons
      moduleObj.lessons = moduleLessonsList;
      await moduleObj.save();
      console.log(`✅ Module ${moduleObj.title} updated with ${moduleLessonsList.length} lessons`);
      
      moduleIds.push(moduleObj._id);
      courseTotalLessons += moduleLessonsList.length;
    }

    // Update course with modules and lessons count
    course.modules = moduleIds;
    course.totalLessons = courseTotalLessons;
    await course.save();
    console.log(`\n🏆 Course fully seeded!`);
    console.log(`Course Title: ${course.title}`);
    console.log(`Total Modules/Subjects: ${course.modules.length}`);
    console.log(`Total Lessons (incl. Chapters/Topics): ${course.totalLessons}`);

    await mongoose.disconnect();
    console.log("👋 Disconnected from MongoDB. Seeding Success!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed with error:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedClass11Structure();
