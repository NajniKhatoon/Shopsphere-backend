import { Router } from 'express';
import {
  getProducts,
  getProductById,
  getMyProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/productController.js';
import { getProductReviews, createReview } from '../controllers/reviewController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = Router();

// Order matters: static/specific paths before the dynamic /:id.
router.get('/seller/mine', protect, restrictTo('seller'), getMyProducts);

router.get('/', getProducts);
router.post('/', protect, restrictTo('seller', 'admin'), createProduct);

router.get('/:id', getProductById);
router.put('/:id', protect, restrictTo('seller', 'admin'), updateProduct);
router.delete('/:id', protect, restrictTo('seller', 'admin'), deleteProduct);

router.get('/:productId/reviews', getProductReviews);
router.post('/:productId/reviews', protect, restrictTo('customer'), createReview);

export default router;
