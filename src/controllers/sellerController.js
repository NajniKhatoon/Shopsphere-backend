import asyncHandler from 'express-async-handler';
import SellerProfile from '../models/SellerProfile.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import { ApiError } from '../utils/ApiError.js';

function salesByDay(orders, amountOf) {
  const days = {};
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    days[d.toISOString().slice(0, 10)] = 0;
  }
  orders.forEach((o) => {
    const key = o.createdAt.toISOString().slice(0, 10);
    if (key in days) days[key] += amountOf(o);
  });
  return days;
}

// POST /api/sellers/apply  (any authenticated user)
export const applyAsSeller = asyncHandler(async (req, res) => {
  const { storeName, storeDescription } = req.body;
  if (!storeName) throw new ApiError(400, 'Store name is required.');

  let profile = await SellerProfile.findOne({ user: req.user._id });
  if (profile) {
    profile.storeName = storeName;
    profile.storeDescription = storeDescription || '';
    profile.approvalStatus = 'pending';
  } else {
    profile = new SellerProfile({
      user: req.user._id,
      storeName,
      storeDescription: storeDescription || '',
      approvalStatus: 'pending',
    });
  }
  await profile.save();

  if (req.user.role === 'customer') {
    req.user.role = 'seller';
    await req.user.save();
  }

  res.status(201).json(profile);
});

// GET /api/sellers  (admin)
export const getSellers = asyncHandler(async (req, res) => {
  const sellers = await SellerProfile.find().populate({ path: 'user', select: 'name email isActive' }).sort({ createdAt: -1 });
  res.json(sellers);
});

// PATCH /api/sellers/:id/status  (admin)
export const updateSellerStatus = asyncHandler(async (req, res) => {
  const { approvalStatus } = req.body;
  if (!['pending', 'approved', 'rejected'].includes(approvalStatus)) {
    throw new ApiError(400, 'Invalid approval status.');
  }

  const profile = await SellerProfile.findById(req.params.id);
  if (!profile) throw new ApiError(404, 'Seller profile not found.');

  profile.approvalStatus = approvalStatus;
  await profile.save();
  res.json(profile);
});

// GET /api/sellers/me/stats  (seller)
export const getMyStats = asyncHandler(async (req, res) => {
  const [totalProducts, myOrders] = await Promise.all([
    Product.countDocuments({ seller: req.user._id }),
    Order.find({ 'items.seller': req.user._id }),
  ]);

  const totalSales = myOrders.reduce(
    (sum, o) => sum + o.items.filter((i) => String(i.seller) === String(req.user._id)).reduce((s, i) => s + i.price * i.quantity, 0),
    0
  );

  res.json({
    totalSales,
    totalOrders: myOrders.length,
    totalProducts,
    salesByDay: salesByDay(myOrders, (o) =>
      o.items.filter((i) => String(i.seller) === String(req.user._id)).reduce((s, i) => s + i.price * i.quantity, 0)
    ),
  });
});

// GET /api/sellers/me/earnings  (seller)
// A flat 15% platform commission is withheld as "pending"; the rest is
// treated as withdrawable. Adjust to match your actual payout logic.
const PLATFORM_COMMISSION_RATE = 0.15;

export const getMyEarnings = asyncHandler(async (req, res) => {
  const myOrders = await Order.find({ 'items.seller': req.user._id });

  const byProduct = {};
  myOrders.forEach((o) => {
    o.items
      .filter((i) => String(i.seller) === String(req.user._id))
      .forEach((i) => {
        byProduct[i.name] = (byProduct[i.name] || 0) + i.price * i.quantity;
      });
  });

  const totalEarnings = Object.values(byProduct).reduce((a, b) => a + b, 0);
  const pending = Math.round(totalEarnings * PLATFORM_COMMISSION_RATE);
  const withdrawn = totalEarnings - pending;

  res.json({
    totalEarnings,
    pending,
    withdrawn,
    byProduct: Object.entries(byProduct)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount),
    salesByDay: salesByDay(myOrders, (o) =>
      o.items.filter((i) => String(i.seller) === String(req.user._id)).reduce((s, i) => s + i.price * i.quantity, 0)
    ),
  });
});

// GET /api/sellers/me  (seller) — this account's own approval status.
export const getMyProfile = asyncHandler(async (req, res) => {
  const profile = await SellerProfile.findOne({ user: req.user._id });
  if (!profile) throw new ApiError(404, 'No seller profile found for this account.');
  res.json(profile);
});
