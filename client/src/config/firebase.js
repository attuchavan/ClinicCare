import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  browserLocalPersistence,
  setPersistence
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey.trim() !== '' &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId.trim() !== ''
);

let app = null;
let auth = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    // Ensure auth persistence in localStorage
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.warn('Firebase persistence warning:', err.message);
    });
    console.log('🔥 Firebase Client initialized with project:', firebaseConfig.projectId);
  } catch (err) {
    console.warn('⚠️ Firebase Client initialization failed:', err.message);
    auth = null;
  }
} else {
  console.info('ℹ️ Firebase client config not provided in .env. Running in local-compatible authentication mode.');
}

export { app, auth };

/**
 * Sign in using Firebase Email & Password
 * Returns { user, idToken }
 */
export const signInWithFirebase = async (email, password) => {
  if (!isFirebaseConfigured || !auth) {
    throw new Error('Firebase Auth is not configured');
  }
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const idToken = await credential.user.getIdToken(true);
  return {
    firebaseUser: credential.user,
    idToken
  };
};

/**
 * Send password reset email via Firebase
 */
export const sendResetPasswordWithFirebase = async (email) => {
  if (!isFirebaseConfigured || !auth) {
    throw new Error('Firebase Auth is not configured');
  }
  return await sendPasswordResetEmail(auth, email);
};

/**
 * Sign out from Firebase
 */
export const signOutFromFirebase = async () => {
  if (isFirebaseConfigured && auth) {
    await signOut(auth);
  }
};

/**
 * Subscribe to auth state changes
 */
export const subscribeToFirebaseAuthState = (callback) => {
  if (!isFirebaseConfigured || !auth) {
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
};

/**
 * Get fresh ID token for current user
 */
export const getFreshFirebaseIdToken = async () => {
  if (!isFirebaseConfigured || !auth || !auth.currentUser) {
    return null;
  }
  return await auth.currentUser.getIdToken();
};

