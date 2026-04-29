/**
 * GET /api/batteries - List user's batteries
 * POST /api/batteries - Create/claim new battery
 * Requires authentication
 */

import { NextRequest } from 'next/server';
import {
  apiSuccess,
  unauthorizedError,
  internalError,
  validationError,
  notFoundError,
  conflictError,
} from '@/lib/api/error-handler';
import { verifyToken } from '@/lib/api/auth';
import {
  validateRequest,
  BatteryQuerySchema,
  ClaimDeviceSchema,
} from '@/lib/api/validation';
import prisma from '@/lib/prisma';

/**
 * GET /api/batteries?status=active&limit=20&offset=0
 * Returns paginated list of user's batteries
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyToken(request);
    if (!auth) {
      return unauthorizedError('Authentication required');
    }

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryData = Object.fromEntries(searchParams);
    const validation = await validateRequest(queryData, BatteryQuerySchema);

    if (!validation.success) {
      return validationError(validation.errors || {});
    }

    // Fetch batteries from Prisma
    const batteries = await prisma.battery.findMany({
      where: {
        userId: auth.uid,
        ...(validation.data.status && { status: validation.data.status }),
      },
      skip: validation.data.offset,
      take: validation.data.limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        assignedQR: true,
        riderId: true,
        createdAt: true,
      },
    });

    // Get total count
    const total = await prisma.battery.count({
      where: {
        userId: auth.uid,
        ...(validation.data.status && { status: validation.data.status }),
      },
    });

    return apiSuccess({
      batteries,
      total,
      limit: validation.data.limit,
      offset: validation.data.offset,
    });
  } catch (error) {
    console.error('Error fetching batteries:', error);
    return internalError('Failed to fetch batteries');
  }
}

/**
 * POST /api/batteries
 * Claims a new battery with device ID
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
    const validation = await validateRequest(body, ClaimDeviceSchema);

    if (!validation.success) {
      return validationError(validation.errors || {});
    }

    const { deviceId, nickname } = validation.data;

    // Check if battery already exists and is claimed by someone else
    const existingBattery = await prisma.battery.findUnique({
      where: { id: deviceId },
    });

    if (existingBattery && existingBattery.userId) {
      return conflictError('This battery is already claimed by another user');
    }

    // Create or update battery record
    const battery = await prisma.battery.upsert({
      where: { id: deviceId },
      update: {
        userId: auth.uid,
        status: 'active',
      },
      create: {
        id: deviceId,
        userId: auth.uid,
        status: 'active',
      },
      select: {
        id: true,
        status: true,
        assignedQR: true,
        createdAt: true,
        userId: true,
      },
    });

    return apiSuccess(battery, 201);
  } catch (error) {
    console.error('Error claiming battery:', error);
    return internalError('Failed to claim battery');
  }
}
