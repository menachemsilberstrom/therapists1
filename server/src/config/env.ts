import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
  PORT: z.coerce.number().default(5000),
  // Where uploaded files are stored (relative to the server folder). Contains public/ and private/.
  UPLOADS_DIR: z.string().min(1).default('uploads'),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  // bcrypt work factor for password hashes. 12 is a good production default; tests lower it to stay fast.
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  JWT_EXPIRES_IN: z.string().default('7d'),
  // Web address(es) of the website allowed to call this API (CORS). Several can be given, separated by commas.
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  // Number of reverse proxies in front of the app (0 when running directly, 1 on Render). Needed so that the rate
  // limiter sees each visitor's real IP address instead of the proxy's.
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
