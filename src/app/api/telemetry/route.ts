/**
 * GET /api/telemetry - Fetch battery telemetry data
 * Requires authentication
 */

import { NextRequest } from 'next/server';
import {
  apiSuccess,
  unauthorizedError,
  internalError,
  validationError,
  forbiddenError,
} from '@/lib/api/error-handler';
import { verifyToken } from '@/lib/api/auth';
import { validateRequest, TelemetryQuerySchema } from '@/lib/api/validation';
import prisma from '@/lib/prisma';

/**
 * GET /api/telemetry?batteryId=BAT001&limit=100&startTime=1234567890&endTime=1234567890
 * Returns paginated telemetry data for a battery
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
    const validation = await validateRequest(queryData, TelemetryQuerySchema);

    if (!validation.success) {
      return validationError(validation.errors || {});
    }

    const { batteryId, limit, startTime, endTime } = validation.data;

    // Verify user owns this battery
    const battery = await prisma.battery.findFirst({
      where: {
        id: batteryId,
        userId: auth.uid,
      },
    });

    if (!battery) {
      return forbiddenError('You do not have access to this battery');
    }

    // Build date filter
    const dateFilter: Record<string, any> = {};
    if (startTime) {
      dateFilter.gte = new Date(startTime * 1000); // Convert from Unix timestamp
    }
    if (endTime) {
      dateFilter.lte = new Date(endTime * 1000);
    }

    // Fetch telemetry from Prisma with optional time filters
    const telemetry = await prisma.telemetry.findMany({
      where: {
        batteryId,
        ...(Object.keys(dateFilter).length > 0 && {
          capturedAt: dateFilter,
        }),
      },
      take: limit,
      orderBy: { capturedAt: 'desc' },
      select: {
        id: true,
        hexData: true,
        soc: true,
        totalVoltage: true,
        current: true,
        faultAlerts: true,
        capturedAt: true,
      },
    });

    return apiSuccess({
      batteryId,
      telemetry,
      count: telemetry.length,
      limit,
    });
  } catch (error) {
    console.error('Error fetching telemetry:', error);
    return internalError('Failed to fetch telemetry data');
  }
}
