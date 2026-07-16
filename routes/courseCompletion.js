import express from 'express';
import passport from 'passport';
import courseCompletionController from '../controllers/CourseCompletionController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';

const Completionrouter = express.Router();

// Main API - Check and update all course completions
Completionrouter.get('/check-all', courseCompletionController.checkAllCourseCompletions);

// New route to update last video played (requires valid token)
Completionrouter.post(
  '/update-last-video',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  courseCompletionController.updateLastVideoPlayed // Use method from instance
);

export default Completionrouter;