# Nyeri IT Solutions

License and subscription management portal.

## Launch the app

From the project folder, run:

```bash
npm install
npm start
```

Or for development (auto-restarts on file changes):

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

> **Note:** This branch uses SQLite — no database setup required. Requires Node.js 22 or later.

## Seeded demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@nyeriit.com | `Admin@2026!` |
| Admin | jane.kamau@nyeriit.com | `Nyeri@Admin99` |
| Client | peter.mwangi@savannalogistics.co.ke | `Client@2026` |
| Client | grace@kilifintech.co.ke | `Client@2026` |
| Client | ali.hassan@serengeti.co.ke | `Client@2026` |
| Client | fatuma@baobabhealth.co.ke | `Client@2026` |

These are demo credentials. Change them before using the app outside local testing.

---

## MySQL / XAMPP branch (`mysql-xampp`)

This branch replaces SQLite with MySQL, intended for Windows users running XAMPP.

### Prerequisites

- [Node.js](https://nodejs.org) 18 or later
- [XAMPP](https://www.apachefriends.org) with MySQL running

### Setup (one time)

**1. Import the database**

Open phpMyAdmin (`http://localhost/phpmyadmin`), go to **Import**, select `database/init.sql`, and click **Go**. This creates the `nyeri_it` database, all tables, and the seed data.

**2. Configure environment**

Copy `.env.example` to `.env`. The defaults match a stock XAMPP install (root user, no password), so no changes are needed unless you've customised your MySQL credentials.

```bash
copy .env.example .env
```

**3. Install dependencies and seed passwords**

```bash
npm install
npm run seed
```

`npm run seed` writes the bcrypt password hashes for all demo accounts into the database. You only need to run this once.

### Running

```bash
npm start        # production
npm run dev      # development — auto-restarts on file changes
```

Then open [http://localhost:3000](http://localhost:3000).

### Demo accounts

Same credentials as the main branch — see the table above.
