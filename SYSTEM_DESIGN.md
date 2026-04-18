# FindDen — System Design Document

**Version:** 1.0
**Date:** April 2026
**Stack:** React · Node.js / Express · PostgreSQL + PostGIS · Google Maps

---

## Table of Contents

1. [Requirements](#1-requirements)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Entity Design & Data Model](#3-entity-design--data-model)
4. [PostgreSQL Schema](#4-postgresql-schema)
5. [API Contracts](#5-api-contracts)
6. [Folder Structure](#6-folder-structure)
7. [Pricing Engine Design](#7-pricing-engine-design)
8. [Map-Based Search Design](#8-map-based-search-design)
9. [Caching Strategy](#9-caching-strategy)
10. [Scale & Reliability](#10-scale--reliability)
11. [Trade-off Analysis](#11-trade-off-analysis)
12. [What to Revisit as the System Grows](#12-what-to-revisit-as-the-system-grows)

---

## 1. Requirements

### 1.1 Functional Requirements

| # | Requirement |
|---|-------------|
| F1 | Users can register, log in, and manage their profile |
| F2 | Agents/owners can create and manage property listings |
| F3 | Buyers can search properties by location, type, price, bedrooms, etc. |
| F4 | Map view renders property pins; panning/zooming re-fetches in bounds |
| F5 | Two monetisation models: pay-per-listing and subscription packages |
| F6 | Subscriptions have quota limits; quota is deducted on each listing posted |
| F7 | Payments are recorded as transactions |
| F8 | Dashboard shows active listings, quota remaining, and transaction history |
| F9 | Plans can be upgraded; upgrades extend quota and reset/extend expiry |

### 1.2 Non-Functional Requirements

| # | Requirement | Target |
|---|-------------|--------|
| NF1 | Read latency for property search | < 200 ms (p95) |
| NF2 | System must handle | Up to 10 M listings |
| NF3 | Map bounding-box query | < 300 ms |
| NF4 | Availability | 99.9 % uptime |
| NF5 | API-first design | All business logic in backend |
| NF6 | Horizontal scalability | Stateless Node.js servers behind a load balancer |

### 1.3 Constraints & Assumptions

- PostgreSQL with the PostGIS extension is the only database.
- Frontend is built against mock data but must honour real API contracts exactly.
- Google Maps JavaScript SDK is used for the map.
- No microservices yet — monolithic Express API, designed for easy extraction later.
- Redis is optional at this stage but is called out wherever it should be added.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLIENT (Browser)                        │
│                                                                  │
│   React SPA                                                      │
│   ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│   │ PropertyList │  │   MapView    │  │ Dashboard / Pricing  │  │
│   │ + Filters   │  │ (Google Maps)│  │ Plans / Transactions │  │
│   └──────┬──────┘  └──────┬───────┘  └──────────┬───────────┘  │
│          │                │                       │              │
│          └───────────────►│◄──────────────────────┘             │
│                    /api/* (REST + JSON)                          │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
                  ┌──────────▼──────────┐
                  │   Load Balancer /   │
                  │   Reverse Proxy     │
                  │   (Nginx / ALB)     │
                  └──────────┬──────────┘
                             │
          ┌──────────────────▼──────────────────┐
          │       Express API Server(s)          │
          │  ┌──────────┐  ┌──────────────────┐ │
          │  │  Routes  │  │   Middlewares     │ │
          │  └────┬─────┘  │ auth · validate  │ │
          │       │        │ rate-limit · log  │ │
          │  ┌────▼─────┐  └──────────────────┘ │
          │  │Controllers│                        │
          │  └────┬─────┘                        │
          │  ┌────▼─────┐                        │
          │  │ Services  │  ← business logic      │
          │  └────┬─────┘                        │
          │  ┌────▼─────┐                        │
          │  │  Models  │  ← DB queries           │
          │  └────┬─────┘                        │
          └───────┼──────────────────────────────┘
                  │
     ┌────────────▼──────────────┐
     │   PostgreSQL + PostGIS    │
     │   (primary read replica)  │
     └───────────────────────────┘
         (Redis cache — optional)
```

**Data flow for a map search:**

1. User pans map → Google Maps fires `bounds_changed` event (debounced 400 ms).
2. React calls `GET /api/properties?swLat=...&swLng=...&neLat=...&neLng=...`.
3. Express controller validates bounds, calls `PropertyService.search()`.
4. Service builds a PostGIS `ST_Within` query, applies filters, returns paginated results.
5. React renders pins on the map and cards in the list panel simultaneously.

---

## 3. Entity Design & Data Model

### 3.1 Core Entities

```
┌──────────┐        ┌─────────────┐        ┌──────────────┐
│   User   │        │   Property  │        │     Plan     │
├──────────┤        ├─────────────┤        ├──────────────┤
│ id       │◄──────►│ id          │        │ id           │
│ name     │  owns  │ owner_id    │        │ name         │
│ email    │        │ title       │        │ price        │
│ password │        │ description │        │ quota        │
│ role     │        │ price       │        │ duration_days│
│ phone    │        │ property_   │        │ is_active    │
│ created_at│       │   type      │        └──────┬───────┘
└──────────┘        │ status      │               │ subscribed to
                    │ bedrooms    │        ┌──────▼───────┐
                    │ bathrooms   │        │ Subscription │
                    │ area_sqft   │        ├──────────────┤
                    │ address     │        │ id           │
                    │ city        │        │ user_id      │
                    │ state       │        │ plan_id      │
                    │ pincode     │        │ quota_used   │
                    │ location    │◄──────►│ starts_at    │
                    │ (GEOGRAPHY) │geo     │ expires_at   │
                    │ images[]    │        │ status       │
                    │ created_at  │        └──────────────┘
                    └─────────────┘
                                                  ▲
                    ┌─────────────┐               │ relates to
                    │ Transaction │───────────────►┘
                    ├─────────────┤
                    │ id          │
                    │ user_id     │
                    │ property_id │ (nullable — for pay-per-listing)
                    │ subscription_id│ (nullable — for subscriptions)
                    │ amount      │
                    │ currency    │
                    │ status      │ (pending|success|failed)
                    │ payment_ref │ (gateway reference)
                    │ created_at  │
                    └─────────────┘
```

### 3.2 Relationships

| Relationship | Cardinality | Notes |
|---|---|---|
| User → Property | 1 : N | A user can own many properties |
| User → Subscription | 1 : N | A user can have multiple subscriptions (history) |
| User → Transaction | 1 : N | All payment records per user |
| Plan → Subscription | 1 : N | Many subscriptions can reference the same plan |
| Subscription → Transaction | 1 : 1..N | At least one transaction per subscription |
| Property → Transaction | 0..1 : 1 | Pay-per-listing creates one transaction per property |

### 3.3 Enumerations

```sql
-- User roles
CREATE TYPE user_role AS ENUM ('buyer', 'agent', 'owner', 'admin');

-- Property types
CREATE TYPE property_type AS ENUM (
  'apartment', 'house', 'villa', 'plot', 'commercial', 'pg'
);

-- Property status
CREATE TYPE property_status AS ENUM (
  'draft', 'pending_payment', 'active', 'paused', 'sold', 'rented', 'expired'
);

-- Subscription status
CREATE TYPE subscription_status AS ENUM (
  'active', 'expired', 'cancelled', 'paused'
);

-- Transaction status
CREATE TYPE transaction_status AS ENUM (
  'pending', 'success', 'failed', 'refunded'
);
```

---

## 4. PostgreSQL Schema

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100)  NOT NULL,
  email         VARCHAR(255)  NOT NULL UNIQUE,
  password_hash TEXT          NOT NULL,
  role          user_role     NOT NULL DEFAULT 'buyer',
  phone         VARCHAR(20),
  avatar_url    TEXT,
  is_verified   BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- ─────────────────────────────────────────────────────────
-- PLANS
-- ─────────────────────────────────────────────────────────
CREATE TABLE plans (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100)  NOT NULL,          -- "Starter", "Pro", "Enterprise"
  description   TEXT,
  price         NUMERIC(10,2) NOT NULL,           -- in INR / USD
  currency      CHAR(3)       NOT NULL DEFAULT 'INR',
  quota         INT           NOT NULL,           -- number of listings allowed
  duration_days INT           NOT NULL,           -- plan validity in days
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────
-- SUBSCRIPTIONS
-- ─────────────────────────────────────────────────────────
CREATE TABLE subscriptions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id       UUID          NOT NULL REFERENCES plans(id),
  quota_used    INT           NOT NULL DEFAULT 0,
  starts_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ   NOT NULL,
  status        subscription_status NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id  ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status   ON subscriptions(status);
CREATE INDEX idx_subscriptions_expires  ON subscriptions(expires_at);

-- ─────────────────────────────────────────────────────────
-- PROPERTIES
-- ─────────────────────────────────────────────────────────
CREATE TABLE properties (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id          UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title             VARCHAR(255)  NOT NULL,
  description       TEXT,
  property_type     property_type NOT NULL,
  status            property_status NOT NULL DEFAULT 'draft',
  listing_type      VARCHAR(10)   NOT NULL CHECK (listing_type IN ('sale','rent')),
  price             NUMERIC(14,2) NOT NULL,
  price_negotiable  BOOLEAN       NOT NULL DEFAULT FALSE,
  bedrooms          SMALLINT,
  bathrooms         SMALLINT,
  area_sqft         NUMERIC(10,2),
  furnishing        VARCHAR(20)   CHECK (furnishing IN ('unfurnished','semi','furnished')),
  floor             SMALLINT,
  total_floors      SMALLINT,
  address_line      TEXT          NOT NULL,
  city              VARCHAR(100)  NOT NULL,
  state             VARCHAR(100)  NOT NULL,
  pincode           VARCHAR(10)   NOT NULL,
  -- PostGIS geography column — stores (longitude, latitude)
  location          GEOGRAPHY(Point, 4326) NOT NULL,
  images            TEXT[]        NOT NULL DEFAULT '{}',
  amenities         TEXT[]        NOT NULL DEFAULT '{}',
  available_from    DATE,
  views_count       INT           NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Spatial index (GIST) — critical for bounding-box queries
CREATE INDEX idx_properties_location     ON properties USING GIST(location);
-- Standard indexes for common filter columns
CREATE INDEX idx_properties_city         ON properties(city);
CREATE INDEX idx_properties_status       ON properties(status);
CREATE INDEX idx_properties_type         ON properties(property_type);
CREATE INDEX idx_properties_listing_type ON properties(listing_type);
CREATE INDEX idx_properties_price        ON properties(price);
CREATE INDEX idx_properties_owner        ON properties(owner_id);
-- Composite index for the most common filter combination
CREATE INDEX idx_properties_search       ON properties(city, status, listing_type, property_type);

-- ─────────────────────────────────────────────────────────
-- TRANSACTIONS
-- ─────────────────────────────────────────────────────────
CREATE TABLE transactions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID          NOT NULL REFERENCES users(id),
  subscription_id   UUID          REFERENCES subscriptions(id),   -- nullable
  property_id       UUID          REFERENCES properties(id),       -- nullable
  amount            NUMERIC(10,2) NOT NULL,
  currency          CHAR(3)       NOT NULL DEFAULT 'INR',
  status            transaction_status NOT NULL DEFAULT 'pending',
  payment_gateway   VARCHAR(50),                                    -- 'razorpay', 'stripe'
  payment_ref       VARCHAR(255),                                   -- gateway order/payment id
  metadata          JSONB,                                          -- gateway response blob
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_status  ON transactions(status);
```

### 4.1 Key Query Patterns

**Bounding-box property search (PostGIS):**
```sql
SELECT
  p.id, p.title, p.price, p.bedrooms, p.property_type,
  p.city, p.address_line,
  ST_Y(p.location::geometry) AS latitude,
  ST_X(p.location::geometry) AS longitude,
  p.images[1]                AS thumbnail
FROM properties p
WHERE
  p.status = 'active'
  AND ST_Within(
    p.location::geometry,
    ST_MakeEnvelope(:sw_lng, :sw_lat, :ne_lng, :ne_lat, 4326)
  )
  AND (:listing_type IS NULL OR p.listing_type = :listing_type)
  AND (:property_type IS NULL OR p.property_type = :property_type)
  AND (:min_price     IS NULL OR p.price >= :min_price)
  AND (:max_price     IS NULL OR p.price <= :max_price)
  AND (:bedrooms      IS NULL OR p.bedrooms >= :bedrooms)
ORDER BY p.created_at DESC
LIMIT :limit OFFSET :offset;
```

**Active subscription check:**
```sql
SELECT id, plan_id, quota_used, expires_at
FROM subscriptions
WHERE user_id = :user_id
  AND status = 'active'
  AND expires_at > NOW()
ORDER BY expires_at DESC
LIMIT 1;
```

---

## 5. API Contracts

### 5.1 Standard Response Envelope

```json
// Success
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 4321
  }
}

// Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": [ ... ]
  }
}
```

### 5.2 Auth Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Return JWT |
| POST | `/api/auth/logout` | Invalidate token |
| GET  | `/api/auth/me` | Get current user |

**POST /api/auth/register — Request:**
```json
{
  "name": "Riya Sharma",
  "email": "riya@example.com",
  "password": "Min8Chars!",
  "role": "agent",
  "phone": "+919876543210"
}
```

**POST /api/auth/login — Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGci...",
    "user": {
      "id": "uuid",
      "name": "Riya Sharma",
      "email": "riya@example.com",
      "role": "agent"
    }
  }
}
```

### 5.3 Properties Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET  | `/api/properties` | Public | Search / filter with bounds |
| GET  | `/api/properties/:id` | Public | Property detail |
| POST | `/api/properties` | Agent/Owner | Create listing |
| PATCH | `/api/properties/:id` | Owner | Update listing |
| DELETE | `/api/properties/:id` | Owner/Admin | Remove listing |

**GET /api/properties — Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `swLat` | float | SW corner latitude |
| `swLng` | float | SW corner longitude |
| `neLat` | float | NE corner latitude |
| `neLng` | float | NE corner longitude |
| `city` | string | City name filter |
| `listingType` | sale \| rent | — |
| `propertyType` | apartment \| house \| villa \| plot \| commercial \| pg | — |
| `minPrice` | number | — |
| `maxPrice` | number | — |
| `bedrooms` | number | Minimum bedrooms |
| `furnishing` | unfurnished \| semi \| furnished | — |
| `page` | number | Default: 1 |
| `limit` | number | Default: 20, max: 100 |

**GET /api/properties — Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "2BHK in Koramangala",
      "propertyType": "apartment",
      "listingType": "rent",
      "price": 28000,
      "bedrooms": 2,
      "bathrooms": 2,
      "areaSqft": 1050,
      "city": "Bangalore",
      "addressLine": "5th Block, Koramangala",
      "latitude": 12.9352,
      "longitude": 77.6245,
      "thumbnail": "https://cdn.findden.in/img/uuid/1.jpg",
      "status": "active",
      "createdAt": "2026-03-15T10:00:00Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 342 }
}
```

**POST /api/properties — Request:**
```json
{
  "title": "3BHK Villa in Whitefield",
  "description": "Spacious villa with garden...",
  "propertyType": "villa",
  "listingType": "sale",
  "price": 8500000,
  "bedrooms": 3,
  "bathrooms": 3,
  "areaSqft": 2200,
  "furnishing": "semi",
  "addressLine": "Palm Meadows, Whitefield",
  "city": "Bangalore",
  "state": "Karnataka",
  "pincode": "560066",
  "latitude": 12.9698,
  "longitude": 77.7499,
  "images": ["https://cdn.findden.in/img/tmp/abc.jpg"],
  "amenities": ["parking", "gym", "pool"],
  "availableFrom": "2026-05-01"
}
```

### 5.4 Plans Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET  | `/api/plans` | Public | List all active plans |
| GET  | `/api/plans/:id` | Public | Plan detail |
| POST | `/api/plans` | Admin | Create plan |
| PATCH | `/api/plans/:id` | Admin | Update plan |

**GET /api/plans — Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Starter",
      "description": "Perfect for individual agents",
      "price": 999,
      "currency": "INR",
      "quota": 5,
      "durationDays": 30,
      "isActive": true
    },
    {
      "id": "uuid",
      "name": "Pro",
      "description": "For growing agencies",
      "price": 2999,
      "currency": "INR",
      "quota": 20,
      "durationDays": 30,
      "isActive": true
    }
  ]
}
```

### 5.5 Subscription Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/subscriptions` | Authenticated | Subscribe to a plan |
| GET  | `/api/subscriptions/me` | Authenticated | My active subscription |
| POST | `/api/subscriptions/:id/upgrade` | Authenticated | Upgrade plan |
| POST | `/api/subscriptions/:id/cancel` | Authenticated | Cancel subscription |

**POST /api/subscriptions — Request:**
```json
{ "planId": "uuid", "paymentRef": "rzp_order_abc123" }
```

**GET /api/subscriptions/me — Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "plan": { "id": "uuid", "name": "Pro", "quota": 20 },
    "quotaUsed": 7,
    "quotaRemaining": 13,
    "startsAt": "2026-03-01T00:00:00Z",
    "expiresAt": "2026-03-31T23:59:59Z",
    "status": "active"
  }
}
```

### 5.6 Payments Endpoint

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/payments/initiate` | Authenticated | Create payment order |
| POST | `/api/payments/verify` | Authenticated | Verify gateway callback |
| GET  | `/api/payments/history` | Authenticated | Paginated transaction history |

**POST /api/payments/initiate — Request:**
```json
{
  "type": "subscription",       // or "pay_per_listing"
  "planId": "uuid",             // for subscription
  "propertyId": "uuid"          // for pay_per_listing
}
```

**POST /api/payments/initiate — Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "rzp_order_abc123",
    "amount": 2999,
    "currency": "INR",
    "key": "rzp_live_xxxxxx"
  }
}
```

### 5.7 Dashboard Endpoint

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/dashboard` | Authenticated | Aggregated dashboard data |

**GET /api/dashboard — Response:**
```json
{
  "success": true,
  "data": {
    "subscription": { "plan": "Pro", "quotaUsed": 7, "quotaRemaining": 13, "expiresAt": "..." },
    "listings": {
      "total": 12,
      "active": 7,
      "paused": 2,
      "expired": 3
    },
    "recentTransactions": [ { ... } ],
    "totalViews": 4250
  }
}
```

---

## 6. Folder Structure

### 6.1 Backend (Node.js / Express)

```
backend/
├── src/
│   ├── app.js                  # Express app setup, middleware wiring
│   ├── server.js               # HTTP server entry point
│   │
│   ├── config/
│   │   ├── database.js         # pg Pool setup
│   │   ├── env.js              # Environment variable validation (dotenv)
│   │   └── constants.js        # App-wide constants
│   │
│   ├── routes/
│   │   ├── index.js            # Mount all routers
│   │   ├── auth.routes.js
│   │   ├── properties.routes.js
│   │   ├── plans.routes.js
│   │   ├── subscriptions.routes.js
│   │   ├── payments.routes.js
│   │   └── dashboard.routes.js
│   │
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── properties.controller.js
│   │   ├── plans.controller.js
│   │   ├── subscriptions.controller.js
│   │   ├── payments.controller.js
│   │   └── dashboard.controller.js
│   │
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── properties.service.js
│   │   ├── plans.service.js
│   │   ├── subscriptions.service.js
│   │   ├── pricing.service.js          # Core pricing engine
│   │   ├── payments.service.js
│   │   └── dashboard.service.js
│   │
│   ├── models/
│   │   ├── user.model.js
│   │   ├── property.model.js
│   │   ├── plan.model.js
│   │   ├── subscription.model.js
│   │   └── transaction.model.js
│   │
│   ├── middlewares/
│   │   ├── auth.middleware.js   # JWT verification
│   │   ├── validate.middleware.js # Joi/Zod request validation
│   │   ├── rbac.middleware.js   # Role-based access control
│   │   ├── rateLimiter.js
│   │   └── errorHandler.js
│   │
│   └── utils/
│       ├── logger.js            # Winston logger
│       ├── pagination.js        # Offset/limit helpers
│       ├── response.js          # Envelope builder (success/error)
│       └── geo.js               # ST_MakePoint builder helpers
│
├── db/
│   ├── migrations/             # Numbered SQL migration files
│   │   ├── 001_create_enums.sql
│   │   ├── 002_create_users.sql
│   │   ├── 003_create_plans.sql
│   │   ├── 004_create_subscriptions.sql
│   │   ├── 005_create_properties.sql
│   │   └── 006_create_transactions.sql
│   └── seeds/
│       ├── plans.seed.sql
│       └── demo_properties.seed.sql
│
├── .env.example
├── package.json
└── README.md
```

### 6.2 Frontend (React)

```
frontend/
├── public/
├── src/
│   ├── main.jsx                # Vite entry
│   ├── App.jsx                 # Router setup
│   │
│   ├── pages/
│   │   ├── HomePage.jsx        # Split layout: list + map
│   │   ├── PropertyDetailPage.jsx
│   │   ├── PostPropertyPage.jsx
│   │   ├── PricingPage.jsx
│   │   ├── DashboardPage.jsx
│   │   ├── LoginPage.jsx
│   │   └── RegisterPage.jsx
│   │
│   ├── components/
│   │   ├── property/
│   │   │   ├── PropertyCard.jsx
│   │   │   ├── PropertyList.jsx
│   │   │   ├── PropertyDetail.jsx
│   │   │   └── PropertyForm.jsx
│   │   ├── map/
│   │   │   ├── MapView.jsx     # Google Maps wrapper
│   │   │   ├── MapPin.jsx
│   │   │   └── MapCluster.jsx
│   │   ├── filters/
│   │   │   ├── FilterBar.jsx
│   │   │   └── FilterDrawer.jsx
│   │   ├── pricing/
│   │   │   ├── PricingPlans.jsx
│   │   │   └── PlanCard.jsx
│   │   ├── dashboard/
│   │   │   ├── QuotaWidget.jsx
│   │   │   ├── ListingsTable.jsx
│   │   │   └── TransactionHistory.jsx
│   │   └── shared/
│   │       ├── Navbar.jsx
│   │       ├── Footer.jsx
│   │       ├── Spinner.jsx
│   │       ├── Pagination.jsx
│   │       └── ErrorBoundary.jsx
│   │
│   ├── services/               # API call functions
│   │   ├── api.js              # Axios instance + interceptors
│   │   ├── properties.service.js
│   │   ├── auth.service.js
│   │   ├── plans.service.js
│   │   └── payments.service.js
│   │
│   ├── mocks/                  # Mock JSON for development
│   │   ├── properties.mock.js
│   │   ├── plans.mock.js
│   │   └── dashboard.mock.js
│   │
│   ├── store/                  # Zustand or Context
│   │   ├── authStore.js
│   │   └── propertyStore.js
│   │
│   ├── hooks/
│   │   ├── useProperties.js    # Data fetching + debounce
│   │   ├── useMapBounds.js     # Bounds → query params
│   │   └── useSubscription.js
│   │
│   └── utils/
│       ├── formatCurrency.js
│       ├── formatDate.js
│       └── debounce.js
│
├── vite.config.js
├── .env.example
└── package.json
```

---

## 7. Pricing Engine Design

The pricing engine lives entirely in `src/services/pricing.service.js` — never in the UI.

### 7.1 Decision Flow

```
POST /api/properties (new listing)
         │
         ▼
  Is user authenticated?  ──No──► 401
         │ Yes
         ▼
  Has active subscription?
         │
    Yes  │                  No
         ▼                   ▼
  quota_used < quota?    Require pay-per-listing
         │                   │
    Yes  │                   ▼
         ▼              Is paymentRef provided?
  Deduct 1 from quota       │
  quota_used += 1       No  │  Yes
         │              ▼   ▼
         ▼           Error  Verify payment with gateway
  Activate property          │
         │                   ▼
         ▼              Record transaction
  Return 201                 │
                             ▼
                        Activate property → Return 201
```

### 7.2 Quota Deduction (atomic transaction)

```sql
-- Inside a DB transaction:
UPDATE subscriptions
SET quota_used = quota_used + 1,
    updated_at = NOW()
WHERE id = :subscription_id
  AND status = 'active'
  AND expires_at > NOW()
  AND quota_used < (SELECT quota FROM plans WHERE id = plan_id)
RETURNING id, quota_used;
-- If 0 rows returned: quota exceeded → error
```

### 7.3 Subscription Upgrade Rules

- New quota = new plan quota (full reset — does not add remaining quota).
- New expiry = NOW() + new plan `duration_days`.
- Old subscription is set to `cancelled`.
- A new subscription row is created.
- A new transaction is created for the upgrade payment.

### 7.4 Expiry Check (automated)

A cron job (or pg_cron) runs daily:
```sql
UPDATE subscriptions
SET status = 'expired', updated_at = NOW()
WHERE status = 'active' AND expires_at <= NOW();
```

---

## 8. Map-Based Search Design

### 8.1 Google Maps Integration

```
1. Load Google Maps JS API with your key (restricted to domain).
2. On map idle event (debounced 400ms):
   a. Call map.getBounds() → { sw: {lat, lng}, ne: {lat, lng} }
   b. Build query string: swLat, swLng, neLat, neLng + active filters
   c. Call GET /api/properties
   d. Replace pin layer with new results
3. Clicking a pin highlights the corresponding card in the list panel.
4. Clicking a card pans the map to that pin.
```

### 8.2 Marker Clustering Strategy

For performance at low zoom levels use `@googlemaps/markerclusterer`:
- Zoom ≤ 10: cluster markers (show count bubbles).
- Zoom 11–13: show simplified markers (price label only).
- Zoom ≥ 14: show full card-style info windows.

### 8.3 Debounce Strategy

```js
// useMapBounds.js
const DEBOUNCE_MS = 400;
map.addListener('idle', debounce(() => {
  const bounds = map.getBounds();
  fetchProperties({ bounds, ...filters });
}, DEBOUNCE_MS));
```

**Why 400 ms?** Gives the user time to finish panning without firing redundant requests. Anything above 500 ms starts to feel laggy.

---

## 9. Caching Strategy

| Layer | What to cache | TTL | Tool |
|-------|---------------|-----|------|
| CDN | Property images | 30 days | CloudFront / Cloudinary |
| HTTP cache | `GET /api/plans` (rarely changes) | 1 hour | `Cache-Control: max-age=3600` |
| Server cache | Bounding-box query results | 30 s | Redis (optional at launch) |
| DB query cache | `pg` connection pool | — | pg Pool (already pooled) |

**Redis cache key pattern for property search:**
```
props:{swLat}:{swLng}:{neLat}:{neLng}:{filters_hash}:p{page}
```

Cache is invalidated whenever a new property in that region becomes active.

---

## 10. Scale & Reliability

### 10.1 Load Estimation

| Metric | Estimate |
|--------|----------|
| Properties in DB | 10 M |
| Daily active users | 500 K |
| Peak QPS (reads) | ~2,000 |
| Peak QPS (writes) | ~50 |
| Avg property row size | ~4 KB |
| Total property data | ~40 GB |

A single well-indexed PostgreSQL instance handles this comfortably. Read replicas are added when read QPS exceeds ~5,000.

### 10.2 Scaling Path

```
Phase 1 (now):
  Single Node.js process → Primary PostgreSQL

Phase 2 (> 500K DAU):
  Node.js cluster (PM2) → Read replica for property searches
  Redis for bounding-box cache

Phase 3 (> 2M DAU):
  Kubernetes + horizontal pod autoscaling
  pgBouncer connection pooler
  Separate read replicas per region (Mumbai, Delhi, Bangalore)

Phase 4:
  Extract Pricing/Payments as separate microservices
  Event-driven architecture (Kafka) for subscription events
```

### 10.3 Availability Measures

- Database: automated daily backups with point-in-time recovery (PITR).
- Health check: `GET /api/health` returns `{ status: "ok", db: "connected" }`.
- Circuit breaker around payment gateway calls (to avoid cascading failures).
- Graceful shutdown: `SIGTERM` drains in-flight requests before process exit.

---

## 11. Trade-off Analysis

### 11.1 Monolith vs. Microservices

**Decision: Start monolithic.**

| Factor | Monolith | Microservices |
|--------|----------|---------------|
| Dev speed | Fast | Slow (boilerplate) |
| Operational complexity | Low | High |
| Service boundaries | Loosely enforced | Strictly enforced |
| Good for | < 5 engineers, early stage | Large teams |

The folder structure is already modular, making extraction straightforward later.

### 11.2 PostgreSQL vs. Elasticsearch for Search

**Decision: PostgreSQL + PostGIS first.**

PostGIS handles bounding-box geo queries extremely well. Full-text search (title, description) can be served by `tsvector` columns in Postgres. Elasticsearch is added only if full-text search quality becomes a bottleneck (typically > 50 M listings).

### 11.3 REST vs. GraphQL

**Decision: REST.**

GraphQL's flexibility benefits complex dashboards with many nested queries, but REST is simpler to cache, version, and document at this scale. GraphQL can be added for the dashboard/analytics layer later.

### 11.4 JWT vs. Session Tokens

**Decision: JWT (stateless).**

Enables horizontal scaling without a shared session store. Token expiry is set to 24 h; refresh tokens (7 days) are stored in `httpOnly` cookies.

### 11.5 Image Storage

**Decision: Object storage (S3 / Cloudinary) + CDN.**

Never store images in PostgreSQL. Store only the URL string in the `images[]` column. Clients upload directly to S3 using pre-signed URLs to avoid routing large files through the API server.

---

## 12. What to Revisit as the System Grows

| Trigger | Action |
|---------|--------|
| > 1 M properties | Partition `properties` table by `city` or `state` |
| > 5 K read QPS | Add Redis cache for geo queries; add PG read replicas |
| Slow full-text search | Add `tsvector` column + GIN index; consider Elasticsearch |
| Payment gateway failures | Add outbox pattern (transaction log table) for retries |
| Multiple cities / regions | Shard PostGIS data by geographic zone |
| > 10 engineers | Extract Pricing and Payments into separate services |
| Image upload performance | Switch to direct-to-S3 presigned URL uploads |
| Subscription fraud | Add anomaly detection on quota usage spikes |

---

*This document covers Phases 1–9 of the FindDen build plan. Each subsequent implementation phase should be cross-referenced against the API contracts and schema defined here.*
