# StandupPro v11 — KPIT LRT PF26

> Full-hierarchy RBAC standup & productivity tracking for Honda LRT PF26 project teams.

---

## Role Hierarchy

```
STA (Senior Technical Architect)
 └── TA (Technical Architect)
      ├── STL (Senior Test Lead)
      │    ├── TL (Test Lead)
      │    │    └── TE (Test Engineer)
      │    └── TL ...
      └── STL ...
```

| Role    | Assign Tasks | Define Productivity | View Data         |
|---------|:------------:|:-------------------:|-------------------|
| STA     | ✅ Anyone    | ✅ Anyone           | ✅ All employees  |
| Admin   | ✅ Anyone    | ✅ Anyone           | ✅ All employees  |
| TA      | ✅ Anyone    | ✅ STL, TL, TE      | ✅ All employees  |
| Manager | ✅ Own team  | ✅ Own team         | ✅ Own team only  |
| STL     | ❌           | ❌                  | ✅ Own team down  |
| TL      | ❌           | ❌                  | ✅ Own team down  |
| TE      | ❌           | ❌                  | ✅ Own data only  |

---

## Quick Start

```bash
npm install
node seed.js      # seed demo hierarchy + productivity data
node server.js    # runs on http://localhost:3000
```

### Demo Credentials

| Role  | Name            | Employee ID | Password    |
|-------|-----------------|-------------|-------------|
| STA   | Rajesh Kumar    | STA001      | `sta@kpit`  |
| Admin | Admin           | ADM001      | `admin@kpit`|
| TA    | Priya Mehta     | TA001       | `ta@kpit`   |
| STL   | Vikram Desai    | STL001      | `stl@kpit`  |
| STL   | Anita Sharma    | STL002      | `stl@kpit`  |
| TL    | Suresh Nair     | TL001       | `tl@kpit`   |
| TE    | Tejas Bibekar   | TE001       | `te@kpit`   |

---

## Productivity System

Every employee has **3 tracked values per day**:

| Value         | Who Sets It         | Meaning                        |
|---------------|---------------------|--------------------------------|
| **Defined**   | Manager / TA / STA  | The daily target (e.g. 15 TC Dev) |
| **Planned**   | Employee (self)     | What they commit to today      |
| **Actual**    | Employee (self)     | What they actually delivered   |

### Comparison Logic

- 🔴 **Planned < Defined** — flags the gap (e.g. "1 TC Dev below target")
- 🟡 **Planned = Defined** — on target
- 🟢 **Planned > Defined** — exceeds, shows surplus amount
- 🌟 **Actual > both Defined and Planned** — Overachievement banner with exact excess

---

## API Endpoints (v11 additions)

### Productivity

```
POST /api/productivity/define     Manager/TA/STA sets defined target for a user
POST /api/productivity/plan       Employee sets their planned value for today
POST /api/productivity/actual     Employee records end-of-day actual
GET  /api/productivity/me         My today summary (defined/planned/actual + comparisons)
GET  /api/productivity/user/:id   Date-range history for a user (role-scoped)
GET  /api/productivity/team       Full team snapshot for a date (role-scoped)
```

### Auth

```
GET  /api/auth/users      Public user list for login dropdown ⚠️ unauthenticated — enumerates active users/roles by design for the login UX; restrict at network level in production if needed
POST /api/auth/login      Login
POST /api/auth/logout     Logout
GET  /api/auth/me         Current session
PUT  /api/auth/theme      Toggle dark/light
PUT  /api/auth/change-password
```

---

## Stack

- **Backend**: Node.js 18+ / Express 4
- **Database**: SQLite 3 (WAL mode, foreign keys on)
- **Auth**: express-session + bcryptjs (12 rounds)
- **Frontend**: Vanilla JS SPA, Geist font, PWA manifest
- **Security**: CSP headers, rate limiting, session hardening, no stack traces in prod

---

## Environment

Copy `.env.example` → `.env` and set:

```env
SESSION_SECRET=your-long-random-secret
PORT=3000
NODE_ENV=production
```
