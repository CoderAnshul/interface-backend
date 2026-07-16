import express from 'express';
import multer from 'multer';
import { createCertificateTemplate, getCertificateTemplate, getAllCertificateTemplates, updateCertificateTemplate, deleteCertificateTemplate } from '../controllers/certificateTemplateController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';

const certificateTemplateRouter = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Ensure this directory exists
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // Limit file size to 5MB

// Create a certificate template (admin only)
certificateTemplateRouter.post(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  upload.fields([
    { name: 'image', maxCount: 1 }, // Background image
    { name: 'elements[platform_signature][image]', maxCount: 1 }, // Signature image
    { name: 'elements[stamp][image]', maxCount: 1 }, // Stamp image
  ]),
  createCertificateTemplate
);

// Get a certificate template by ID (admin only)
certificateTemplateRouter.get(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  getCertificateTemplate
);

// Get all certificate templates (admin only)
certificateTemplateRouter.get(
  '/',
  // accessTokenAutoRefresh,
  // passport.authenticate('jwt', { session: false }),
  // isAdmin,
  getAllCertificateTemplates
);

// Update a certificate template (admin only)
certificateTemplateRouter.put(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  upload.fields([
    { name: 'image', maxCount: 1 }, // Background image
    { name: 'elements[platform_signature][image]', maxCount: 1 }, // Signature image
    { name: 'elements[stamp][image]', maxCount: 1 }, // Stamp image
  ]),
  updateCertificateTemplate
);

// Delete a certificate template (admin only)
certificateTemplateRouter.delete(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  deleteCertificateTemplate
);

export default certificateTemplateRouter;