# AlgoVerse

A LeetCode-style competitive coding platform built on the MERN stack.

- **Problems & judging:** solve DSA problems in a Monaco editor; code runs against hidden test cases through Judge0 (C++, Java, JavaScript).
- **AI tutor:** Google Gemini, given the current problem's context, for hints, code review and complexity analysis.
- **Video editorials:** admins upload directly to Cloudinary using signed uploads.
- **1v1 Code Battle:** Socket.IO matchmaking; the server judges final submissions and decides the winner.
- **Collaborative editor:** Monaco edit deltas synced over Socket.IO, room state kept in Redis.
- **Auth:** JWT in httpOnly cookies, Redis token blocklist on logout, user/admin roles.

## Structure

```
backend-coding/   Express 5 API + Socket.IO (MongoDB, Redis, Judge0, Gemini, Cloudinary)
frontend-coding/  React 19 + Vite, Redux Toolkit, Tailwind + DaisyUI
```

## Running locally

```bash
cd backend-coding
cp .env.example .env    # fill in the values
npm install
npm run dev
```

```bash
cd frontend-coding
cp .env.example .env
npm install
npm run dev
```

The frontend runs on http://localhost:5173 and the API on http://localhost:3000.
