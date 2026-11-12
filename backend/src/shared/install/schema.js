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
