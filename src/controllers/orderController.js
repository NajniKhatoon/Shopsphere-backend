import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { ApiError } from '../utils/ApiError.js';

const FREE_SHIPPING_THRESHOLD = 5000;
const SHIPPING_FEE = 150;
const TAX_RATE = 0.13;

// POST /api/orders  (customer)
// Prices are always recomputed server-side from current product data —
// never trust prices sent by the client.
export const createOrder = asyncHandler(async (req, res) => {
  const { items, shippingAddress, paymentMethod } = req.body;

  if (!Array.isArray(items) || items.length === 0) throw new ApiError(400, 'Your order has no items.');
  if (!shippingAddress) throw new ApiError(400, 'A shipping address is required.');
  if (!paymentMethod) throw new ApiError(400, 'A payment method is required.');

  const session = await mongoose.startSession();
  let order;

  try {
    await session.withTransaction(async () => {
      const orderItems = [];

      for (const { productId, quantity } of items) {
        if (!quantity || quantity < 1) throw new ApiError(400, 'Quantity must be at least 1.');

        const product = await Product.findById(productId).session(session);
        if (!product || !product.isActive) {
          throw new ApiError(400, 'One of the products in your cart is no longer available.');
        }
        if (product.stock < quantity) {
          throw new ApiError(400, `Not enough stock for "${product.name}". Only ${product.stock} left.`);
        }

        const price = product.discountPrice > 0 ? product.discountPrice : product.price;
        orderItems.push({
          product: product._id,
          name: product.name,
          image: product.images?.[0] || '',
          price,
          quantity,
          seller: product.seller,
        });

        product.stock -= quantity;
        await product.save({ session });
      }

      const itemsPrice = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const shippingPrice = itemsPrice >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
      const taxPrice = Math.round(itemsPrice * TAX_RATE);
      const totalAmount = itemsPrice + shippingPrice + taxPrice;

      const [created] = await Order.create(
        [
          {
            customer: req.user._id,
            items: orderItems,
            shippingAddress: { ...shippingAddress, country: 'Nepal' },
            paymentMethod,
            itemsPrice,
            shippingPrice,
            taxPrice,
            totalAmount,
          },
        ],
        { session }
      );
      order = created;
    });
  } finally {
    session.endSession();
  }

  res.status(201).json(order);
});

// GET /api/orders/mine  (customer)
export const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ customer: req.user._id }).sort({ createdAt: -1 });
  res.json(orders);
});

// GET /api/orders/seller/mine  (seller)
export const getMySellerOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ 'items.seller': req.user._id })
    .populate({ path: 'customer', select: 'name' })
    .sort({ createdAt: -1 });
  res.json(orders);
});

// GET /api/orders  (admin)
export const getAllOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find().populate({ path: 'customer', select: 'name email' }).sort({ createdAt: -1 });
  res.json(orders);
});

// GET /api/orders/:id  (owner, an involved seller, or admin)
export const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate({ path: 'customer', select: 'name' });
  if (!order) throw new ApiError(404, 'Order not found.');

  const isOwner = String(order.customer._id) === String(req.user._id);
  const isInvolvedSeller = order.items.some((i) => String(i.seller) === String(req.user._id));
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isInvolvedSeller && !isAdmin) throw new ApiError(403, 'You cannot view this order.');

  res.json(order);
});

const STATUS_FLOW = ['placed', 'processing', 'shipped', 'delivered', 'cancelled'];

// PATCH /api/orders/:id/status  (seller of an item in the order, or admin)
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!STATUS_FLOW.includes(status)) throw new ApiError(400, `Status must be one of: ${STATUS_FLOW.join(', ')}`);

  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found.');

  const isInvolvedSeller = order.items.some((i) => String(i.seller) === String(req.user._id));
  if (req.user.role !== 'admin' && !isInvolvedSeller) {
    throw new ApiError(403, 'You cannot update this order.');
  }

  order.orderStatus = status;
  // Sellers only update their own line items; admins can set the whole order.
  order.items.forEach((item) => {
    if (req.user.role === 'admin' || String(item.seller) === String(req.user._id)) {
      item.status = status;
    }
  });

  await order.save();
  res.json(order);
});
