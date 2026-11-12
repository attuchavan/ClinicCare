import app from '../server/src/app.js';
import { initFirebase } from '../server/src/config/firebase.js';

initFirebase();

export default app;

