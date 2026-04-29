/**
 * API authentication and authorization utilities
 */

import { NextRequest } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin SDK if not already done
function initializeAdmin() {
  if (getApps().length > 0) return;

  if (!process.env.FIREBASE_ADMIN_SDK_KEY) {
    console.error('FIREBASE_ADMIN_SDK_KEY not set. Backend auth will fail.');
    return;
  }

  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK_KEY);
    initializeApp({
      credential: cert(serviceAccount),
    });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error);
  }
}

/**
 * Extract and verify Firebase token from request headers
 */
export async function verifyToken(
  request: NextRequest
): Promise<{ uid: string; email?: string } | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    initializeAdmin();

    // Verify token with Firebase Admin SDK
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

import prisma from '@/lib/prisma';
import type { Role } from '@prisma/client';

export async function getUserRole(
  uid: string
): Promise<Role | null> {
  try {
    const user = await prisma.user.findFirst({
      where: { id: uid },
      select: { role: true }
    });
    return user?.role || null;
  } catch (err) {
    console.error('Failed to fetch user role:', err);
    return null;
  }
}

/**
 * Check if user has required role
 */
export function hasRole(
  userRole: string,
  requiredRoles: string[]
): boolean {
  return requiredRoles.includes(userRole);
}

/**
 * Middleware to require authentication
 */
export function requireAuth() {
  return async (request: NextRequest) => {
    const auth = await verifyToken(request);
    if (!auth) {
      return null;
    }
    return auth;
  };
}

/**
 * Middleware to require specific role
 */
export function requireRole(...roles: string[]) {
  return async (request: NextRequest) => {
    const auth = await verifyToken(request);
    if (!auth) {
      return null;
    }

    const userRole = await getUserRole(auth.uid);
    if (!userRole || !hasRole(userRole, roles)) {
      return null;
    }

    return { ...auth, role: userRole };
  };
}
