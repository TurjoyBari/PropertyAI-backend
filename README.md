# PropertyAI Backend

NestJS REST API for **PropertyAI** — Real Estate AI Management System.

## Stack

- NestJS + TypeScript
- MongoDB + Mongoose
- Better Auth (email/password, Google OAuth ready, JWT, bearer, RBAC)
- `@nestjs/config`, `@nestjs/throttler`, `class-validator`

## Getting Started

```bash
cp .env.example .env
# Set MONGODB_URI and BETTER_AUTH_SECRET (32+ random chars)
npm install
npm run dev
```

- Health: http://localhost:4000/health
- Auth base: http://localhost:4000/api/auth
- Auth route map: http://localhost:4000/users/auth-info

## Authentication (Milestone 4)

| Endpoint | Description |
|---|---|
| `POST /api/auth/sign-up/email` | Register |
| `POST /api/auth/sign-in/email` | Login (HTTP-only session cookie) |
| `POST /api/auth/sign-out` | Logout |
| `GET /api/auth/get-session` | Current session |
| `POST /api/auth/request-password-reset` | Forgot password |
| `POST /api/auth/reset-password` | Reset password with token |
| `GET /api/auth/verify-email` | Email verification |
| `POST /api/auth/sign-in/social` | Google OAuth (`provider: "google"`) when env keys set |
| `GET /api/auth/token` | JWT access token |
| `GET /api/auth/jwks` | JWKS for JWT verification |
| `GET /users/me` | Protected profile (session required) |
| `GET /users/admin-check` | Admin-only RBAC demo |
| `GET /users/staff-check` | Admin/Agent RBAC demo |
| `GET /api/dashboard/stats` | Protected dashboard KPIs/charts/notifications |
| `GET /api/properties` | List/search/filter properties |
| `POST /api/properties` | Create property |
| `GET /api/properties/:id` | Property detail |
| `PATCH /api/properties/:id` | Update property |
| `DELETE /api/properties/:id` | Soft-delete property |
| `GET /api/leads` | List/search/filter leads |
| `POST /api/leads` | Create lead |
| `GET /api/leads/:id` | Lead detail |
| `PATCH /api/leads/:id` | Update lead |
| `DELETE /api/leads/:id` | Soft-delete lead |
| `POST /api/leads/:id/notes` | Add lead note |
| `GET /api/visits` | List visits (supports `from`/`to` date range) |
| `POST /api/visits` | Schedule a site visit |
| `GET /api/visits/:id` | Visit detail |
| `PATCH /api/visits/:id` | Update visit |
| `DELETE /api/visits/:id` | Soft-delete / cancel visit |
| `GET /api/reports/summary` | Revenue, sales, sources, agent performance |
| `POST /api/uploads/images` | Multipart property image upload |
| `GET /api/notifications` | In-app notification inbox |
| `POST /api/notifications/send` | Send in-app / email / WhatsApp |
| `PATCH /api/notifications/:id/read` | Mark notification read |
| `GET /api/ai/status` | Gemini configuration status |
| `POST /api/ai/match-properties` | AI property matching |
| `POST /api/ai/score-lead` | AI lead scoring (+ updates lead) |
| `POST /api/ai/chat` | Text sales agent (Gemini) |
| `GET /api/public/properties` | Public listings |
| `POST /api/public/inquiries` | Public contact → lead (+ auto score) |
| `POST /api/public/match-properties` | Public AI matching |
| `GET/POST/DELETE /api/favorites` | Customer saved properties |
| `GET/POST /api/messages` | Customer ↔ agent messages |
| `GET /api/admin/users` | Admin user list |
| `PATCH /api/admin/users/:id/role` | Admin role update |

Sessions use **HTTP-only cookies**. JWT access tokens expire in **15 minutes**. Google login activates when both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.

Password reset / verification emails are **logged to the server console** until an email provider is wired.

## Database collections

| Collection | Purpose |
|---|---|
| Better Auth: `user`, `session`, `account`, `verification`, `jwks` | Auth source of truth |
| `users` / `properties` / `leads` / `visits` / `notifications` | App domain models |

## API response shape

Success:

```json
{
  "success": true,
  "data": {},
  "timestamp": "2026-07-18T00:00:00.000Z"
}
```

Error:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "...",
  "path": "/example",
  "timestamp": "2026-07-18T00:00:00.000Z"
}
```

## Related

Frontend repository: [PropertyAI-frontend](https://github.com/TurjoyBari/PropertyAI-frontend)
