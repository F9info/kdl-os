import { z } from 'zod';
import { APP_TYPE_KEYS } from './app-types.js';

const logoPath = z.string().trim().min(1, 'Company logo is required').max(500).regex(/^identity\/[A-Za-z0-9-]+\.(png|jpg|webp)$/, 'Upload the logo again');
export const companySchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1, 'Company name is required').max(100),
      phone: z.string().trim().max(30).default(''),
      email: z
        .string()
        .trim()
        .max(150)
        .refine((v) => v === '' || z.string().email().safeParse(v).success, { message: 'Enter a valid email address' })
        .default(''),
      logo_path: logoPath,
    })
    .strict(),
});
export const typeSchema = z.object({ body: z.object({ app_type: z.enum(APP_TYPE_KEYS) }).strict() });

// Installer admin account: same password rule as the app (12+ characters, 72 bytes at most: bcrypt truncates).
const adminPassword = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'Password must be at most 72 bytes');
export const adminSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2, 'Enter the admin name').max(100),
      email: z.string().trim().toLowerCase().max(150).email('Enter a valid email address'),
      password: adminPassword,
      confirm_password: z.string(),
    })
    .strict()
    .refine((b) => b.password === b.confirm_password, { message: 'Passwords do not match', path: ['confirm_password'] }),
});

// Modules step: optional extras on top of the type, and the sample-content answer.
export const modulesSchema = z.object({
  body: z
    .object({
      modules: z.array(z.string().regex(/^[a-z0-9-]+$/).max(60)).max(60).default([]),
      demo: z.boolean().optional(),
    })
    .strict(),
});
