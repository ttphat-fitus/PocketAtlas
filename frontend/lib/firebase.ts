import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Check if Firebase config is properly set
const isConfigured = 
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== 'your-firebase-api-key' &&
  firebaseConfig.projectId &&
  firebaseConfig.appId &&
  firebaseConfig.appId !== 'your-firebase-app-id';

if (!isConfigured && typeof window !== 'undefined') {
  console.error(
    '❌ Firebase is not configured properly!\n\n' +
    'Please follow these steps:\n' +
    '1. Go to Firebase Console: https://console.firebase.google.com\n' +
    '2. Select project: pocketatlas-0606\n' +
    '3. Go to Project Settings > General\n' +
    '4. Scroll to "Your apps" and select the Web app\n' +
    '5. Copy the config values\n' +
    '6. Update frontend/.env.local with the correct values\n' +
    '7. Restart the dev server (npm run dev)\n\n' +
    'See FIREBASE_SETUP.md for detailed instructions.'
  );
}

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (!getApps().length && isConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} else if (getApps().length) {
  app = getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
} else {
  // Create a dummy app for development without crashing
  console.warn('⚠️  Running without Firebase - authentication will not work');
  app = {} as FirebaseApp;
  auth = {} as Auth;
  db = {} as Firestore;
}

// Helper function to get ID token
export async function getIdToken(): Promise<string> {
  if (!auth.currentUser) {
    throw new Error("No authenticated user");
  }
  return await auth.currentUser.getIdToken();
}

export { app, auth, db, isConfigured };
