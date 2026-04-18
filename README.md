# FindDen — Real Estate Platform

A production-grade real estate platform built with React + Node.js/Express.
Data is served from JSON files (same schema as the PostgreSQL design) — swap in a real DB when ready.

---

## Quick Start

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9
- A Google Maps API Key (for the map view)

---

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env and set JWT_SECRET=your_secret_here
npm install
npm run dev
# API running at http://localhost:5000
# Health check: http://localhost:5000/api/health
```

**Demo accounts** (password: `password123` for all):
| Email | Role |
|---|---|
| admin@findden.in | admin |
| priya@findden.in | agent |
| rahul@gmail.com | buyer |
| ananya@findden.in | owner |

---

### 2. Frontend

```bash
cd frontend
cp .env.example .env
# Edit .env:
#   VITE_API_BASE_URL=http://localhost:5000/api
#   VITE_GOOGLE_MAPS_API_KEY=your_key_here
npm install
npm run dev
# App running at http://localhost:5173
```

---

## Architecture

```
findDen/
├── backend/                    # Express API
│   ├── db/data/               # JSON "database" files
│   │   ├── users.json
│   │   ├── properties.json    # 15 seed properties across India
│   │   ├── plans.json         # Starter / Pro / Enterprise
│   │   ├── subscriptions.json
│   │   └── transactions.json
│   └── src/
│       ├── config/            # env, constants, JSON database engine
│       ├── models/            # JSON CRUD operations (mirrors SQL schema)
│       ├── services/          # Business logic incl. pricing engine
│       ├── controllers/       # HTTP request handling
│       ├── routes/            # Express routers + Joi validation
│       ├── middlewares/       # JWT auth, RBAC, rate limiting, errors
│       └── utils/             # response envelope, pagination, geo
│
└── frontend/                  # Vite + React
    └── src/
        ├── pages/             # HomePage, Detail, Pricing, Dashboard, Auth
        ├── components/        # PropertyCard, MapView, FilterBar, etc.
        ├── services/          # Axios API calls (one file per resource)
        ├── store/             # Zustand (authStore, propertyStore)
        └── utils/             # formatCurrency, formatDate, debounce, geo
```

---

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Register |
| POST | `/api/auth/login` | — | Login → JWT |
| GET | `/api/auth/me` | ✓ | Current user |
| GET | `/api/properties` | opt | Search + map bounds |
| GET | `/api/properties/my` | ✓ | My listings |
| GET | `/api/properties/:id` | opt | Property detail |
| POST | `/api/properties` | ✓ | Create listing |
| PATCH | `/api/properties/:id` | ✓ | Update listing |
| DELETE | `/api/properties/:id` | ✓ | Delete listing |
| GET | `/api/plans` | — | All plans |
| POST | `/api/subscriptions` | ✓ | Subscribe |
| GET | `/api/subscriptions/me` | ✓ | My subscription |
| POST | `/api/subscriptions/:id/upgrade` | ✓ | Upgrade plan |
| POST | `/api/payments/initiate` | ✓ | Create order |
| POST | `/api/payments/verify` | ✓ | Verify payment |
| GET | `/api/payments/history` | ✓ | Transactions |
| GET | `/api/dashboard` | ✓ | Dashboard data |
| GET | `/api/health` | — | Health check |

---

## Migrating to PostgreSQL

1. Run the SQL schema from `SYSTEM_DESIGN.md` → Section 4.
2. Replace each model file in `backend/src/models/` with `pg` pool queries.
3. The service and controller layers stay **identical** — no other changes needed.

---

## Environment Variables

### Backend (`backend/.env`)
```
PORT=5000
NODE_ENV=development
JWT_SECRET=change_this_in_production
JWT_EXPIRES_IN=24h
ALLOWED_ORIGINS=http://localhost:5173
```

### Frontend (`frontend/.env`)
```
VITE_API_BASE_URL=http://localhost:5000/api
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_key
```

---

## Pricing Engine

All pricing logic lives in `backend/src/services/pricing.service.js`.

**Flow when posting a listing:**
1. Has active subscription with remaining quota? → Deduct 1 slot.
2. No subscription / quota exhausted → Require `paymentRef` (pay-per-listing ₹299).
3. No subscription, no payment → Return 402.

The frontend never makes this decision — it always goes through the API.
