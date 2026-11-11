import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import { initFirebase } from './config/firebase.js';

const PORT = process.env.PORT || 5000;

// Initialize Firebase Admin SDK
initFirebase();

const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🏥 ClinicCare Backend Server running on port ${PORT}`);
  console.log(`🩺 Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Base URL: http://localhost:${PORT}`);
  console.log(`🩺 Health check: http://localhost:${PORT}/api/health`);
  console.log(`====================================================`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Closing HTTP server...');
  server.close(() => {
    console.log('HTTP server closed.');
  });
});

