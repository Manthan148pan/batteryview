/**
 * GET /api/users/profile - Get current user profile
 * POST /api/users/update - Update user profile
 * Requires authentication
 */

import { NextRequest } from 'next/server';
import {
  apiSuccess,
  unauthorizedError,
  internalError,
  validationError,
  notFoundError,
} from '@/lib/api/error-handler';
import { verifyToken } from '@/lib/api/auth';
import { validateRequest, UserUpdateSchema } from '@/lib/api/validation';
import prisma from '@/lib/prisma';

/**
 * GET /api/users/profile
 * Returns current authenticated user's profile
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyToken(request);
    if (!auth) {
      return unauthorizedError('Authentication required');
    }

    // Fetch user data from Prisma
    const user = await prisma.user.findUnique({
      where: { id: auth.uid },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tier: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return notFoundError('User not found');
    }

    return apiSuccess(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return internalError('Failed to fetch user profile');
  }
}

/**
 * POST /api/users/update
 * Updates user profile
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyToken(request);
    if (!auth) {
      return unauthorizedError('Authentication required');
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = await validateRequest(body, UserUpdateSchema);

    if (!validation.success) {
      return validationError(validation.errors || {});
    }

    // Update user in Prisma
    const updated = await prisma.user.update({
      where: { id: auth.uid },
      data: {
        ...(validation.data.name && { name: validation.data.name }),
        // Email changes typically require verification, so we skip it here
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tier: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return apiSuccess(updated, 200);
  } catch (error) {
    console.error('Error updating user profile:', error);
    return internalError('Failed to update user profile');
  }
}
