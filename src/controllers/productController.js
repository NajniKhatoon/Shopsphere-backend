import asyncHandler from 'express-async-handler';
import Product from '../models/Product.js';
import SellerProfile from '../models/SellerProfile.js';
import { ApiError } from '../utils/ApiError.js';

const SELLER_POPULATE = { path: 'seller', select: 'name' };
const CATEGORY_POPULATE = { path: 'category', select: 'name' };

function withStoreName(product, storeNameByUserId) {
  const obj = product.toObject ? product.toObject() : product;
  return {
    ...obj,
    seller: {
      _id: obj.seller?._id || obj.seller,
      name: obj.seller?.name,
      storeName: storeNameByUserId.get(String(obj.seller?._id || obj.seller)) || obj.seller?.name,
    },
  };
}

async function attachStoreNames(products) {
  const sellerIds = [...new Set(products.map((p) => String(p.seller?._id || p.seller)))];
  const profiles = await SellerProfile.find({ user: { $in: sellerIds } }).select('user storeName');
  const storeNameByUserId = new Map(profiles.map((p) => [String(p.user), p.storeName]));
  return products.map((p) => withStoreName(p, storeNameByUserId));
}

// GET /api/products?keyword=&category=&sort=&limit=&page=
export const getProducts = asyncHandler(async (req, res) => {
  const { keyword = '', category = '', sort = '', limit = 20, page = 1 } = req.query;

  const filter = { isActive: true };
  if (keyword) filter.$text = { $search: keyword };
  if (category) filter.category = category;

  let sortSpec = { createdAt: -1 };
  if (sort === 'price_asc') sortSpec = { price: 1 };
  else if (sort === 'price_desc') sortSpec = { price: -1 };
  else if (sort === 'rating') sortSpec = { ratingsAverage: -1 };
  else if (sort === 'popular') sortSpec = { ratingsCount: -1, ratingsAverage: -1 };

  const pageSize = Math.min(Number(limit) || 20, 100);
  const pageNum = Math.max(Number(page) || 1, 1);

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate(SELLER_POPULATE)
      .populate(CATEGORY_POPULATE)
      .sort(sortSpec)
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize),
    Product.countDocuments(filter),
  ]);

  res.json({
    products: await attachStoreNames(products),
    total,
    page: pageNum,
    pages: Math.ceil(total / pageSize) || 1,
  });
});

// GET /api/products/:id
export const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate(SELLER_POPULATE).populate(CATEGORY_POPULATE);
  if (!product) throw new ApiError(404, 'Product not found.');
  const [withStore] = await attachStoreNames([product]);
  res.json(withStore);
});

// GET /api/products/seller/mine  (seller)
export const getMyProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({ seller: req.user._id }).populate(CATEGORY_POPULATE).sort({ createdAt: -1 });
  res.json(products);
});

// POST /api/products  (seller, must be approved)
export const createProduct = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    const profile = await SellerProfile.findOne({ user: req.user._id });
    if (!profile || profile.approvalStatus !== 'approved') {
      throw new ApiError(403, 'Your seller account must be approved before you can list products.');
    }
  }
  
  const { name, category, price, stock, description, images, discountPrice } = req.body;
  if (!name || !category || price === undefined) {
    throw new ApiError(400, 'name, category, and price are required.');
  }

  const product = await Product.create({
    name,
    category,
    price,
    discountPrice: discountPrice || 0,
    stock: stock || 0,
    description: description || '',
    images: Array.isArray(images) && images.length ? images : [],
    seller: req.user._id,
  });

  res.status(201).json(product);
});

// PUT /api/products/:id  (seller: own products only; admin: any product)
export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found.');
  if (req.user.role !== 'admin' && String(product.seller) !== String(req.user._id)) {
    throw new ApiError(403, 'You can only edit your own products.');
  }

  const editable = ['name', 'category', 'price', 'discountPrice', 'stock', 'description', 'images', 'isActive'];
  editable.forEach((field) => {
    if (req.body[field] !== undefined) product[field] = req.body[field];
  });

  await product.save();
  res.json(product);
});

// DELETE /api/products/:id  (seller: own products only; admin: any product)
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found.');
  if (req.user.role !== 'admin' && String(product.seller) !== String(req.user._id)) {
    throw new ApiError(403, 'You can only delete your own products.');
  }

  await product.deleteOne();
  res.status(204).send();
});