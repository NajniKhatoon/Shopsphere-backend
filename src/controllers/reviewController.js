import asyncHandler from 'express-async-handler';
import Review, { recalculateProductRatings } from '../models/Review.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import { ApiError } from '../utils/ApiError.js';

// GET /api/products/:productId/reviews
export const getProductReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ product: req.params.productId })
    .populate({ path: 'user', select: 'name' })
    .sort({ createdAt: -1 });
  res.json(reviews);
});

// POST /api/products/:productId/reviews  (customer, must have purchased)
export const createReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  const { productId } = req.params;

  if (!rating || rating < 1 || rating > 5) throw new ApiError(400, 'Rating must be between 1 and 5.');

  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, 'Product not found.');

  const hasPurchased = await Order.exists({
    customer: req.user._id,
    'items.product': productId,
    orderStatus: 'delivered',
  });
  if (!hasPurchased) throw new ApiError(403, 'You can only review products you have purchased and received.');

  const existing = await Review.findOne({ product: productId, user: req.user._id });
  if (existing) throw new ApiError(409, 'You have already reviewed this product.');

  const review = await Review.create({ product: productId, user: req.user._id, rating, comment });
  await recalculateProductRatings(productId); // ensure product.ratingsAverage is fresh before responding
  await review.populate({ path: 'user', select: 'name' });
  res.status(201).json(review);
});

// GET /api/reviews/seller/mine  (seller)
export const getMySellerReviews = asyncHandler(async (req, res) => {
  const myProductIds = await Product.find({ seller: req.user._id }).distinct('_id');
  const reviews = await Review.find({ product: { $in: myProductIds } })
    .populate({ path: 'user', select: 'name' })
    .populate({ path: 'product', select: 'name images' })
    .sort({ createdAt: -1 });
  res.json(reviews);
});

// GET /api/reviews  (admin)
export const getAllReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find()
    .populate({ path: 'user', select: 'name' })
    .populate({ path: 'product', select: 'name' })
    .sort({ createdAt: -1 });
  res.json(reviews);
});