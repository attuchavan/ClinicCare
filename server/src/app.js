import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/authRoutes.js';
import patientRoutes from './routes/patientRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import consultationRoutes from './routes/consultationRoutes.js';
import prescriptionRoutes from './routes/prescriptionRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import billingRoutes from './routes/billingRoutes.js';
import followUpRoutes from './routes/followUpRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import ocrRoutes from './routes/ocrRoutes.js';
import clinicRoutes from './routes/clinicRoutes.js';

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  credentials: true
}));

// Request rate limiting
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this client. Please try again later.' }
});
app.use('/api', limiter);

// Request body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'ClinicCare Digital Clinic Management System',
    timestamp: new Date().toISOString(),
    uptimeSeconds: process.uptime()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/followups', followUpRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/clinic', clinicRoutes);

// 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `API route ${req.originalUrl} not found` });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err.message);
  const isValidationUploadErr =
    err.name === 'MulterError' ||
    (typeof err.message === 'string' && err.message.startsWith('Invalid file type'));
  const status = err.status || (isValidationUploadErr ? 400 : 500);
  const errorMsg =
    err.code === 'LIMIT_FILE_SIZE'
      ? 'Uploaded file exceeds the 15 MB size limit.'
      : err.message || 'An unexpected internal error occurred';

  res.status(status).json({
    error: errorMsg,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

export default app;

