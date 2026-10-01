import { Router } from 'express';
import { getMySellerReviews, getAllReviews } from '../controllers/reviewController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = Router();

router.get('/seller/mine', protect, restrictTo('seller'), getMySellerReviews);
router.get('/', protect, restrictTo('admin'), getAllReviews);

export default router;
