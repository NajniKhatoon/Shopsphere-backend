import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import { ApiError } from '../utils/ApiError.js';
import User from '../models/User.js';

// Verifies the Bearer token and loads the current user onto req.user.
// Rejects deactivated accounts even if their token is still valid.
export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new ApiError(401, 'Not authenticated. Please log in.');
  }

  const token = header.split(' ')[1];
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new ApiError(401, 'Invalid or expired session. Please log in again.');
  }

  const user = await User.findById(payload.id);
  if (!user) throw new ApiError(401, 'User no longer exists.');
  if (!user.isActive) throw new ApiError(403, 'This account has been deactivated.');

  req.user = user;
  next();
});

// Restricts a route to one or more roles, e.g. restrictTo('seller', 'admin').
export const restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    throw new ApiError(403, 'You do not have permission to perform this action.');
  }
  next();
};
