# PropertyAI Backend

NestJS REST API for **PropertyAI** — Real Estate AI Management System.

## Stack

- NestJS
- TypeScript
- REST API
- MongoDB + Mongoose
- `@nestjs/config` — environment configuration
- `@nestjs/throttler` — rate limiting
- `class-validator` / `class-transformer` — DTO validation

## Getting Started

```bash
cp .env.example .env
# Set MONGODB_URI in .env (Atlas or local)
npm install
npm run start:dev
```

Health check: http://localhost:4000/health

## Database collections (Milestone 3)

| Collection | Purpose |
|---|---|
| `users` | Accounts, roles (admin/agent/user) |
| `properties` | Listings with location, price, images |
| `leads` | Pipeline leads, notes, assignment |

CRUD APIs for these models come in later milestones.
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
