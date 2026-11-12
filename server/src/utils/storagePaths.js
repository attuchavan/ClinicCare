import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * True when running inside a read-only serverless container (Vercel / AWS Lambda).
 */
export const isServerlessRuntime = () =>
  Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME);

/**
 * Resolve writable directory for local JSON fallback storage.
 */
export const getDataDir = () => {
  if (process.env.CLINICCARE_DATA_DIR) {
    return path.resolve(process.env.CLINICCARE_DATA_DIR);
  }
  if (isServerlessRuntime()) {
    return path.join(os.tmpdir(), 'cliniccare-data');
  }
  return path.resolve(__dirname, '../../data');
};

/**
 * Resolve writable directory for uploaded medical documents and prescription photos.
 */
export const getUploadsDir = () => {
  if (process.env.CLINICCARE_UPLOADS_DIR) {
    return path.resolve(process.env.CLINICCARE_UPLOADS_DIR);
  }
  if (isServerlessRuntime()) {
    return path.join(os.tmpdir(), 'cliniccare-uploads');
  }
  return path.resolve(__dirname, '../../uploads/documents');
};

/**
 * Safely ensure a directory exists without crashing module initialization on read-only hosts.
 */
export const ensureWritableDir = (dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    return true;
  } catch (err) {
    console.warn(`Directory "${dirPath}" is not writable (${err.code || err.message}); using memory fallback.`);
    return false;
  }
};

