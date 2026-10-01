import { Router } from 'express';
import { getMyConversations, startConversation, sendMessage } from '../controllers/conversationController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.get('/mine', protect, getMyConversations);
router.post('/', protect, startConversation);
router.post('/:id/messages', protect, sendMessage);

export default router;
