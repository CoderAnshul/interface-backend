import express from 'express';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';
import {
  createSubscriptionPlan,
  getAllSubscriptionPlans,
  getSubscriptionPlanById,
  updateSubscriptionPlan,
  deleteSubscriptionPlan
} from '../controllers/subscriptionPlanController.js';

const router = express.Router();

// Admin routes
router.post('/', passport.authenticate('jwt', { session: false }), isAdmin, createSubscriptionPlan);
router.get('/', passport.authenticate('jwt', { session: false }), isAdmin, getAllSubscriptionPlans);
router.get('/:id', passport.authenticate('jwt', { session: false }), isAdmin, getSubscriptionPlanById);
router.put('/:id', passport.authenticate('jwt', { session: false }), isAdmin, updateSubscriptionPlan);
router.delete('/:id', passport.authenticate('jwt', { session: false }), isAdmin, deleteSubscriptionPlan);

export default router;
