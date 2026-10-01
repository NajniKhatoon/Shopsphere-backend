import { Router } from 'express';
import { updateMyProfile, getUsers, updateUserStatus, deleteUser } from '../controllers/userController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = Router();

router.put('/me', protect, updateMyProfile);
router.get('/', protect, restrictTo('admin'), getUsers);
router.patch('/:id/status', protect, restrictTo('admin'), updateUserStatus);
router.delete('/:id', protect, restrictTo('admin'), deleteUser);

export default router;