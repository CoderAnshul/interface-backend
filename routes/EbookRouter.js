import express from 'express';
import multer from 'multer';
import passport from 'passport';
import {
    createEbook,
    getAllEbooks,
    getEbookById,
    getEbookBySlug,
    updateEbook,
    deleteEbook,
    downloadEbook,
    serveEbookFile,
    purchaseEbook,
    getPurchasedEbooks
} from '../controllers/EbookController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import { isAdmin } from '../middlewares/isAdmin.js';
import isUserBanned from '../middlewares/isUserBanned.js';

const ebookRouter = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/ebooks/'); // Ensure this exists
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});
const upload = multer({ storage });

// Public routes
ebookRouter.get('/', getAllEbooks);
ebookRouter.get('/download-file', serveEbookFile); // Move this up
ebookRouter.get('/slug/:slug', getEbookBySlug); // Move this up
// Get user's purchased ebooks (Must be before /:id)
ebookRouter.get(
    '/purchased',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isUserBanned,
    getPurchasedEbooks
);

ebookRouter.get('/:id', getEbookById);

// Protected routes (Admin/Instructor)
ebookRouter.post(
    '/',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isAdmin,
    isUserBanned,
    upload.fields([
        { name: 'thumbnail', maxCount: 1 },
        { name: 'previewFile', maxCount: 1 },
        { name: 'fullFile', maxCount: 1 },
        { name: 'authorImage', maxCount: 1 },
    ]),
    createEbook
);

ebookRouter.put(
    '/:id',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isAdmin,
    isUserBanned,
    upload.fields([
        { name: 'thumbnail', maxCount: 1 },
        { name: 'previewFile', maxCount: 1 },
        { name: 'fullFile', maxCount: 1 },
        { name: 'authorImage', maxCount: 1 },
    ]),
    updateEbook
);

ebookRouter.delete(
    '/:id',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isAdmin,
    isUserBanned,
    deleteEbook
);

// Download route (requires auth to check payment status)
ebookRouter.get(
    '/:id/download',
    accessTokenAutoRefresh,
    (req, res, next) => {
        passport.authenticate('jwt', { session: false }, (err, user) => {
            req.user = user;
            next();
        })(req, res, next);
    },
    downloadEbook
);

// Purchase ebook route (public, but requires payment)
ebookRouter.post('/purchase', purchaseEbook);

export default ebookRouter;
