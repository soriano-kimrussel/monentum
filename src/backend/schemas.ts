// Input validation for every backend entry point. The UI reuses these with react-hook-form,
// but the backend always re-validates: client-side checks are for UX, not security.
import { z } from 'zod';

import { CATEGORIES } from '../domain/marketplace';
import { isValidDayKey } from '../domain/dates';
import { ApiError } from './core';

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email').max(120);
export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Include a letter')
  .regex(/\d/, 'Include a number');

export const signUpSchema = z.object({
  displayName: z.string().trim().min(1, 'Required').max(40),
  email: emailSchema,
  password: passwordSchema,
  referralCode: z.string().trim().toUpperCase().max(16).optional().or(z.literal('')),
});

export const signInSchema = z.object({ email: emailSchema, password: z.string().min(1, 'Required').max(128) });

const weekday = z.number().int().min(0).max(6);

export const habitInputSchema = z.object({
  name: z.string().trim().min(1, 'Give your habit a name').max(80),
  icon: z.string().min(1).max(32),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  days: z.array(weekday).min(1, 'Pick at least one day').max(7),
  reminderTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM')
    .optional()
    .or(z.literal('')),
});

export const goalInputSchema = z.object({
  title: z.string().trim().min(1, 'Give your goal a title').max(120),
  description: z.string().max(2000),
  targetDate: z
    .string()
    .refine((s) => s === '' || isValidDayKey(s), 'Use YYYY-MM-DD')
    .optional(),
  milestones: z.array(z.string().trim().min(1).max(120)).max(50),
  habitIds: z.array(z.string().max(64)).max(50),
});

export const moodInputSchema = z.object({
  score: z.number().int().min(1).max(5),
  tags: z.array(z.string().trim().min(1).max(24)).max(10),
  note: z.string().max(1000),
});

export const journalInputSchema = z.object({
  title: z.string().trim().max(120),
  body: z.string().trim().min(1, 'Write something first').max(20_000),
  prompt: z.string().max(300).optional(),
  mood: z.number().int().min(1).max(5).optional(),
});

export const listingInputSchema = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500),
  category: z.enum(CATEGORIES),
  priceCents: z.number().int().min(0).max(100_000),
  inventory: z.number().int().min(0).max(100_000),
  icon: z.string().min(1).max(32),
  active: z.boolean(),
});

export const cartSchema = z
  .array(z.object({ listingId: z.string().min(1).max(64), qty: z.number().int().min(1).max(10) }))
  .min(1)
  .max(50);

export const reasonSchema = z.string().trim().min(3, 'Tell us a little more').max(500);

export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) {
    const issue = r.error.issues[0];
    throw new ApiError('invalid_input', `${issue.path.join('.') || 'input'}: ${issue.message}`);
  }
  return r.data;
}
