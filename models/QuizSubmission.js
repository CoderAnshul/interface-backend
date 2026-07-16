import mongoose from "mongoose";
import NotificationService from "../utils/notificationService.js"; // Import notification service

const quizSubmissionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
  answers: [{
    question: { type: String, required: true },
    selectedOption: { 
      type: String, 
      required: true, 
      enum: ['A', 'B', 'C', 'D'] 
    }
  }],
  score: { type: Number, required: true },
  totalMarks: { type: Number, required: true },
  passed: { type: Boolean, required: true },
  totalQuestions: { type: Number, required: true },
  totalCorrectQuestions: { type: Number, required: true },
  totalWrongQuestions: { type: Number, required: true },
  percentage: { type: Number, required: true },
  is_completed: { type: Boolean, required: true }, // New field added
  referredById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  submittedAt: { type: Date, default: Date.now }
}, { timestamps: true });


const QuizSubmission = mongoose.models.QuizSubmission || mongoose.model('QuizSubmission', quizSubmissionSchema);
// Index for quick lookup of quiz submissions by referring partner
quizSubmissionSchema.index({ referredById: 1 });

export default QuizSubmission;