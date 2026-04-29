/**
 * Input validation utilities using Zod
 */

import { z } from 'zod';

// Device-related schemas
export const ClaimDeviceSchema = z.object({
  deviceId: z.string().min(1, 'Device ID is required').max(50),
  nickname: z.string().min(1, 'Nickname is required').max(100).optional(),
});

export const UpdateDeviceSchema = z.object({
  nickname: z.string().max(100).optional(),
  status: z.enum(['active', 'archived']).optional(),
});

// Battery-related schemas
export const BatteryQuerySchema = z.object({
  status: z.enum(['active', 'archived']).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

// Telemetry schemas
export const TelemetryQuerySchema = z.object({
  batteryId: z.string().min(1),
  limit: z.coerce.number().min(1).max(1000).default(100),
  startTime: z.coerce.number().optional(),
  endTime: z.coerce.number().optional(),
});

// User-related schemas
export const UserUpdateSchema = z.object({
  name: z.string().max(100).optional(),
  email: z.string().email().optional(),
});

// Promo code schemas
export const PromoCodeSchema = z.object({
  code: z.string().min(1).max(50),
});

// Validation error formatter
export function formatValidationErrors(error: z.ZodError) {
  return error.errors.reduce(
    (acc, err) => {
      const path = err.path.join('.');
      acc[path] = [...(acc[path] || []), err.message];
      return acc;
    },
    {} as Record<string, string[]>
  );
}

// Generic validation wrapper
export async function validateRequest<T>(
  data: unknown,
  schema: z.ZodSchema<T>
): Promise<{ success: boolean; data?: T; errors?: Record<string, string[]> }> {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: formatValidationErrors(error),
      };
    }
    return {
      success: false,
      errors: { _error: ['Validation failed'] },
    };
  }
}
