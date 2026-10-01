import asyncHandler from 'express-async-handler';
import User from '../models/User.js';
import SellerProfile from '../models/SellerProfile.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';

function salesByDay(orders) {
  const days = {};
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    days[d.toISOString().slice(0, 10)] = 0;
  }
  orders.forEach((o) => {
    const key = o.createdAt.toISOString().slice(0, 10);
    if (key in days) days[key] += o.totalAmount;
  });
  return days;
}

// GET /api/admin/stats
export const getAdminStats = asyncHandler(async (req, res) => {
  const [totalUsers, totalSellers, totalProducts, orders] = await Promise.all([
    User.countDocuments(),
    SellerProfile.countDocuments(),
    Product.countDocuments(),
    Order.find().select('totalAmount createdAt'),
  ]);

  res.json({
    totalUsers,
    totalSellers,
    totalProducts,
    totalOrders: orders.length,
    salesByDay: salesByDay(orders),
  });
});

// GET /api/admin/reports
export const getAdminReports = asyncHandler(async (req, res) => {
  const orders = await Order.find().populate({ path: 'items.product', select: 'category', populate: { path: 'category', select: 'name' } });

  const salesByCategory = {};
  const salesByProduct = {};
  let totalRevenue = 0;

  orders.forEach((o) => {
    totalRevenue += o.totalAmount;
    o.items.forEach((i) => {
      const catName = i.product?.category?.name || 'Other';
      const amount = i.price * i.quantity;
      salesByCategory[catName] = (salesByCategory[catName] || 0) + amount;
      salesByProduct[i.name] = (salesByProduct[i.name] || 0) + amount;
    });
  });

  const topProducts = Object.entries(salesByProduct)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, sales]) => ({ name, sales }));

  res.json({
    totalRevenue,
    salesByCategory,
    topProducts,
    salesByDay: salesByDay(orders),
  });
});

// GET /api/admin/products?limit=&page=
// Unlike GET /api/products, this returns ALL products (active + inactive)
// and is meant for the admin product table, not the public storefront.
export const getAdminProducts = asyncHandler(async (req, res) => {
  const { limit = 20, page = 1 } = req.query;
  const pageSize = Math.min(Number(limit) || 20, 200);
  const pageNum = Math.max(Number(page) || 1, 1);

  const [products, total] = await Promise.all([
    Product.find({})
      .populate({ path: 'seller', select: 'name' })
      .populate({ path: 'category', select: 'name' })
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize),
    Product.countDocuments({}),
  ]);

  const sellerIds = [...new Set(products.map((p) => String(p.seller?._id)))];
  const profiles = await SellerProfile.find({ user: { $in: sellerIds } }).select('user storeName');
  const storeNameByUserId = new Map(profiles.map((p) => [String(p.user), p.storeName]));

  const withStoreNames = products.map((p) => {
    const obj = p.toObject();
    return {
      ...obj,
      seller: {
        _id: obj.seller?._id,
        name: obj.seller?.name,
        storeName: storeNameByUserId.get(String(obj.seller?._id)) || obj.seller?.name,
      },
    };
  });

  res.json({
    products: withStoreNames,
    total,
    page: pageNum,
    pages: Math.ceil(total / pageSize) || 1,
  });
});