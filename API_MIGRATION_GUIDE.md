# API Layer - Migration Guide

## ✅ What Was Built

Complete backend API layer with:
- ✅ 4 API routes (users, batteries, telemetry, invoices)
- ✅ Authentication with Firebase tokens
- ✅ Input validation with Zod
- ✅ Centralized error handling
- ✅ Prisma database integration
- ✅ Frontend API client

---

## 🔄 Migrating Frontend from Direct Database Access to API

### Before (Direct Firebase Access - ❌ Security Risk)
```typescript
// OLD: Direct Firebase access from client
import { ref, get } from '@/lib/firebase';
import { getClientDatabase } from '@/lib/firebase';

const fetchBatteries = async () => {
  const db = getClientDatabase();
  const batteryRef = ref(db, `linked_devices/${userId}/devices`);
  const snapshot = await get(batteryRef);
  return snapshot.val();
};
```

### After (Via API - ✅ Secure)
```typescript
// NEW: Use API client
import { batteryApi } from '@/lib/api/client';

const fetchBatteries = async () => {
  const result = await batteryApi.list({ limit: 20, offset: 0 });
  if (result.success) {
    return result.data.batteries;
  } else {
    console.error(result.error?.message);
  }
};
```

---

## 📋 API Endpoints Reference

### Users
```
GET  /api/users              → Get current user profile
POST /api/users              → Update user profile
```

**Example Usage:**
```typescript
import { userApi } from '@/lib/api/client';

// Get profile
const profile = await userApi.getProfile();

// Update profile
const updated = await userApi.updateProfile({
  name: 'New Name'
});
```

### Batteries
```
GET  /api/batteries?status=active&limit=20&offset=0    → List user batteries
POST /api/batteries                                      → Claim new battery
```

**Example Usage:**
```typescript
import { batteryApi } from '@/lib/api/client';

// List batteries
const result = await batteryApi.list({
  status: 'active',
  limit: 20,
  offset: 0
});

// Claim battery
const claimed = await batteryApi.claim({
  deviceId: 'MAC_ADDRESS',
  nickname: 'My Battery'
});
```

### Telemetry
```
GET /api/telemetry?batteryId=BAT001&limit=100&startTime=1234567890&endTime=1234567890
```

**Example Usage:**
```typescript
import { telemetryApi } from '@/lib/api/client';

// Fetch telemetry data
const result = await telemetryApi.fetch({
  batteryId: 'BAT001',
  limit: 100,
  startTime: Math.floor(Date.now() / 1000) - 86400, // Last 24 hours
  endTime: Math.floor(Date.now() / 1000)
});

if (result.success) {
  console.log(result.data.telemetry);
}
```

### Invoices
```
GET /api/invoices?limit=20&offset=0&status=pending
```

**Example Usage:**
```typescript
import { invoiceApi } from '@/lib/api/client';

const result = await invoiceApi.list({
  limit: 20,
  offset: 0,
  status: 'pending'
});
```

---

## 🔄 Error Handling

All API responses follow a consistent format:

### Success Response
```typescript
{
  success: true,
  data: { /* response data */ }
}
```

### Error Response
```typescript
{
  success: false,
  error: {
    code: 'UNAUTHORIZED' | 'VALIDATION_ERROR' | 'NOT_FOUND' | etc,
    message: 'Human readable error message',
    details?: { /* additional info */ }
  }
}
```

**Usage:**
```typescript
const result = await batteryApi.list();

if (result.success) {
  console.log('Batteries:', result.data.batteries);
} else {
  console.error('Error:', result.error.message);
  
  if (result.error.code === 'UNAUTHORIZED') {
    // Handle login
  } else if (result.error.code === 'VALIDATION_ERROR') {
    console.error('Validation errors:', result.error.details?.errors);
  }
}
```

---

## 🚀 Example: Updating a Component

### Dashboard Component Migration

**Before (❌ Direct Firebase):**
```typescript
'use client';
import { useEffect, useState } from 'react';
import { ref, get, onValue } from '@/lib/firebase';
import { getClientDatabase } from '@/lib/firebase';

export default function Dashboard() {
  const [batteries, setBatteries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getClientDatabase();
    const batteryRef = ref(db, `linked_devices/${userId}/devices`);
    
    onValue(batteryRef, (snapshot) => {
      setBatteries(snapshot.val() || []);
      setLoading(false);
    });
  }, [userId]);

  return <div>{/* render */}</div>;
}
```

**After (✅ Via API):**
```typescript
'use client';
import { useEffect, useState } from 'react';
import { batteryApi } from '@/lib/api/client';

export default function Dashboard() {
  const [batteries, setBatteries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBatteries = async () => {
      try {
        const result = await batteryApi.list({ limit: 50 });
        
        if (result.success) {
          setBatteries(result.data.batteries);
        } else {
          setError(result.error?.message || 'Failed to load batteries');
        }
      } catch (err) {
        setError('Unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchBatteries();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return <div>{/* render */}</div>;
}
```

---

## 🔐 Authentication

The API client automatically handles authentication:

1. **Automatic Token Extraction**: Pulls Firebase ID token from current user
2. **Token Expiration**: Handled automatically by Firebase
3. **Token Refresh**: Firebase refreshes automatically when needed

**No manual token management needed!**

---

## ✅ Next Steps

### 1. Test API Endpoints
```bash
# In browser console (when logged in)
const token = await firebase.auth().currentUser?.getIdToken();
fetch('/api/users', {
  headers: { 'Authorization': `Bearer ${token}` }
})
```

### 2. Update Components Gradually
- Start with least critical components
- Move data fetching from Firebase to API client
- Test thoroughly after each component

### 3. Remove Direct Firebase Access
Once all components migrated, remove direct Firebase read access from frontend (keep only for auth)

### 4. Add More API Routes as Needed
- Promo code validation
- Device settings updates
- Admin endpoints

---

## 🛡️ Security Benefits

✅ **Server-Side Validation** - Input validated on backend before database access  
✅ **Access Control** - Users can only access their own data  
✅ **Error Hiding** - Stack traces not exposed to client  
✅ **Centralized Logic** - Easier to audit and maintain  
✅ **Rate Limiting Ready** - Can be added to API routes easily  
✅ **Audit Logging** - Can log all data access  

---

## ⚙️ Configuration Needed

### Firebase Admin SDK
```bash
# Get service account key from Firebase Console
# Project Settings → Service Accounts → Generate new private key

# Add to .env.local
FIREBASE_ADMIN_SDK_KEY='{"type":"service_account","project_id":"...",...}'
```

### CORS (Optional, for mobile apps)
Create `src/middleware.ts`:
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Add CORS headers if needed
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
```

---

## 📊 API Status Codes

| Code | Meaning |
|------|---------|
| 200  | Success |
| 201  | Created |
| 400  | Validation Error |
| 401  | Unauthorized (missing/invalid token) |
| 403  | Forbidden (no access to resource) |
| 404  | Not Found |
| 409  | Conflict (duplicate resource) |
| 429  | Rate Limited |
| 500  | Server Error |

---

## 🎯 Migration Checklist

- [ ] Test API endpoints manually
- [ ] Update dashboard component to use API
- [ ] Update battery list component
- [ ] Update telemetry/history component
- [ ] Update user settings component
- [ ] Update invoice/billing component
- [ ] Remove direct Firebase read access
- [ ] Test all features work via API
- [ ] Deploy to production
