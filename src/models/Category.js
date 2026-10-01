import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true, maxlength: 60 },
  },
  { timestamps: true }
);

export default mongoose.model('Category', categorySchema);
