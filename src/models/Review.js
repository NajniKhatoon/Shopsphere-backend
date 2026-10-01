import mongoose from 'mongoose';
import Product from './Product.js';

const reviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 2000, default: '' },
  },
  { timestamps: true }
);

// One review per customer per product.
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

export async function recalculateProductRatings(productId) {
  const stats = await mongoose.model('Review').aggregate([
    { $match: { product: productId } },
    { $group: { _id: '$product', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  const { avg = 0, count = 0 } = stats[0] || {};
  await Product.findByIdAndUpdate(productId, {
    ratingsAverage: Math.round(avg * 10) / 10,
    ratingsCount: count,
  });
}

reviewSchema.post('save', function onSave(doc) {
  recalculateProductRatings(doc.product).catch((err) => console.error('Rating recalculation failed:', err));
});

reviewSchema.post('findOneAndDelete', function onDelete(doc) {
  if (doc) recalculateProductRatings(doc.product).catch((err) => console.error('Rating recalculation failed:', err));
});

export default mongoose.model('Review', reviewSchema);