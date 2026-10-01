import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    from: { type: String, enum: ['customer', 'seller'], required: true },
    text: { type: String, required: true, trim: true, maxlength: 4000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const conversationSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    messages: { type: [messageSchema], default: [] },
    lastMessage: { type: String, default: '' },
    unread: { type: Boolean, default: true },
  },
  { timestamps: true }
);

conversationSchema.index({ seller: 1, updatedAt: -1 });
conversationSchema.index({ seller: 1, customer: 1 }, { unique: true });

export default mongoose.model('Conversation', conversationSchema);
