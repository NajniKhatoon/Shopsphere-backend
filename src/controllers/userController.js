import asyncHandler from 'express-async-handler';
import User from '../models/User.js';
import SellerProfile from '../models/SellerProfile.js';
import { ApiError } from '../utils/ApiError.js';

// PUT /api/users/me
// Updates the logged-in user's profile, and their store info if they're a seller.
export const updateMyProfile = asyncHandler(async (req, res) => {
  const { name, email, storeName, storeDescription } = req.body;

  const user = await User.findById(req.user._id);
  if (name) user.name = name;
  if (email) user.email = email;
  await user.save();

  if (user.role === 'seller') {
    const profile = await SellerProfile.findOne({ user: user._id });
    if (profile) {
      if (storeName) profile.storeName = storeName;
      if (storeDescription !== undefined) profile.storeDescription = storeDescription;
      await profile.save();
    }
  }

  res.json(user.toPublicJSON());
});

// GET /api/users  (admin)
export const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json(users);
});

// PATCH /api/users/:id/status  (admin)
export const updateUserStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found.');

  user.isActive = Boolean(isActive);
  await user.save();
  res.json(user);
});

// DELETE /api/users/:id  (admin)
export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found.');

  if (String(user._id) === String(req.user._id)) {
    throw new ApiError(400, 'You cannot delete your own account.');
  }
  if (user.role === 'admin') {
    throw new ApiError(400, 'Admin accounts cannot be deleted from here.');
  }

  // Clean up the seller profile too, so no orphaned record is left behind.
  if (user.role === 'seller') {
    await SellerProfile.deleteOne({ user: user._id });
  }

  await user.deleteOne();
  res.status(204).send();
});