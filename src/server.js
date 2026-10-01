import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await connectDB();
   const server = app.listen(PORT, () => {
   console.log(`ShopSphere API listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
    console.log(`http://localhost:${PORT}/api/categories`);
});

    const shutdown = (signal) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      server.close(() => process.exit(0));
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
