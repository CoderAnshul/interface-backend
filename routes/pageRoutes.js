import express from 'express';
import {
  createPage,
  getAllPages,
  getPageById,
  getPageBySlug,
  updatePage,
  deletePage
} from '../controllers/pageController.js';
// import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';

const pageRouter = express.Router();

pageRouter.post('/', createPage);
pageRouter.get('/', getAllPages);
pageRouter.get('/slug/:slug', getPageBySlug);
pageRouter.get('/:id', getPageById);
pageRouter.put('/:id',updatePage);
pageRouter.delete('/:id',  deletePage);

export default pageRouter;
