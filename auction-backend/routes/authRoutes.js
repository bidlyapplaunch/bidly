import express from 'express';
import {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  createDefaultAdmin,
  logout
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/create-admin', createDefaultAdmin); // For initial setup

// Protected routes (require authentication)
router.use(requireAuth); // Apply auth middleware to all routes below

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/change-password', changePassword);
router.post('/logout', logout);

export default router;
