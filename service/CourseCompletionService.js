import cron from 'node-cron';
import Enrollment from '../models/CourseEnrollment.js';
import Course from '../models/Course.js';
import LessonProgress from '../models/LessonProgress.js';
import QuizSubmission from '../models/QuizSubmission.js';
import AssignmentSubmission from '../models/assignmentSubmission.js';
import { trusted } from 'mongoose';

class CourseCompletionService {

  // Mark expired enrollments
  async updateExpiredEnrollments() {
    const now = new Date();
    await Enrollment.updateMany(
      {
        accessExpiry: { $lte: now, $ne: null },
        status: { $ne: 'expired' }
      },
      { $set: { status: 'expired' } }
    ).then(result => {
      console.log(`Marked ${result.modifiedCount} enrollments as expired`);
    });
  }

  // Simple check: if user completed all video-lessons, quizzes, and assignments
  async checkCourseCompletion(userId, courseId) {
    try {
      console.log(`Checking completion for user ${userId} in course ${courseId}`);

      const course = await Course.findById(courseId).populate({
        path: 'modules',
        populate: { path: 'lessons' }
      });

      if (!course || !course.modules) {
        console.log(`No course or modules found for ${courseId}`);
        return { isCompleted: true, overallProgress: 100 }; // If no content, consider completed
      }

      // Count total content by type
      let totalVideoLessons = 0;
      let totalQuizzes = 0;
      let totalAssignments = 0;

      course.modules.forEach(module => {
        if (module.lessons) {
          module.lessons.forEach(lesson => {
            if (lesson.type === 'video-lesson') totalVideoLessons++;
            if (lesson.type === 'quiz') totalQuizzes++;
            if (lesson.type === 'assignment') totalAssignments++;
          });
        }
      });

      // Count completed content
      const completedLessons = await LessonProgress.countDocuments({
        userId, courseId, completed: true
      });

      const completedQuizzes = await QuizSubmission.countDocuments({
        user: userId, courseId, is_completed: true, passed: true
      });

      const completedAssignments = await AssignmentSubmission.countDocuments({
        submittedBy: userId, courseId, is_complete: true, status: 'graded'
      });

      console.log(`Course ${courseId} - Total: ${totalVideoLessons} lessons, ${totalQuizzes} quizzes, ${totalAssignments} assignments`);
      console.log(`User ${userId} - Completed: ${completedLessons} lessons, ${completedQuizzes} quizzes, ${completedAssignments} assignments`);

      const totalItems = totalVideoLessons + totalQuizzes + totalAssignments;
      const completedItems = completedLessons + completedQuizzes + completedAssignments;

      let overallProgress = 0;
      if (totalItems > 0) {
        overallProgress = (completedItems / totalItems) * 100;
      } else {
        overallProgress = 100;
      }

      // Cap at 100
      overallProgress = Math.min(overallProgress, 100);
      overallProgress = Math.round(overallProgress * 100) / 100; // Round to 2 decimal places

      // Check if all are completed
      const allCompleted = (completedLessons >= totalVideoLessons) &&
        (completedQuizzes >= totalQuizzes) &&
        (completedAssignments >= totalAssignments);

      return { isCompleted: allCompleted, overallProgress };
    } catch (error) {
      console.error('Error checking course completion:', error);
      return { isCompleted: false, overallProgress: 0 };
    }
  }

  // Process all active enrollments and update completion status
  async processAllEnrollments({ skipExpired = false } = {}) {
    try {
      const enrollments = await Enrollment.find()
        .populate('userId', 'name')
        .populate('courseId', 'title');

      console.log(`Found ${enrollments.length} active enrollments to process`);

      let processed = 0;
      let completed = 0;

      for (const enrollment of enrollments) {
        if (skipExpired && enrollment.status == 'expired') {
          // console.log(`Skipping expired enrollment ${enrollment._id}`);
          continue;
        }

        // Skip if userId or courseId is missing (deleted user/course)
        if (!enrollment.userId || !enrollment.courseId) {
          continue;
        }

        console.log(`Processing enrollment ${enrollment._id} for user ${enrollment.userId.name} in course ${enrollment.courseId.title}`);
        try {
          // If skipExpired is true, we respect the canComplete check (which returns false for expired)
          // If skipExpired is false, we ignore canComplete check and process anyway
          if (skipExpired && typeof enrollment.canComplete === 'function' && !enrollment.canComplete()) {
            console.log(`Enrollment ${enrollment._id} is expired, skipping completion check.`);
            continue;
          }

          const { isCompleted, overallProgress } = await this.checkCourseCompletion(
            enrollment.userId._id,
            enrollment.courseId._id
          );
          console.log(`Enrollment ${enrollment._id} completion status: ${isCompleted}, progress: ${overallProgress}%`);

          const updateData = {
            progressPercentage: overallProgress,
            iscompleted: isCompleted
          };

          if (isCompleted && !enrollment.iscompleted) {
            updateData.completedAt = new Date();
            completed++;
          }

          if (isCompleted) {
            if (enrollment.iscompleted) completed++;
          }

          await Enrollment.findByIdAndUpdate(enrollment._id, updateData);

          processed++;
        } catch (error) {
          console.error(`Error processing enrollment ${enrollment._id}:`, error?.message);
        }
      }

      const result = { processed, completed };
      console.log(`Processing complete: ${processed} processed, ${completed}  marked as completed , timestamp: ${new Date().toISOString()}`);
      return result;
    } catch (error) {
      console.error('Error processing enrollments:', error);
      return { processed: 0, completed: 0 };
    }
  }

  // Start cron job - runs every hour
  startCronJob() {
    cron.schedule('0 * * * *', async () => {
      //console.log('🔄 Running automated course completion check...');
      await this.processAllEnrollments();
    });

    //console.log('⏰ Course completion cron job started - runs every hour');
  }
}

export default new CourseCompletionService();
