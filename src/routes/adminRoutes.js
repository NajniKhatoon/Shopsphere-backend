import { Router } from 'express';
import { getAdminStats, getAdminReports, getAdminProducts } from '../controllers/adminController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = Router();

router.use(protect, restrictTo('admin'));
router.get('/stats', getAdminStats);
router.get('/reports', getAdminReports);
router.get('/products', getAdminProducts);

export default router;