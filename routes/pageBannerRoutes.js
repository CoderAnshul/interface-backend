import express from 'express';
import { getBannerByPage, upsertBanner, getAllPageBanners, bulkUpsertBanners } from '../controllers/pageBannerController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';
import { upload } from '../middlewares/upload-middleware.js';

const router = express.Router();

/**
 * Public route to fetch a banner by pageKey
 */
router.get('/', getAllPageBanners);
router.get('/:pageKey', getBannerByPage);

/**
 * Protected route to create or update a banner
 */
router.post(
  '/',
  upload.single('image'),
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  upsertBanner
);

/**
 * Bulk create or update banners
 */
router.post(
  '/bulk',
  upload.any(),
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  bulkUpsertBanners
);

export default router;
