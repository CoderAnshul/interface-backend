// routes/course-bundle-routes.js
import express from 'express';
import {create,getAll,getOne,update,deleteBundle} from '../controllers/course-bundle-controller.js';
import { upload } from '../middlewares/upload-middleware.js';

const Bundlerouter = express.Router();

Bundlerouter.post('/', upload.any(),create);
Bundlerouter.get('/', getAll);
Bundlerouter.get('/:id', getOne);
Bundlerouter.put('/:id',upload.any(), update);
Bundlerouter.delete('/:id',deleteBundle);

export default Bundlerouter;
