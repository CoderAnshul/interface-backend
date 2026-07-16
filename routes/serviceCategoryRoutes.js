import express from 'express';
import {
  createServiceCategory,
  getAllServiceCategories,
  getServiceCategoryById,
  updateServiceCategory,
  deleteServiceCategory
} from '../controllers/ServiceCategoryController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import { isAdmin } from '../middlewares/isAdmin.js';
import passport from 'passport';

const serviceCategoryRouter = express.Router();

// Public
serviceCategoryRouter.get('/', getAllServiceCategories);
serviceCategoryRouter.get('/:id', getServiceCategoryById);

// Admin only
serviceCategoryRouter.post(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  createServiceCategory
);
serviceCategoryRouter.put(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  updateServiceCategory
);
serviceCategoryRouter.delete(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  deleteServiceCategory
);

export default serviceCategoryRouter;
