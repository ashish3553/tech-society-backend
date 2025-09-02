Below is a suggested **comprehensive project documentation**, suitable for tracking design decisions, onboarding new developers, and serving as an ongoing reference. Feel free to adapt, split into multiple files (e.g. under a `docs/` folder), or prune sections you don’t need.

---

# Tech Society Practice Arena — Project Documentation

---

## 1. Introduction

**Tech Society Practice Arena** is a full-stack web application that allows:

* **Students** to attempt coding assignments, quizzes, and timed tests.
* **Mentors** to author questions, create draft content, dispatch assessments, and review submissions.
* **Admins** to manage users, monitor platform‐wide statistics, and moderate content.

Key features:

* Role-based access control (student / mentor / admin).
* Three assessment **modes**:

  * **Assignment** (date-range, manual or auto-graded MCQ/MSQ, descriptive).
  * **Quiz** (fixed duration, auto-graded).
  * **Test** (fixed duration, auto-graded).
* **Draft** & **resume** flows for students, plus countdown timers for timed modes.
* Real-time **stats**, leaderboards, and per-user profiles.
* Email-based registration verification & password reset.

---

## 2. System Architecture

<p align="center">
  <img src="https://your.cdn/path/architecture-diagram.png" alt="Architecture Diagram" width="600"/>
</p>

1. **Client**

   * React + Vite SPA, styled with Tailwind CSS.
   * React Query for data fetching & cache, Axios for HTTP.
   * Context for Auth (JWT stored in `localStorage`).

2. **Server**

   * Node.js + Express REST API.
   * MongoDB (Atlas) with Mongoose ODM.
   * JWT auth, role‐based middleware, rate limiting, Helmet + CORS.
   * Mailjet for transactional emails.

3. **Deployment**

   * **Server**: Vercel (or Heroku/AWS), environment via `.env`.
   * **Client**: Vercel, Netlify, or similar, with VITE\_API\_URL pointing to backend.

---

## 3. Data Models

### 3.1 User

```js
User {
  _id: ObjectId,
  name: String,
  email: String,          // unique, required
  password: String,       // bcrypt hash
  role: 'student'|'mentor'|'admin',
  branch: String,
  year: Number,
  isActive: Boolean,      // false if deactivated
  isBanned: Boolean,      // toggle login access
  emailVerified: Boolean,
  resetToken?: String,    // for password resets
  createdAt, updatedAt
}
```

### 3.2 Question

```js
Question {
  _id,
  type: 'mcq'|'msq'|'descriptive',
  content: HTML,
  options: [ { id: 'A'|'B'..., text: String } ],  // for MCQ/MSQ
  correctAnswers: ['A',...],
  testCases: [ { input, expect } ],               // coding Qs
  explanation: HTML,
  tags: { topics:[String], difficulty:String },
  creator: ObjectId(User),
  images: [ URL ],
  createdAt, updatedAt
}
```

### 3.3 Assignment

```js
Assignment {
  _id,
  title, description: String,
  questions: [ ObjectId(Question) ],
  mode: 'assignment'|'quiz'|'test',
  visibleToAll: Boolean,
  visibleTo: [ObjectId(User)],
  createdBy: ObjectId(User),
  isDispatched: Boolean,
  dispatchDate: Date,      // when made live
  startDate?: Date,        // for assignments
  dueDate?: Date,          // date-range or quiz/test end
  timeLimitMinutes?: Number, // for quiz/test
  createdAt, updatedAt
}
```

### 3.4 Submission

```js
Submission {
  _id,
  assignment: ObjectId(Assignment),
  student: ObjectId(User),
  answers: [
    { question: ObjectId, response: String|[String] }
  ],
  testCaseResults: [ { testCaseId, passed:Boolean, output:String } ],
  grade: Number|null,
  feedback: String|null,
  isFinal: Boolean,      // `false` = draft, `true` = submitted
  timeTakenMs: Number,   // for timed modes
  submittedAt: Date
}
```

---

## 4. API Reference

*All endpoints under `/api`.*

### 4.1 Authentication

| Method | Path                        | Role   | Description                                |
| :----: | :-------------------------- | :----- | :----------------------------------------- |
|  POST  | `/auth/register`            | Public | Register new user & send verification mail |
|   GET  | `/auth/verify-email/:tok`   | Public | Confirm email                              |
|  POST  | `/auth/login`               | Public | Log in, returns JWT                        |
|  POST  | `/auth/forgot-password`     | Public | Send reset link                            |
|  POST  | `/auth/reset-password/:tok` | Public | Reset password                             |

### 4.2 Users

| Method | Path                  | Role         | Description                               |
| :----: | :-------------------- | :----------- | :---------------------------------------- |
|   GET  | `/users?role=student` | admin,mentor | List users by role (with completed count) |
|   GET  | `/users/:id`          | admin,mentor | Get full profile (submissions + ongoing)  |
|   PUT  | `/users/:id/ban`      | admin        | Ban user                                  |
|   PUT  | `/users/:id/unban`    | admin        | Unban                                     |
|   PUT  | `/users/:id/delete`   | admin        | Soft-delete or deactivate account         |

### 4.3 Questions

*CRUD for mentors/admin.*

* `GET    /questions`
* `POST   /questions`
* `PUT    /questions/:id`
* `DELETE /questions/:id`
* `GET    /questions/:id`

### 4.4 Assignments

| Method | Path                          | Role         | Description                               |
| :----: | :---------------------------- | :----------- | :---------------------------------------- |
|   GET  | `/assignments/me`             | student      | List assignments visible to student       |
|   GET  | `/assignments`                | mentor,admin | List all (draft + dispatched)             |
|  POST  | `/assignments`                | mentor,admin | Create new                                |
|   GET  | `/assignments/:id`            | all (auth)   | Full details (including questions & subs) |
|   PUT  | `/assignments/:id`            | mentor,admin | Update content                            |
|   PUT  | `/assignments/:id/dispatch`   | mentor,admin | Mark live                                 |
|   PUT  | `/assignments/:id/undispatch` | mentor,admin | Revert to draft                           |
| DELETE | `/assignments/:id`            | mentor,admin | Remove                                    |

### 4.5 Submissions

| Method | Path                                      | Role         | Description                    |
| :----: | :---------------------------------------- | :----------- | :----------------------------- |
|   GET  | `/assignments/:id/submission`             | student      | Fetch existing draft or final  |
|  POST  | `/assignments/:id/submit`                 | student      | Save draft / final submit      |
|   GET  | `/assignments/:id/submissions`            | mentor,admin | List all students’ submissions |
|   GET  | `/assignments/:id/submissions/:studentId` | mentor,admin | View one submission            |
|   PUT  | `/assignments/:id/submissions/:studentId` | mentor,admin | Grade / feedback               |

### 4.6 Stats

| Method | Path               | Role         | Description                         |
| :----: | :----------------- | :----------- | :---------------------------------- |
|   GET  | `/stats`           | mentor,admin | Global site analytics               |
|   GET  | `/stats/dashboard` | mentor,admin | Deep dashboard stats + leaderboards |

---

## 5. Frontend Architecture

```
src/
├─ api/            # axios + auth interceptor
├─ components/     # shared UI (StatCard, TopStudentsChart…)
├─ contexts/       # AuthContext: user + loading state
├─ hooks/          # Custom hooks (e.g. useAuthRedirect)
├─ pages/          # Route targets (Login, Dashboards, Forms…)
├─ services/       # wrappers around API calls (optional)
├─ styles/         # global CSS / Tailwind config
└─ main.jsx        # App + router + ReactQueryClient
```

* **AuthContext**

  * On mount: checks `localStorage.token`, calls `/auth/me` to validate, sets `{user,loading}`.
  * Exposes `login()`, `logout()`, `register()`, `refresh()`.

* **Protected Route**

  * Wraps routes; shows spinner on `loading`, redirects if no `user`.

* **Role-based Nav**

  * On `/` it inspects `user.role` and `<Navigate>`s to `/student`, `/mentor`, or `/admin`.

---

## 6. Key User Flows

### 6.1 Student Lifecycle

1. **Registration** → verify email → login.
2. See **Upcoming** cards (locked), **Ongoing** (draft or started), **Pending Review**, **Completed**.
3. **Resume** opens `/assignments/:id/submit`, pre-populates draft answers.
4. **Save Draft** (isFinal=false) → remains in Ongoing.
5. **Submit Final** (isFinal=true) → moves to Completed; auto-grade MCQ/MSQ.
6. **View Answers** shows correct answers + explanations.

### 6.2 Mentor Lifecycle

1. Login → `/mentor`.
2. **Drafts**: create new assignment/quiz/test, pick questions from bank, select students.
3. **Dispatch**: marks draft live; sets dispatchDate. Students see it.
4. **Preview** (Eye icon): full read-only view of content + question explanations.
5. **Review Submissions**: grade descriptive answers, add feedback → marks `grade` & `feedback`.
6. Stats: view how many students attempted, average scores, etc.

### 6.3 Admin Lifecycle

1. Login → `/admin`.
2. **Analytics**: view site-wide stats & top students chart.
3. **Content**: manage drafts & live content (like mentor).
4. **Students** / **Mentors** tabs: search, ban/unban, delete, view profile & activity.
5. **Global Stats**: dispatched vs. draft counts, leaderboards across quizzes/tests.

---

## 7. Environment & Deployment

### 7.1 Server `.env` (example)

```ini
PORT=5000
MONGODB_URI=…
JWT_SECRET=…
CLIENT_URL=https://your.app
MAILJET_API_KEY=…
MAILJET_API_SECRET=…
DEFAULT_FROM_EMAIL=…
CLOUDINARY_CLOUD_NAME=…
CLOUDINARY_API_KEY=…
CLOUDINARY_API_SECRET=…
```

### 7.2 Client `.env`

```ini
VITE_API_URL=https://api.yourapp.com
VITE_BASE_URL=/          # if deployed to sub-path
```

* **CORS**: server `cors({ origin: CLIENT_URL })`
* **Proxy**: Vite `server.proxy['/api'] → VITE_API_URL`
* **Build**

  * Client: `npm run build` → `dist/`
  * Server: `npm run start` (buildless)

---

## 8. Database & Indexing

* **Indexes**

  * `User.email` unique.
  * `Assignment.isDispatched`, `Assignment.mode` for fast stats.
  * `Submission.assignment + student` compound for quick lookup.

* **Scaling**

  * Shard large collections if needed.
  * Archive old submissions.

---

## 9. Security & Rate Limiting

* **Helmet** for common headers
* **express-rate-limit** at 100 req / IP / minute
* **JWT** validation on all protected routes
* **Authorization** middleware for role checks
* **Bcrypt** with salt rounds for passwords
* **CSP**, **XSS** protection via sanitizing `content` if accepting HTML from mentors.

---

## 10. Error Handling & Logging

* **Middleware**

  * `errorHandler` catches thrown errors, logs to console (or external logging).
  * Returns `{ success:false, message, stack }` (stack only in dev).

* **Client**

  * React Query `onError` toasts user errors.
  * Global Axios interceptor for 401 → auto-logout.

---

## 11. Testing Strategy

* **Unit tests**

  * Controllers: mock Mongoose models → ensure correct `res.json`.
  * Auth: test token lifecycles.

* **Integration tests**

  * Supertest against Express server.
  * MongoDB in-memory for isolated runs.

* **E2E**

  * Cypress / Playwright to simulate submission flows.

---

## 12. Contributing Guidelines

* **Branching**: `feature/...`, `bugfix/...`, PR → `develop` → review → merge
* **Linting**: ESLint + Prettier
* **Commit messages**: Conventional Commits (`feat:`, `fix:`, `chore:`)
* **Reviews**: ≥1 approving review, passing tests.

---

## 13. Future Enhancements

* **Real-time** countdown via websockets for synchronized starts.
* **Bulk import** questions/assignments via CSV.
* **Analytics dashboard** with heatmaps & filters.
* **Multi-tenant** support for separate cohorts.
* **Mobile app** / PWA support.

---

> **Tip:** Keep this document versioned alongside your code (in a `docs/` folder), and update it any time the database schema, API shape, or major flows change. A living doc is the best safeguard against “tech debt” and forgotten edge cases down the road.
