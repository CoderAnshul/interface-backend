import express from "express";
import {
  createCertificate,
  getAllCertificates,
  getCertificateById,
  updateCertificate,
  deleteCertificate,
  downloadCertificatePdf,
  viewCertificatePdf
} from "../controllers/certificateController.js";

import { upload } from "../middlewares/upload-middleware.js";
import accessTokenAutoRefresh from "../middlewares/accessTokenAutoRefresh.js";
import passport from "passport";

const certificateRouter = express.Router();


certificateRouter.post(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  upload.fields([
    { name: 'certificate_url', maxCount: 1 },
    { name: 'instructor_signature', maxCount: 1 },
  ]),
  createCertificate
);



certificateRouter.get("/", getAllCertificates);
certificateRouter.get("/:id", getCertificateById);
certificateRouter.get('/:id/pdf', downloadCertificatePdf);
certificateRouter.get('/:id/view', viewCertificatePdf);

certificateRouter.put(
  "/:id",
  upload.fields([
    { name: "certificateFile", maxCount: 1 },
    { name: "signatureFile", maxCount: 1 },
  ]),
  updateCertificate
);

certificateRouter.delete("/:id", deleteCertificate);

export default certificateRouter;
