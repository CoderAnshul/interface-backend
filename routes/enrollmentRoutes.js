import express from 'express';
import {
  createEnrollment,
  getAllEnrollments,
  getEnrollmentById,
  deleteEnrollment,
  updateEnrollment,
  adminEnrollStudent,
  createFreeEnrollment,
  removeEnrollmentAndUpdateCourse,
  updateAccessExpiry
} from '../controllers/enrollmentController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';

import enrollmentService from '../service/enrollmentService.js';

const router = express.Router();

router.post('/', createEnrollment);
router.get('/', getAllEnrollments);


router.put(
  '/:id/access-expiry',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  updateAccessExpiry
);

router.get('/:id', getEnrollmentById);
router.delete('/:id', deleteEnrollment);
router.put('/:id', updateEnrollment);
router.post('/admin-enroll', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), isAdmin, adminEnrollStudent);
router.post('/free-enroll',  createFreeEnrollment); // New route for free enrollment
router.delete('/:id/remove', removeEnrollmentAndUpdateCourse); // <-- new route

// Get enrollments for a specific course (with auth)
router.get(
  '/courses/:courseId/enrollments',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const { courseId } = req.params;
      // You may want to validate ObjectId here
      const enrollments = await enrollmentService.getAllEnrollments({ courseId });
      res.status(200).json({
        success: true,
        message: 'Course enrollments fetched successfully',
        data: enrollments,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);


export default router;
