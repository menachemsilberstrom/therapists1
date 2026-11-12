import { Router } from 'express';
import {
  getMyProfile,
  getTherapistBySlug,
  listTherapists,
  updateMyProfile,
} from '../controllers/therapistController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';

export const therapistRouter = Router();

// Public
therapistRouter.get('/', listTherapists);

// Protected (must be declared before "/:slug" so "me" is not treated as a slug)
therapistRouter.get('/me', requireAuth, requireRole('THERAPIST'), getMyProfile);
therapistRouter.put('/me', requireAuth, requireRole('THERAPIST'), updateMyProfile);

// Public
therapistRouter.get('/:slug', getTherapistBySlug);
