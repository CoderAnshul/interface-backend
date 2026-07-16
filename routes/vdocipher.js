import express from 'express';
import VdoCipherController from '../controllers/VdoCipherController.js';
import passport from 'passport';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import { isAdmin } from '../middlewares/isAdmin.js';
const vedioCipherRouter = express.Router();

// Generate playback data
vedioCipherRouter.post(
    '/courses/:courseId/videos/:videoId/playback',
     accessTokenAutoRefresh,
     passport.authenticate('jwt', { session: false }),
    VdoCipherController.generatePlayback
);

// Validate token
vedioCipherRouter.post(
    '/validate-token',
 accessTokenAutoRefresh,
     passport.authenticate('jwt', { session: false }),    VdoCipherController.validateToken
);

export default vedioCipherRouter;