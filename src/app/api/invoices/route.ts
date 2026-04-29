/**
 * GET /api/invoices - Fetch user invoices
 * POST /api/invoices/apply-promo - Apply promo code to invoice
 * Requires authentication
 */

import { NextRequest } from 'next/server';
import {
  apiSuccess,
  unauthorizedError,
  internalError,
  validationError,
} from '@/lib/api/error-handler';
import { verifyToken } from '@/lib/api/auth';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { validateRequest } from '@/lib/api/validation';

const InvoiceQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  status: z.enum(['pending', 'paid', 'failed']).optional(),
});

/**
 * GET /api/invoices?limit=20&offset=0&status=pending
 * Returns paginated list of user invoices
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
    const validation = await validateRequest(queryData, InvoiceQuerySchema);

    if (!validation.success) {
      return validationError(validation.errors || {});
    }

    // Fetch invoices from Prisma
    const invoices = await prisma.invoice.findMany({
      where: {
        userId: auth.uid,
        ...(validation.data.status && { status: validation.data.status }),
      },
      include: { promoCode: true },
      skip: validation.data.offset,
      take: validation.data.limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        amountDue: true,
        amountPaid: true,
        billingPeriod: true,
        promoCode: true,
        createdAt: true,
      },
    });

    // Get total count
    const total = await prisma.invoice.count({
      where: {
        userId: auth.uid,
        ...(validation.data.status && { status: validation.data.status }),
      },
    });

    return apiSuccess({
      invoices,
      total,
      limit: validation.data.limit,
      offset: validation.data.offset,
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return internalError('Failed to fetch invoices');
  }
}
