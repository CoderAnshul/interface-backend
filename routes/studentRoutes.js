// routes/studentRoutes.js
import express from 'express';
import passport from 'passport';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import { isAdmin } from '../middlewares/isAdmin.js';
import { getAllStudents, getStudentById, getStudentAnalytics } from '../controllers/studentController.js';

const studentRouter = express.Router();

const isAdminOrPartner = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'partner')) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access denied: Admin or Partner role required',
    data: {},
    err: {}
  });
};

studentRouter.get(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdminOrPartner,
  getAllStudents
);

studentRouter.get(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  // isAdmin,
  getStudentById
);

studentRouter.get(
  '/:id/analytics',
  // accessTokenAutoRefresh,
  // passport.authenticate('jwt', { session: false }),
  // // isAdmin,
  getStudentAnalytics
);

export default studentRouter;
