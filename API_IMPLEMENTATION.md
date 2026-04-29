# API Layer Implementation

## ✅ Created

### Directory Structure
```
src/app/api/
  ├── users/route.ts          # User profile endpoints
  ├── batteries/route.ts       # Battery management endpoints
  ├── telemetry/route.ts       # Telemetry data endpoints
  └── invoices/route.ts        # Invoice management endpoints

src/lib/api/
  ├── auth.ts                 # Authentication & authorization
  ├── error-handler.ts        # Centralized error handling
  ├── validation.ts           # Input validation with Zod
  └── client.ts               # Frontend API client
```

### API Endpoints Created

#### Users
- `GET /api/users` - Get user profile (requires auth)
- `POST /api/users` - Update user profile (requires auth)

#### Batteries
- `GET /api/batteries?status=active&limit=20&offset=0` - List user's batteries
- `POST /api/batteries` - Claim/create new battery

#### Telemetry
- `GET /api/telemetry?batteryId=BAT001&limit=100` - Fetch battery telemetry data with optional time filters

#### Invoices
- `GET /api/invoices?limit=20&offset=0&status=pending` - List user invoices

---

## Features Implemented

### ✅ Error Handling
- Centralized error responses with specific error codes
- Validation error formatting
- Detailed error logging

### ✅ Input Validation
- Using Zod schemas for type-safe validation
- Query parameter validation
- Request body validation
- Helpful error messages

### ✅ Authentication
- Firebase token verification
- Role-based access control setup
- User role fetching

### ✅ Frontend Client
- Simplified API calls with authentication
- Automatic token management
- Consistent error handling

---

## Next Steps

### 1. Setup Firebase Admin SDK
```bash
# Add to .env.local
FIREBASE_ADMIN_SDK_KEY="your-service-account-key"
```

### 2. Connect to Prisma Database
Replace TODO comments in route.ts files with:
```typescript
import prisma from '@/lib/prisma';

// Example:
const user = await prisma.user.findUnique({
  where: { id: auth.uid },
});
```

### 3. Update Frontend Components
Replace direct Firebase calls with API client:
```typescript
// Before:
import { ref, get } from '@/lib/firebase';
const data = await get(ref(db, 'devices'));

// After:
import { userApi } from '@/lib/api/client';
const result = await userApi.getProfile();
```

### 4. Add Middleware for Global Auth
Create `src/middleware.ts` to protect routes at the Next.js level.

### 5. Add Rate Limiting
Install and configure rate limiting middleware.

---

## Testing

### Test Endpoints (requires auth token):
```bash
# Get user profile
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:9002/api/users

# List batteries
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:9002/api/batteries

# Fetch telemetry
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:9002/api/telemetry?batteryId=BAT001&limit=100"
```

---

## Security Notes

- All endpoints require Firebase authentication
- Role-based access control is in place (for ADMIN/MANAGER/SUB_MANAGER)
- Input validation prevents injection attacks
- Error responses don't leak sensitive information
- TODO: Add rate limiting to prevent brute force attacks
- TODO: Add CORS configuration for security
