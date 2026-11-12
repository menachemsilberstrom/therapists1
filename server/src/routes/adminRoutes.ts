import { Router } from 'express';
import { createCategory, listAdminCategories, updateCategory } from '../controllers/adminCategoryController.js';
import {
  deleteTherapist,
  downloadCertificate,
  getStats,
  getTherapist,
  listTherapists,
  setCertificateVerified,
  setTherapistStatus,
} from '../controllers/adminController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';

export const adminRouter = Router();

// Everything under /api/admin needs a valid token AND the ADMIN role (checked against the database on each request).
adminRouter.use(requireAuth, requireRole('ADMIN'));

adminRouter.get('/stats', getStats);

adminRouter.get('/therapists', listTherapists);
adminRouter.get('/therapists/:id', getTherapist);
adminRouter.patch('/therapists/:id/status', setTherapistStatus);
adminRouter.delete('/therapists/:id', deleteTherapist);
adminRouter.get('/therapists/:id/certificates/:certId/file', downloadCertificate);
adminRouter.patch('/therapists/:id/certificates/:certId', setCertificateVerified);

adminRouter.get('/categories', listAdminCategories);
adminRouter.post('/categories', createCategory);
adminRouter.patch('/categories/:id', updateCategory);
