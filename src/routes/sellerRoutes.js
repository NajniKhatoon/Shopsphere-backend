import { Router } from 'express';
import {
  applyAsSeller,
  getSellers,
  updateSellerStatus,
  getMyProfile,
  getMyStats,
  getMyEarnings,
} from '../controllers/sellerController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = Router();

router.post('/apply', protect, applyAsSeller);
router.get('/', protect, restrictTo('admin'), getSellers);
router.patch('/:id/status', protect, restrictTo('admin'), updateSellerStatus);
router.get('/me', protect, restrictTo('seller'), getMyProfile);
router.get('/me/stats', protect, restrictTo('seller'), getMyStats);
router.get('/me/earnings', protect, restrictTo('seller'), getMyEarnings);

export default router;