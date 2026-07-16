import express from 'express';
import passport from 'passport';
import LearningAnalyticsController from '../controllers/LearningAnalyticsController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import { isAdmin } from '../middlewares/isAdmin.js';

const router = express.Router();

// All routes require admin access
router.use(accessTokenAutoRefresh);
router.use(passport.authenticate('jwt', { session: false }));
router.use(isAdmin);

router.get('/overview', LearningAnalyticsController.getOverviewStats);
router.get('/popular-courses', LearningAnalyticsController.getPopularCourses);
router.get('/completion-rates', LearningAnalyticsController.getCourseCompletionRates);
router.get('/student-progress', LearningAnalyticsController.getStudentProgress);

export default router;
