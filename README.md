# ShopSphere Backend

A REST API for ShopSphere — a multi-role (customer / seller / admin) e-commerce
marketplace — built with **Node.js, Express, and MongoDB (Mongoose)**, using
**JWT** bearer-token authentication.

This replaces the frontend's in-browser mock (`src/api/mockData.js` +
`src/api/axios.js`), which kept everything in `localStorage`. The API design
here is **not** a byte-for-byte copy of the mock's ad-hoc routes — it's a
cleaner REST layout (see "Differences from the old mock" below), so a few
frontend call sites will need small updates to point at it. Cart and wishlist
stay entirely client-side in this app and have no backend routes.

## Stack

- Node.js (ESM) + Express 4
- MongoDB + Mongoose 8
- JWT auth (`jsonwebtoken`) + `bcryptjs` password hashing
- `helmet`, `cors`, `express-rate-limit`, `morgan` for hardening/logging

## Getting started

```bash
cd shopsphere-backend
npm install
cp .env.example .env
# edit .env — at minimum set MONGODB_URI and JWT_SECRET
```

You need a MongoDB instance. Options:
- **Local**: install MongoDB Community Server and use `mongodb://127.0.0.1:27017/shopsphere`
- **Atlas (free tier)**: create a cluster at mongodb.com/atlas and paste the connection string
- **Docker**: `docker run -d -p 27017:27017 --name shopsphere-mongo mongo:7`

Then seed demo data and start the server:

```bash
npm run seed   # wipes and loads demo users, categories, products, orders...
npm run dev    # starts on http://localhost:5000 with auto-reload
# or: npm start
```

Demo accounts (password for all: `password123`):

| Email | Role |
|---|---|
| `customer@shopsphere.com` | customer |
| `seller@shopsphere.com` | seller (approved — TechBazaar Nepal) |
| `homestyle@shopsphere.com` | seller (approved — Nepal Home & Style) |
| `admin@shopsphere.com` | admin |

Health check: `GET /api/health` → `{ status: "ok" }`

## Auth

Login/register return `{ _id, name, email, role, token }`. Send the token on
subsequent requests as `Authorization: Bearer <token>`.

## API reference

All routes are prefixed with `/api`.

### Auth
| Method | Route | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` | — | `{ name, email, password, role? }` |
| POST | `/auth/login` | — | `{ email, password }` |
| GET | `/auth/me` | any | current user |

### Users
| Method | Route | Auth | Notes |
|---|---|---|---|
| PUT | `/users/me` | any | update own name/email (+ store fields if seller) |
| GET | `/users` | admin | list all users |
| PATCH | `/users/:id/status` | admin | `{ isActive }` |

### Categories
| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/categories` | — | includes live `productCount` |
| POST | `/categories` | admin | `{ name }` |
| DELETE | `/categories/:id` | admin | 400 if products still use it |

### Products
| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/products` | — | query: `keyword, category, sort(price_asc\|price_desc\|rating), limit, page` → `{ products, total, page, pages }` |
| GET | `/products/:id` | — | single product |
| GET | `/products/seller/mine` | seller | own listings |
| POST | `/products` | seller | requires an **approved** seller profile |
| PUT | `/products/:id` | seller | own products only |
| DELETE | `/products/:id` | seller | own products only |
| GET | `/products/:productId/reviews` | — | |
| POST | `/products/:productId/reviews` | customer | only if you have a **delivered** order containing that product |

### Reviews
| Method | Route | Auth |
|---|---|---|
| GET | `/reviews/seller/mine` | seller |
| GET | `/reviews` | admin |

### Orders
| Method | Route | Auth | Notes |
|---|---|---|---|
| POST | `/orders` | customer | `{ items:[{productId,quantity}], shippingAddress, paymentMethod }` — price/stock recomputed server-side in a transaction |
| GET | `/orders/mine` | customer | |
| GET | `/orders/seller/mine` | seller | orders containing your products |
| GET | `/orders` | admin | all orders |
| GET | `/orders/:id` | owner / involved seller / admin | |
| PATCH | `/orders/:id/status` | seller / admin | `{ status }`; sellers only update their own line items |

### Sellers
| Method | Route | Auth | Notes |
|---|---|---|---|
| POST | `/sellers/apply` | any authenticated user | `{ storeName, storeDescription }`; promotes `customer` → `seller` role, sets `approvalStatus: pending` |
| GET | `/sellers` | admin | all seller profiles |
| PATCH | `/sellers/:id/status` | admin | `{ approvalStatus: pending\|approved\|rejected }` |
| GET | `/sellers/me/stats` | seller | dashboard totals |
| GET | `/sellers/me/earnings` | seller | earnings breakdown |

### Admin
| Method | Route | Auth |
|---|---|---|
| GET | `/admin/stats` | admin |
| GET | `/admin/reports` | admin |

### Conversations (seller ↔ customer messaging)
| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/conversations/mine` | any | sellers see their inbox, customers see their threads |
| POST | `/conversations` | customer | `{ sellerId, text }` starts/continues a thread |
| POST | `/conversations/:id/messages` | seller or customer in that thread | `{ text }` |

## Differences from the old mock — frontend call sites to update

The mock's routing was ad hoc; this API is a cleaner REST redesign, so these
frontend files need small updates when you wire in the real backend:

1. **`src/api/axios.js`** — replace the mock dispatcher with a real HTTP client,
   e.g.:
   ```js
   import axios from 'axios';
   const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api' });
   api.interceptors.request.use((config) => {
     const user = JSON.parse(localStorage.getItem('shopsphere_user') || 'null');
     if (user?.token) config.headers.Authorization = `Bearer ${user.token}`;
     return config;
   });
   export default api;
   ```
2. **Profile update** — was `PUT /users/:id/profile`, now `PUT /users/me` (no id needed; `AuthContext.jsx`).
3. **Order status update** — was `PUT /orders/:orderId/items/:itemId/status`, now `PATCH /orders/:id/status` (`SellerOrders.jsx`, `AdminOrders.jsx`).
4. **Admin: seller approval** — was `PUT /admin/sellers/:id/status`, now `PATCH /sellers/:id/status` (`AdminSellers.jsx`).
5. **Admin: user activation** — was `PUT /admin/users/:id/status`, now `PATCH /users/:id/status` (`AdminUsers.jsx`).
6. **Messaging** — was `GET /messages/mine` + `POST /messages/:id`, now `GET /conversations/mine` + `POST /conversations/:id/messages` (`SellerMessages.jsx`). Starting a *new* thread as a customer is a new capability (`POST /conversations`) the mock didn't have.
7. **Product reviews** — the mock had no "submit a review" endpoint at all; this API adds `POST /products/:productId/reviews`, gated on a delivered order. If there's no review-submission UI yet, this is a good addition to build.
8. Everything else (`/auth/*`, `GET /products`, `GET /categories`, `POST /orders`, `POST /sellers/apply`, seller stats/earnings) matches the mock's call signature closely enough to work unchanged.

## Project layout

```
src/
  config/db.js          Mongo connection
  models/                Mongoose schemas (User, Category, Product, Review, Order, SellerProfile, Conversation)
  middleware/auth.js      JWT verification + role guard
  middleware/errorHandler.js
  controllers/            business logic per resource
  routes/                 route wiring
  seed/seed.js            demo data loader
  app.js                  Express app (no listen)
  server.js               entry point (connects DB, then listens)
```

## Security notes

- Passwords hashed with bcrypt (cost factor 12), never returned in API responses.
- Order prices/stock are always recalculated server-side inside a MongoDB
  transaction — client-submitted prices are ignored.
- Reviews require a delivered order for that product from that customer.
- Products can only be created by sellers with an **approved** `SellerProfile`.
- Rate limiting is applied globally to `/api` (configurable via `.env`).
