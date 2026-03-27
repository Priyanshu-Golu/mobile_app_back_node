# 🤝 Tap2Help Backend API

> **Local Help in One Tap** — REST API for the Tap2Help mobile app.

[![Tests](https://img.shields.io/badge/tests-60%20passed-brightgreen)](./tests) [![Node](https://img.shields.io/badge/node-18%2B-green)](https://nodejs.org) [![MongoDB](https://img.shields.io/badge/database-MongoDB-green)](https://mongodb.com)

---

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Environment Setup](#environment-setup)
- [Base URL & Headers](#base-url--headers)
- [Authentication](#-1-authentication-apiaauth)
- [Users](#-2-users-apiusers)
- [Help Requests](#-3-help-requests-apirequests)
- [Tasks](#-4-tasks-apitasks)
- [Credits](#-5-credits-apicredits)
- [Notifications](#-6-notifications-apinotifications)
- [Reviews](#-7-reviews-apireviews)
- [Chat / Messages](#-8-chat--messages-apimessages)
- [Professionals](#-9-professionals-apiprofessionals)
- [Reports](#-10-reports-apireports)
- [Upload](#-11-upload-apiupload)
- [Admin](#-12-admin-apiadmin)
- [Socket.io Events](#-socketio-real-time-events)
- [Mobile App Integration Guide](#-mobile-app-integration-guide)
- [Error Reference](#-error-reference)

---

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url>
cd tap2help-backend
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your MongoDB URI, JWT secrets, Firebase keys, email config

# 3. Run in development
npm run dev

# 4. Run tests
npm test
```

---

## Environment Setup

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | Secret for access tokens (use 64-char random string) |
| `JWT_REFRESH_SECRET` | ✅ | Secret for refresh tokens |
| `JWT_EXPIRE` | ✅ | Access token expiry e.g. `24h` |
| `JWT_REFRESH_EXPIRE` | ✅ | Refresh token expiry e.g. `7d` |
| `FIREBASE_PROJECT_ID` | ⚡ | Firebase project ID (for push notifications) |
| `FIREBASE_CLIENT_EMAIL` | ⚡ | Firebase service account email |
| `FIREBASE_PRIVATE_KEY` | ⚡ | Firebase private key |
| `EMAIL_HOST` | 📧 | SMTP host e.g. `smtp.gmail.com` |
| `EMAIL_PORT` | 📧 | SMTP port e.g. `587` |
| `EMAIL_USER` | 📧 | SMTP username/email |
| `EMAIL_PASSWORD` | 📧 | SMTP password (App Password for Gmail) |
| `CLIENT_URL` | ✅ | Frontend URL for CORS & password reset links |
| `PORT` | Optional | Server port (default: `5001`) |

**Generate secure secrets:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Base URL & Headers

```
Development: http://localhost:5001
Production:  https://api.tap2help.com
```

**Required Headers:**

| Header | Value | When |
|---|---|---|
| `Content-Type` | `application/json` | All POST/PUT requests |
| `Authorization` | `Bearer <accessToken>` | Protected routes |
| `X-Request-ID` | `<uuid>` | Optional — for request tracing |

**Standard Success Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Standard Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": [ { "field": "email", "message": "Must be a valid email" } ]
  }
}
```

---

## 🔐 1. Authentication `/api/auth`

### `POST /api/auth/register`
Register a new user.

**Request:**
```json
{
  "name": "Rahul Sharma",
  "email": "rahul@example.com",
  "password": "SecurePass1!",
  "phone": "9876543210",
  "role": "user",
  "coordinates": [72.8777, 19.0760],
  "bio": "I love helping my neighbors"
}
```

> `role` options: `user`, `helper`, `professional`  
> `coordinates`: `[longitude, latitude]` — optional at registration, update later via `/api/users/location`

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "name": "Rahul Sharma",
    "email": "rahul@example.com",
    "role": "user",
    "credits": 50,
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses:**
| Code | Status | Description |
|---|---|---|
| `USER_EXISTS` | 409 | Email already registered |
| `VALIDATION_ERROR` | 400 | Invalid input fields |

---

### `POST /api/auth/login`
Login with email and password.

**Request:**
```json
{
  "email": "rahul@example.com",
  "password": "SecurePass1!"
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "name": "Rahul Sharma",
    "email": "rahul@example.com",
    "role": "user",
    "credits": 50,
    "profileImage": null,
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses:**
| Code | Status | Description |
|---|---|---|
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `ACCOUNT_DEACTIVATED` | 401 | Account has been banned |

---

### `GET /api/auth/me` 🔒
Get the currently authenticated user.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "name": "Rahul Sharma",
    "email": "rahul@example.com",
    "phone": "9876543210",
    "role": "user",
    "credits": 50,
    "bio": "I love helping my neighbors",
    "profileImage": "/uploads/profiles/profile-...-123.jpg",
    "skills": ["Plumbing", "Electrical"],
    "isAvailable": true,
    "averageRating": 4.5,
    "totalReviews": 12,
    "location": {
      "type": "Point",
      "coordinates": [72.8777, 19.0760]
    },
    "createdAt": "2026-03-01T10:00:00.000Z"
  }
}
```

---

### `POST /api/auth/refresh-token`
Get a new access token using the refresh token.

**Request:**
```json
{ "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

**Response `200`:**
```json
{ "success": true, "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

---

### `PUT /api/auth/update-password` 🔒
Change the authenticated user's password.

**Request:**
```json
{
  "currentPassword": "OldPass1!",
  "newPassword": "NewPass2@"
}
```

**Response `200`:**
```json
{ "success": true, "message": "Password updated successfully", "accessToken": "..." }
```

---

### `POST /api/auth/fcm-token` 🔒
Register Firebase Cloud Messaging token for push notifications. Call this after login and whenever the FCM token refreshes.

**Request:**
```json
{ "fcmToken": "cTBxYzgtRm9-..." }
```

**Response `200`:**
```json
{ "success": true, "message": "FCM token registered successfully" }
```

---

### `POST /api/auth/forgot-password`
Request a password reset email.

**Request:**
```json
{ "email": "rahul@example.com" }
```

**Response `200`:**
```json
{ "success": true, "message": "If that email is registered, a reset link has been sent." }
```

> ⚠️ Always returns 200 for security (does not reveal if email exists).

---

### `PUT /api/auth/reset-password/:resettoken`
Reset password using the token from the email link.

**Request:**
```json
{ "password": "NewSecurePass1!" }
```

**Response `200`:**
```json
{ "success": true, "message": "Password has been reset successfully" }
```

---

## 👤 2. Users `/api/users`

> All routes require `Authorization: Bearer <token>`

### `GET /api/users/profile` 🔒
Get current user's full profile.

**Response `200`:** _(same shape as GET /api/auth/me)_

---

### `PUT /api/users/profile` 🔒
Update profile fields.

> ⚠️ `role`, `email`, `credits` cannot be changed here.

**Request:**
```json
{
  "name": "Rahul Kumar",
  "bio": "Electrician with 5 years experience",
  "phone": "9876543210",
  "address": "Flat 5, Andheri West, Mumbai",
  "profileImage": "/uploads/profiles/profile-123.jpg"
}
```

**Response `200`:** Updated user object.

---

### `PUT /api/users/skills` 🔒
Set the user's skill tags (used for matching).

**Request:**
```json
{ "skills": ["Plumbing", "Electrical", "Carpentry"] }
```

**Response `200`:** Updated user object with new skills.

---

### `PUT /api/users/location` 🔒
Update user's real-time location. Call this regularly from the mobile app.

**Request:**
```json
{ "coordinates": [72.8777, 19.0760] }
```

> Format: `[longitude, latitude]` — NOT `[lat, lng]`

**Response `200`:** Updated user object.

---

### `PUT /api/users/availability` 🔒
Toggle helper availability (shows/hides from matching engine).

**Request:**
```json
{ "isAvailable": true }
```

**Response `200`:** Updated user object.

---

### `GET /api/users/nearby-helpers` 🔒
Find available helpers near a location.

**Query Params:**
| Param | Type | Default | Description |
|---|---|---|---|
| `lng` | float | required | Longitude |
| `lat` | float | required | Latitude |
| `distance` | int | 5 | Radius in km |
| `skills` | string | — | Comma-separated skills filter e.g. `Plumbing,Electrical` |

**Example Request:**
```
GET /api/users/nearby-helpers?lng=72.8777&lat=19.0760&distance=3&skills=Plumbing
```

**Response `200`:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "_id": "64f1a2b3...",
      "name": "Suresh Electrician",
      "profileImage": "/uploads/profiles/...",
      "averageRating": 4.8,
      "skills": ["Plumbing", "Carpentry"],
      "isAvailable": true,
      "role": "helper",
      "distanceMeters": 450
    }
  ]
}
```

---

### `GET /api/users/:userId` 🔒
Get public profile of another user.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "_id": "64f1a2b3...",
    "name": "Suresh",
    "profileImage": "/uploads/profiles/...",
    "averageRating": 4.5,
    "totalReviews": 20,
    "role": "helper",
    "skills": ["Plumbing"],
    "bio": "Professional plumber",
    "isAvailable": true,
    "createdAt": "2026-01-15T00:00:00.000Z"
  }
}
```

---

### `GET /api/users/:userId/reviews` 🔒
Get paginated reviews for a user.

**Query Params:** `page`, `limit`

**Response `200`:**
```json
{
  "success": true,
  "count": 5,
  "total": 20,
  "page": 1,
  "pages": 4,
  "data": [
    {
      "_id": "...",
      "reviewerId": { "_id": "...", "name": "Rahul", "profileImage": null },
      "rating": 5,
      "comment": "Very helpful and professional!",
      "createdAt": "2026-03-01T10:00:00Z"
    }
  ]
}
```

---

### `DELETE /api/users/account` 🔒
Soft-delete (deactivate) the current user account.

**Response `200`:**
```json
{ "success": true, "message": "Account deactivated successfully" }
```

---

## 📋 3. Help Requests `/api/requests`

### `POST /api/requests` 🔒
Create a new help request. Automatically matches and notifies nearby helpers.

**Request:**
```json
{
  "title": "Need help moving a heavy sofa",
  "description": "My sofa needs to be moved from living room to bedroom, approximately 15 minutes of help needed.",
  "category": "Moving Help",
  "urgency": "Medium",
  "coordinates": [72.8777, 19.0760],
  "address": "Flat 5, Building A, Andheri West, Mumbai",
  "estimatedDuration": 30,
  "creditValue": 15,
  "paymentType": "credits",
  "requiredSkills": [],
  "tags": ["heavy", "indoor"]
}
```

**Field Reference:**
| Field | Values | Required |
|---|---|---|
| `category` | `Moving Help`, `Repair`, `Emergency`, `Delivery`, `Tutoring`, `Groceries`, `Other` | ✅ |
| `urgency` | `Low`, `Medium`, `High`, `Emergency` | ✅ |
| `paymentType` | `credits`, `cash`, `free` | No (default: `credits`) |
| `creditValue` | 5–100 | No (default: 10) |
| `coordinates` | `[lng, lat]` | ✅ |

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d2",
    "requestId": "REQ-123456-ABCD",
    "userId": "64f1a2b3...",
    "title": "Need help moving a heavy sofa",
    "category": "Moving Help",
    "urgency": "Medium",
    "status": "Open",
    "creditValue": 15,
    "paymentType": "credits",
    "location": { "type": "Point", "coordinates": [72.8777, 19.0760] },
    "expiresAt": "2026-03-10T15:00:00.000Z",
    "createdAt": "2026-03-09T15:00:00.000Z"
  }
}
```

---

### `GET /api/requests`
Get all requests with filters and pagination (public).

**Query Params:**
| Param | Description |
|---|---|
| `status` | Filter by: `Open`, `Assigned`, `In Progress`, `Completed`, `Cancelled`, `Expired` |
| `category` | Filter by category |
| `urgency` | Filter by urgency |
| `page` | Page number (default: 1) |
| `limit` | Items per page (default: 10) |
| `sort` | Sort field (default: `-createdAt`) |

**Response `200`:**
```json
{
  "success": true,
  "count": 5,
  "total": 42,
  "page": 1,
  "pages": 9,
  "data": [ { ...request objects... } ]
}
```

---

### `GET /api/requests/my-requests` 🔒
Get all requests created by the authenticated user.

**Query Params:** `status`, `page`, `limit`

---

### `GET /api/requests/nearby` 🔒
Get nearby open requests (for helpers looking for work).

**Query Params:**
| Param | Default | Description |
|---|---|---|
| `lng` | required | Longitude |
| `lat` | required | Latitude |
| `distance` | 5 | Radius in km |
| `category` | — | Filter category |
| `urgency` | — | Filter urgency |
| `page`, `limit` | 1, 10 | Pagination |

**Response `200`:**
```json
{
  "success": true,
  "count": 3,
  "total": 12,
  "data": [
    {
      "_id": "...",
      "title": "Need a ladder",
      "category": "Other",
      "urgency": "Low",
      "creditValue": 10,
      "distanceMeters": 320,
      "userId": { "_id": "...", "name": "Priya", "averageRating": 4.2 }
    }
  ]
}
```

---

### `GET /api/requests/:requestId`
Get a specific request by ID.

**Response `200`:** Full request object with populated user info.

---

### `PUT /api/requests/:requestId` 🔒
Update own request (only when status is `Open`).

**Request:** Any subset of: `title`, `description`, `urgency`, `estimatedDuration`, `address`, `images`

---

### `DELETE /api/requests/:requestId` 🔒
Cancel own request.

**Response `200`:**
```json
{ "success": true, "message": "Request cancelled successfully" }
```

---

## ✅ 4. Tasks `/api/tasks`

> All routes require `Authorization: Bearer <token>`

**Task Status Flow:**
```
Open → Assigned → In Progress → Pending Confirmation → Completed
                                                     ↘ Disputed
```

### `POST /api/tasks/accept/:requestId` 🔒
Helper accepts an open request.

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d3",
    "taskId": "TSK-123456-AB",
    "requestId": "64f1a2b3c4d5e6f7a8b9c0d2",
    "requesterId": "64f1a2b3...",
    "helperId": "64f1a2b3...",
    "status": "Assigned",
    "acceptedAt": "2026-03-09T15:05:00.000Z"
  }
}
```

**Error Responses:**
| Code | Status | Description |
|---|---|---|
| `INVALID_STATE` | 400 | Request already taken |
| `OWN_REQUEST` | 400 | Cannot accept your own request |
| `NOT_FOUND` | 404 | Request not found |

---

### `PUT /api/tasks/:taskId/start` 🔒
Helper starts a task (must be Assigned).

**Response `200`:** Updated task with `status: "In Progress"`, `startedAt`.

---

### `PUT /api/tasks/:taskId/complete` 🔒
Helper marks task as done. Moves to **Pending Confirmation** — requester must confirm.

**Response `200`:**
```json
{
  "success": true,
  "data": { "status": "Pending Confirmation", ... },
  "message": "Task moved to Pending Confirmation"
}
```

> Requester receives a push notification with the 4-digit completion code.

---

### `PUT /api/tasks/:taskId/confirm` 🔒
Requester confirms task completion. Credits are released to the helper.

**Request:** _(completion code is optional but recommended)_
```json
{ "completionCode": "4729" }
```

**Response `200`:**
```json
{
  "success": true,
  "data": { "status": "Completed", ... },
  "creditsAwarded": 15
}
```

---

### `PUT /api/tasks/:taskId/cancel` 🔒
Either party can cancel a task. Helper cancellation penalty applies.

**Request:**
```json
{ "reason": "Something came up" }
```

**Response `200`:** Updated task with `status: "Cancelled"`.

---

### `PUT /api/tasks/:taskId/dispute` 🔒
Raise a dispute on a task. Admin team reviews within 24 hours.

**Request:**
```json
{ "reason": "Helper did not complete the work properly" }
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Dispute raised. Our team will review within 24 hours.",
  "data": { "status": "Disputed", "isDisputed": true, ... }
}
```

---

### `GET /api/tasks/my-tasks` 🔒
Get tasks where you are the helper.

**Query Params:** `status`, `page`, `limit`

---

### `GET /api/tasks/requested` 🔒
Get tasks where you are the requester.

**Query Params:** `status`, `page`, `limit`

---

### `GET /api/tasks/:taskId` 🔒
Get full task details. Only the helper and requester can access.

---

## 💰 5. Credits `/api/credits`

### `GET /api/credits/balance` 🔒
Get current credit balance.

**Response `200`:**
```json
{ "success": true, "credits": 85 }
```

---

### `GET /api/credits/transactions` 🔒
Get paginated transaction history.

**Query Params:** `type` (`Earned`, `Spent`, `Bonus`, `Penalty`), `page`, `limit`

**Response `200`:**
```json
{
  "success": true,
  "count": 5,
  "total": 23,
  "data": [
    {
      "_id": "...",
      "credits": 15,
      "type": "Earned",
      "reason": "Task Completed",
      "balanceAfter": 85,
      "createdAt": "2026-03-09T16:00:00Z"
    }
  ]
}
```

---

### `GET /api/credits/leaderboard`
Get top helpers ranked by credits.

**Query Params:** `limit` (default: 10)

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "name": "Suresh Helper",
      "credits": 850,
      "averageRating": 4.9,
      "totalReviews": 42
    }
  ]
}
```

---

## 🔔 6. Notifications `/api/notifications`

> All routes require `Authorization: Bearer <token>`

### `GET /api/notifications` 🔒
Get paginated notifications.

**Query Params:** `page`, `limit`

**Response `200`:**
```json
{
  "success": true,
  "count": 5,
  "total": 20,
  "unreadCount": 3,
  "data": [
    {
      "_id": "...",
      "type": "NEW_REQUEST",
      "title": "🆕 New Help Request Nearby!",
      "message": "Someone near you needs help: \"Need help moving sofa\".",
      "isRead": false,
      "data": { "requestId": "...", "distance": 450 },
      "createdAt": "2026-03-09T15:00:00Z"
    }
  ]
}
```

**Notification Types:**
| Type | Trigger |
|---|---|
| `NEW_REQUEST` | New request posted near the helper |
| `HELPER_ACCEPTED` | A helper accepted your request |
| `TASK_STARTED` | Helper started the task |
| `TASK_COMPLETED` | Task marked complete, confirmation needed |
| `CREDITS_EARNED` | Credits awarded after task confirmed |
| `TASK_CANCELLED` | Task cancelled by the other party |
| `REMINDER` | Helper reminder for unstarted accepted task |

---

### `GET /api/notifications/unread-count` 🔒

**Response `200`:**
```json
{ "success": true, "unreadCount": 3 }
```

---

### `PUT /api/notifications/:notificationId/read` 🔒
Mark a single notification as read.

---

### `PUT /api/notifications/read-all` 🔒
Mark all notifications as read.

**Response `200`:**
```json
{ "success": true, "updatedCount": 3 }
```

---

### `DELETE /api/notifications/:notificationId` 🔒
Delete a notification.

---

## ⭐ 7. Reviews `/api/reviews`

> All routes require `Authorization: Bearer <token>`

### `POST /api/reviews` 🔒
Submit a review after a task is completed. Both parties can review each other.

**Request:**
```json
{
  "taskId": "64f1a2b3c4d5e6f7a8b9c0d3",
  "rating": 5,
  "comment": "Excellent help! Very professional and on time."
}
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "reviewerId": "...",
    "revieweeId": "...",
    "taskId": "...",
    "rating": 5,
    "comment": "Excellent help!",
    "createdAt": "..."
  }
}
```

**Error Responses:**
| Code | Status | Description |
|---|---|---|
| `NOT_FOUND` | 404 | Task not found |
| `TASK_NOT_COMPLETE` | 400 | Task must be completed before reviewing |
| `ALREADY_REVIEWED` | 409 | Already reviewed this task |
| `NOT_AUTHORIZED` | 403 | Not a party to this task |

---

## 💬 8. Chat / Messages `/api/messages`

> All routes require `Authorization: Bearer <token>`

### `GET /api/messages/:taskId` 🔒
Get chat history for a task.

**Query Params:** `page`, `limit`

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "taskId": "...",
      "senderId": { "_id": "...", "name": "Rahul" },
      "receiverId": "...",
      "message": "I'm on my way!",
      "type": "text",
      "isRead": true,
      "createdAt": "2026-03-09T15:10:00Z"
    }
  ]
}
```

> 💡 **Prefer Socket.io for real-time chat**. Use the REST endpoint to load history on screen open.

---

## 🛠 9. Professionals `/api/professionals`

### `POST /api/professionals/profile` 🔒
Create a professional profile. Automatically upgrades user role to `professional`.

**Request:**
```json
{
  "serviceCategory": "Plumbing",
  "qualifications": "10 years experience, licensed plumber",
  "licenseNumber": "MUM-PLB-12345",
  "serviceRadius": 10,
  "hourlyRate": 500,
  "coordinates": [72.8777, 19.0760]
}
```

**`serviceCategory` options:** `Plumbing`, `Electrical`, `Tutoring`, `Mechanical`, `Carpentry`, `Cleaning`, `Painting`, `IT Support`, `Other`

**Response `201`:** Professional profile object.

---

### `GET /api/professionals/me/profile` 🔒
Get own professional profile.

---

### `PUT /api/professionals/profile` 🔒
Update professional profile.

---

### `GET /api/professionals/nearby`
Find nearby verified professionals.

**Query Params:** `lng`, `lat`, `distance` (km, default: 10), `category`, `page`, `limit`

**Response `200`:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "serviceCategory": "Plumbing",
      "hourlyRate": 500,
      "serviceRadius": 10,
      "isVerified": true,
      "distanceMeters": 1200,
      "userId": {
        "name": "Suresh Plumber",
        "profileImage": "/uploads/profiles/...",
        "averageRating": 4.8
      }
    }
  ]
}
```

---

### `GET /api/professionals/:userId`
Get professional profile by user ID.

---

### `POST /api/professionals/verify` 🔒
Submit profile for admin verification.

**Response `200`:**
```json
{ "success": true, "message": "Verification request submitted. Our team will review within 2-3 business days." }
```

---

## 🚩 10. Reports `/api/reports`

> All routes require `Authorization: Bearer <token>`

### `POST /api/reports` 🔒
Report a user, task, or request for misconduct.

**Request:**
```json
{
  "reportedUserId": "64f1a2b3...",
  "reason": "Fraud",
  "description": "This person never showed up and then asked for credits."
}
```

**`reason` options:** `Spam`, `Harassment`, `Fraud`, `Inappropriate Content`, `No-show`, `Other`

At least one target must be provided: `reportedUserId`, `reportedTaskId`, or `reportedRequestId`.

**Response `201`:** Report object.

---

### `GET /api/reports/my-reports` 🔒
Get reports submitted by the current user.

---

## 📷 11. Upload `/api/upload`

> All routes require `Authorization: Bearer <token>`

**Max file size:** 5MB per file  
**Accepted formats:** JPEG, JPG, PNG, WebP

### `POST /api/upload/profile` 🔒
Upload profile picture.

**Content-Type:** `multipart/form-data`  
**Form field name:** `image`

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "imageUrl": "/uploads/profiles/profile-64f1a2b3-1709999999.jpg",
    "filename": "profile-64f1a2b3-1709999999.jpg"
  }
}
```

> After upload, the `profileImage` field on the user record is automatically updated.

---

### `POST /api/upload/request` 🔒
Upload up to 5 images for a help request.

**Content-Type:** `multipart/form-data`  
**Form field name:** `images` (multiple)

**Response `200`:**
```json
{
  "success": true,
  "count": 3,
  "data": {
    "imageUrls": [
      "/uploads/requests/req-64f1a2b3-1709999999-abc.jpg",
      "/uploads/requests/req-64f1a2b3-1709999999-def.jpg"
    ]
  }
}
```

> Store these URLs in the `images` field when creating/updating a request.

---

## 🛡 12. Admin `/api/admin`

> All routes require `Authorization: Bearer <adminToken>` (user must have `role: "admin"`)

### `GET /api/admin/stats`
Dashboard overview stats.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "users": { "total": 1250 },
    "requests": { "total": 480, "open": 34 },
    "tasks": { "total": 390, "completed": 320 },
    "professionals": { "total": 85 },
    "reports": { "pending": 7 },
    "credits": { "totalTransacted": 45200 }
  }
}
```

---

### `GET /api/admin/users`
List all users with search and filter.

**Query Params:** `role`, `isActive` (true/false), `search` (name/email), `page`, `limit`

---

### `PUT /api/admin/users/:userId/status`
Ban or unban a user.

**Request:**
```json
{ "isActive": false }
```

---

### `GET /api/admin/reports`
List all reports. **Query Params:** `status` (`Pending`, `Resolved`, `Dismissed`), `page`, `limit`

---

### `PUT /api/admin/reports/:reportId/resolve`
Resolve a report.

**Request:**
```json
{ "status": "Resolved", "adminNotes": "User has been warned." }
```

**`status` options:** `Resolved`, `Dismissed`, `Under Review`

---

### `PUT /api/admin/professionals/:userId/verify`
Verify a professional's profile.

**Response `200`:**
```json
{ "success": true, "message": "Professional verified successfully" }
```

---

### `GET /api/admin/tasks`
List all tasks. **Query Params:** `status`, `page`, `limit`

---

## ⚡ Socket.io Real-Time Events

**Connection:**
```javascript
const socket = io('http://localhost:5001', {
  auth: { token: 'Bearer eyJhbGciOi...' }
});
```

### Client → Server Events

| Event | Payload | Description |
|---|---|---|
| `join_task_room` | `taskId` (string) | Join a task's chat room |
| `leave_task_room` | `taskId` (string) | Leave a task's chat room |
| `send_message` | `{ taskId, receiverId, message, type }` | Send a chat message |
| `typing` | `{ taskId }` | Signal typing started |
| `stop_typing` | `{ taskId }` | Signal typing stopped |
| `read_receipt` | `{ messageId, taskId }` | Mark message as read |

### Server → Client Events

| Event | Payload | Description |
|---|---|---|
| `message_received` | Message object | New chat message in a room |
| `typing` | `{ senderId }` | Other user is typing |
| `stop_typing` | `{ senderId }` | Other user stopped typing |
| `read_receipt` | `{ messageId, readerId }` | Message was read |
| `user_online` | `{ userId }` | User came online |
| `user_offline` | `{ userId }` | User went offline |
| `error` | `{ message }` | Socket error |

**Example (React Native):**
```javascript
// Connect
const socket = io(API_BASE_URL, {
  auth: { token: accessToken }
});

// Join task room (after accepting or being accepted)
socket.emit('join_task_room', taskId);

// Send message
socket.emit('send_message', {
  taskId,
  receiverId: otherUserId,
  message: 'I will be there in 10 minutes!',
  type: 'text'
});

// Listen for messages
socket.on('message_received', (msg) => {
  setMessages(prev => [...prev, msg]);
});

// Typing
socket.emit('typing', { taskId });
socket.on('typing', ({ senderId }) => {
  setOtherUserTyping(true);
});
```

---

## 📱 Mobile App Integration Guide

### Architecture Overview

```
Mobile App (React Native / Flutter)
    │
    ├── HTTPS REST API ─── Tap2Help Backend (Node.js + Express)
    │                              │
    └── WebSocket (Socket.io) ─────┤
                                   │
                               MongoDB + Firebase FCM
```

---

### Authentication Flow

```
1. App launches → Check if token stored locally
2. If no token → Show Login/Register screen
3. After login → Store { accessToken, refreshToken } in SecureStorage
4. Every API call → Attach `Authorization: Bearer <accessToken>`
5. If 401 (TOKEN_EXPIRED) → Call POST /api/auth/refresh-token
6. If refresh fails → Clear storage → Show Login screen
```

**React Native (Axios interceptor example):**
```javascript
// api.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const api = axios.create({ baseURL: 'http://localhost:5001/api' });

// Attach token
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh
api.interceptors.response.use(null, async (error) => {
  if (error.response?.status === 401 && error.response?.data?.error?.code === 'TOKEN_EXPIRED') {
    const refreshToken = await AsyncStorage.getItem('refreshToken');
    const res = await axios.post('/api/auth/refresh-token', { refreshToken });
    await AsyncStorage.setItem('accessToken', res.data.accessToken);
    // Retry original request
    error.config.headers.Authorization = `Bearer ${res.data.accessToken}`;
    return axios(error.config);
  }
  return Promise.reject(error);
});

export default api;
```

---

### Push Notifications (Firebase FCM)

```javascript
// After successful login:

import messaging from '@react-native-firebase/messaging';

const registerFCMToken = async (apiToken) => {
  // 1. Request permission
  const authStatus = await messaging().requestPermission();
  
  // 2. Get FCM token
  const fcmToken = await messaging().getToken();
  
  // 3. Send to backend
  await api.post('/auth/fcm-token', { fcmToken }, {
    headers: { Authorization: `Bearer ${apiToken}` }
  });
  
  // 4. Listen for token refresh and re-register
  messaging().onTokenRefresh(async (newToken) => {
    await api.post('/auth/fcm-token', { fcmToken: newToken }, {
      headers: { Authorization: `Bearer ${apiToken}` }
    });
  });
  
  // 5. Handle foreground notifications
  messaging().onMessage(async (remoteMessage) => {
    console.log('Notification received:', remoteMessage.notification);
    // Update notification badge, show in-app alert, etc.
  });
};
```

---

### Location Updates

Send location updates regularly when the app is in foreground:

```javascript
import Geolocation from '@react-native-community/geolocation';

const startLocationTracking = () => {
  Geolocation.watchPosition(
    async (position) => {
      const { longitude, latitude } = position.coords;
      try {
        await api.put('/users/location', {
          coordinates: [longitude, latitude] // [lng, lat]
        });
      } catch (err) {
        console.error('Location update failed:', err);
      }
    },
    (error) => console.error(error),
    { enableHighAccuracy: true, distanceFilter: 100, interval: 60000 }
  );
};
```

---

### Image Upload

```javascript
import { launchImageLibrary } from 'react-native-image-picker';

const uploadProfileImage = async () => {
  const result = await launchImageLibrary({ mediaType: 'photo' });
  if (result.didCancel) return;
  
  const formData = new FormData();
  formData.append('image', {
    uri: result.assets[0].uri,
    type: result.assets[0].type,
    name: result.assets[0].fileName,
  });

  const response = await api.post('/upload/profile', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  
  console.log('Image URL:', response.data.data.imageUrl);
  // The profileImage field is updated automatically on the backend
};
```

---

### Recommended Mobile SDK Libraries

| Purpose | Library |
|---|---|
| HTTP Requests | `axios` |
| Secure Token Storage | `@react-native-async-storage/async-storage` + `react-native-keychain` |
| Push Notifications | `@react-native-firebase/messaging` |
| Location | `@react-native-community/geolocation` or `expo-location` |
| Image Picker | `react-native-image-picker` |
| Real-time | `socket.io-client` |
| Maps | `react-native-maps` |

---

## ❌ Error Reference

### HTTP Status Codes

| Status | Meaning |
|---|---|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request (validation error / invalid state) |
| `401` | Unauthorized (no token / expired token) |
| `403` | Forbidden (wrong role / not your resource) |
| `404` | Not Found |
| `409` | Conflict (duplicate resource) |
| `429` | Too Many Requests (rate limited) |
| `500` | Internal Server Error |

### Error Codes

| Code | Description |
|---|---|
| `VALIDATION_ERROR` | One or more fields failed validation |
| `NOT_AUTHORIZED` | No valid token provided |
| `TOKEN_EXPIRED` | Access token has expired — refresh it |
| `INVALID_TOKEN` | Token is malformed or tampered |
| `ACCOUNT_DEACTIVATED` | User account has been banned |
| `USER_EXISTS` | Email already registered |
| `INVALID_CREDENTIALS` | Wrong email or password |
| `NOT_FOUND` | Resource does not exist |
| `FORBIDDEN` | You don't have permission for this action |
| `INVALID_STATE` | Resource is in wrong state for this operation |
| `OWN_REQUEST` | Cannot perform this action on your own resource |
| `ALREADY_DISPUTED` | Dispute already raised on this task |
| `WRONG_CODE` | Completion code is incorrect |
| `TOO_MANY_REQUESTS` | Rate limit hit — wait before retrying |
| `EMAIL_FAILED` | Server failed to send email |

---

## 🚀 Running in Production

```bash
# Using Docker
docker build -t tap2help-backend .
docker run -p 5001:5001 --env-file .env tap2help-backend

# Or directly
NODE_ENV=production npm start
```

> 📚 **Swagger UI** is available at `/api-docs` when the server is running.

---

## 🧪 Running Tests

```bash
npm test                 # Run all tests
npm run test:coverage    # With coverage report
npm run test:watch       # Watch mode during development
```

Tests use an in-memory MongoDB — no external database needed.
