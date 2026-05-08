# Bakal Gym Backend

Node.js + Express + MySQL REST API for the Bakal Gym Registration System.

## Deployment on Render

### Important: `.env` is NOT deployed
The `.env` file is excluded by `.gitignore`. You **must** set environment variables in the Render dashboard (Environment tab).

### Option A: Individual Variables
1. Push this folder to GitHub
2. Create a new Web Service on [Render](https://render.com)
3. Connect your GitHub repo
4. Go to **Environment** tab and add:
   - `DB_HOST` - your MySQL host
   - `DB_PORT` - MySQL port (usually 3306)
   - `DB_USER` - MySQL username
   - `DB_PASSWORD` - MySQL password
   - `DB_NAME` - MySQL database name
   - `JWT_SECRET` - a strong secret key
   - `PORT` - 10000 (or let Render auto-assign)
5. Click **Deploy**

### Option B: DATABASE_URL (Recommended)
If your MySQL host provides a connection URL (e.g., Railway), set **only**:
- `DATABASE_URL` - full MySQL connection string (e.g., `mysql://user:pass@host:port/db`)
- `JWT_SECRET` - a strong secret key

SSL is automatically enabled for remote hosts.

## Default Admin Accounts

| Username | Password | Name |
|----------|----------|------|
| admin    | admin123 | System Administrator |
| kent     | kent123  | Kent Dominic Villafuerte |
| ryque    | ryque123 | Ryque Valen Doromal |

## API Endpoints

### Auth
- `POST /api/login` - Login
- `POST /api/register` - Register
- `GET /api/me` - Get current user

### Members (Admin)
- `GET /api/members` - List all members
- `GET /api/members/:id` - Get member detail
- `GET /api/members/counts` - Member statistics
- `PUT /api/members/:id` - Update user profile (self or admin)
- `PUT /api/members/:id/status` - Update user active/inactive status (Admin)
- `DELETE /api/members/:id` - Delete user (Admin)

### Memberships
- `GET /api/membership/status/:userId` - Get membership status
- `GET /api/membership/history/:userId` - Get membership history

### Payments
- `GET /api/payments` - List payments
- `GET /api/payments/total` - Total revenue (Admin)
- `POST /api/payments/create` - Create payment + membership

### Attendance
- `POST /api/attendance/checkin` - Check in
- `GET /api/attendance/user/:userId` - User attendance
- `GET /api/attendance/all` - All attendance (Admin)
- `GET /api/attendance/today` - Today's count (Admin)

### Dashboard
- `GET /api/dashboard` - Admin dashboard stats
