import { Router } from 'express';
import {
  addMyCertificate,
  getMyProfile,
  getTherapistBySlug,
  listTherapists,
  removeMyAvatar,
  removeMyCertificate,
  setMyAvatar,
  updateMyProfile,
} from '../controllers/therapistController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { uploadLimiter } from '../middlewares/rateLimit.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import { avatarUpload, certificateUpload } from '../middlewares/uploadMiddleware.js';

export const therapistRouter = Router();

const therapistOnly = [requireAuth, requireRole('THERAPIST')];

// Public
therapistRouter.get('/', listTherapists);

// Protected (declared before "/:slug" so "me" is never treated as a slug)
therapistRouter.get('/me', ...therapistOnly, getMyProfile);
therapistRouter.put('/me', ...therapistOnly, updateMyProfile);

// Uploads: auth + role + rate limit run BEFORE multer, so anonymous requests never reach the file parser.
therapistRouter.post('/me/avatar', ...therapistOnly, uploadLimiter, avatarUpload, setMyAvatar);
therapistRouter.delete('/me/avatar', ...therapistOnly, removeMyAvatar);
therapistRouter.post('/me/certificates', ...therapistOnly, uploadLimiter, certificateUpload, addMyCertificate);
therapistRouter.delete('/me/certificates/:certId', ...therapistOnly, removeMyCertificate);

// Public
therapistRouter.get('/:slug', getTherapistBySlug);
