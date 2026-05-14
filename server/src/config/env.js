import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

export const env = {
  /** Default 5001 so it does not collide with transpak-backend (5000). */
  PORT: Number(process.env.PORT || 5001),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  TRANSPAK_BACKEND_URL: process.env.TRANSPAK_BACKEND_URL || 'http://127.0.0.1:5000'
};
