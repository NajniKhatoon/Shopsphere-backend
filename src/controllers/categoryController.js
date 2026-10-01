import asyncHandler from 'express-async-handler';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { ApiError } from '../utils/ApiError.js';

// GET /api/categories
export const getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find().sort({ name: 1 });

  // Attach a live product count for each category (used in the storefront UI).
  const counts = await Product.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));

  res.json(
    categories.map((c) => ({
      _id: c._id,
      name: c.name,
      productCount: countMap.get(c._id.toString()) || 0,
    }))
  );
});

// POST /api/categories  (admin)
export const createCategory = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name) throw new ApiError(400, 'Category name is required.');

  const exists = await Category.findOne({ name: new RegExp(`^${name}$`, 'i') });
  if (exists) throw new ApiError(409, 'A category with that name already exists.');

  const category = await Category.create({ name });
  res.status(201).json(category);
});

// DELETE /api/categories/:id  (admin)
export const deleteCategory = asyncHandler(async (req, res) => {
  const inUse = await Product.exists({ category: req.params.id });
  if (inUse) throw new ApiError(400, 'Cannot delete a category that still has products in it.');

  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) throw new ApiError(404, 'Category not found.');
  res.status(204).send();
});
