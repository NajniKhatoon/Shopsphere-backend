import asyncHandler from 'express-async-handler';
import User from '../models/User.js';
import SellerProfile from '../models/SellerProfile.js';
import { ApiError } from '../utils/ApiError.js';
import { generateToken } from '../utils/generateToken.js';

function authResponse(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    token: generateToken(user),
  };
}

// POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, storeName, storeDescription } = req.body;

  if (!name || !email || !password) {
    throw new ApiError(400, 'Name, email, and password are required.');
  }
  if (password.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters long.');
  }

  const wantsSeller = role === 'seller';
  if (wantsSeller && !storeName) {
    throw new ApiError(400, 'Store name is required to register as a seller.');
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw new ApiError(409, 'An account with this email already exists.');

  // The account is created with the requested role, but a seller account
  // has no real seller privileges until an admin approves its SellerProfile
  // (see productController.createProduct's approvalStatus check).
  const user = await User.create({
    name,
    email,
    password,
    role: wantsSeller ? 'seller' : 'customer',
  });

  if (wantsSeller) {
    await SellerProfile.create({
      user: user._id,
      storeName,
      storeDescription: storeDescription || '',
      approvalStatus: 'pending',
    });
  }

  res.status(201).json(authResponse(user));
});

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, 'Email and password are required.');

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password.');
  }
  if (!user.isActive) throw new ApiError(403, 'This account has been deactivated.');

  res.json(authResponse(user));
});

// GET /api/auth/me
export const getMe = asyncHandler(async (req, res) => {
  res.json(req.user.toPublicJSON());
});