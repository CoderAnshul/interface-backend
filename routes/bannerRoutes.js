import express from 'express';
import {
  createBanner,
  getBanners,
  getBanner,
  updateBanner,
  deleteBanner
} from '../controllers/bannerController.js';
import { upload } from '../middlewares/upload-middleware.js';

const router = express.Router();

router.post('/', upload.fields([{ name: 'image' }, { name: 'mobileImage' }]), createBanner);
router.get('/', getBanners);
router.get('/:id', getBanner);
router.put('/:id', upload.fields([{ name: 'image' }, { name: 'mobileImage' }]), updateBanner);
router.delete('/:id', deleteBanner);

export default router;
