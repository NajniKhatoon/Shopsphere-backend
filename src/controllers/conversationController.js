import asyncHandler from 'express-async-handler';
import Conversation from '../models/Conversation.js';
import { ApiError } from '../utils/ApiError.js';

// GET /api/conversations/mine
// Works for both roles: sellers see their inbox, customers see their threads.
export const getMyConversations = asyncHandler(async (req, res) => {
  const filter = req.user.role === 'seller' ? { seller: req.user._id } : { customer: req.user._id };
  const conversations = await Conversation.find(filter)
    .populate({ path: 'customer', select: 'name' })
    .populate({ path: 'seller', select: 'name' })
    .sort({ updatedAt: -1 });
  res.json(conversations);
});

// POST /api/conversations  (customer starts a thread with a seller)
export const startConversation = asyncHandler(async (req, res) => {
  const { sellerId, text } = req.body;
  if (!sellerId || !text) throw new ApiError(400, 'sellerId and text are required.');

  let conversation = await Conversation.findOne({ seller: sellerId, customer: req.user._id });
  if (!conversation) {
    conversation = new Conversation({ seller: sellerId, customer: req.user._id, messages: [] });
  }

  conversation.messages.push({ from: 'customer', text });
  conversation.lastMessage = text;
  conversation.unread = true;
  await conversation.save();

  res.status(201).json(conversation);
});

// POST /api/conversations/:id/messages  (reply, either party)
export const sendMessage = asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text) throw new ApiError(400, 'Message text is required.');

  const conversation = await Conversation.findById(req.params.id);
  if (!conversation) throw new ApiError(404, 'Conversation not found.');

  const isSeller = String(conversation.seller) === String(req.user._id);
  const isCustomer = String(conversation.customer) === String(req.user._id);
  if (!isSeller && !isCustomer) throw new ApiError(403, 'You are not part of this conversation.');

  conversation.messages.push({ from: isSeller ? 'seller' : 'customer', text });
  conversation.lastMessage = text;
  conversation.unread = isSeller; // mark unread for the customer's side when seller replies, and vice versa
  await conversation.save();

  res.status(201).json(conversation);
});
