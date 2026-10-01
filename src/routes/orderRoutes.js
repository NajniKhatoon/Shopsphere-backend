import { Router } from 'express';
import {
  createOrder,
  getMyOrders,
  getMySellerOrders,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
} from '../controllers/orderController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = Router();

router.post('/', protect, restrictTo('customer'), createOrder);
router.get('/mine', protect, restrictTo('customer'), getMyOrders);
router.get('/seller/mine', protect, restrictTo('seller'), getMySellerOrders);
router.get('/', protect, restrictTo('admin'), getAllOrders);
router.get('/:id', protect, getOrderById);
router.patch('/:id/status', protect, restrictTo('seller', 'admin'), updateOrderStatus);

export default router;
