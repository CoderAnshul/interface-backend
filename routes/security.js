import express from 'express';
import SecurityController from '../controllers/SecurityController.js';
import passport from 'passport';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import { isAdmin } from '../middlewares/isAdmin.js';

const securityRouter = express.Router();

// Record security incident
securityRouter.post(
    '/incidents',
    accessTokenAutoRefresh,
     passport.authenticate('jwt', { session: false }),
    SecurityController.recordIncident
);

export default securityRouter;