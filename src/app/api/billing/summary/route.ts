
import { NextRequest } from 'next/server';
import {
  apiSuccess,
  unauthorizedError,
  internalError,
} from '@/lib/api/error-handler';
import { verifyToken } from '@/lib/api/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyToken(request);
    if (!auth) {
      return unauthorizedError('Authentication required');
    }

    // 1. Fetch user subscription details
    const user = await prisma.user.findUnique({
      where: { id: auth.uid },
      select: {
        tier: true,
        pricePerUnit: true,
        currentPeriodEnd: true,
      }
    });

    if (!user) {
      return unauthorizedError('User not found');
    }

    // 2. Count active batteries
    const activeBatteryCount = await prisma.battery.count({
      where: {
        userId: auth.uid,
        status: 'active',
      }
    });

    // 3. Calculate financial details
    const pricePerUnit = user.pricePerUnit || 50.0;
    const subtotal = activeBatteryCount * pricePerUnit;
    const gstAmount = subtotal * 0.18;
    const grandTotal = subtotal + gstAmount;

    return apiSuccess({
      activeBatteryCount,
      subscription: {
        tier: user.tier,
        pricePerUnit: pricePerUnit,
        currentPeriodEnd: user.currentPeriodEnd || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
      },
      summary: {
        subtotal,
        gstAmount,
        grandTotal,
      }
    });
  } catch (error) {
    console.error('Error fetching billing summary:', error);
    return internalError('Failed to fetch billing summary');
  }
}
