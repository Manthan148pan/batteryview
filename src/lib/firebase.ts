
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getDatabase, ref, onValue, set, get, update, query, limitToLast, orderByKey, push, serverTimestamp, orderByChild, remove, Database, off } from "firebase/database";
import { getAuth, Auth } from "firebase/auth";
import { validateEnvVars } from "./env-validation";

// Validate environment variables on app startup
if (typeof window !== 'undefined') {
  validateEnvVars();
}

// Load Firebase config from environment variables
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp | null = null;
let db: Database | null = null;
let auth: Auth | null = null;

if (typeof window !== 'undefined') {
    if (!getApps().length) {
        app = initializeApp(firebaseConfig);
    } else {
        app = getApp();
    }
    if (app) {
        db = getDatabase(app);
        auth = getAuth(app);
    }
}

// Re-export getDatabase to ensure it's always called on the client
export const getClientDatabase = () => {
    if (typeof window === 'undefined') {
        return null;
    }
    if (!db) {
        if (!getApps().length) {
            app = initializeApp(firebaseConfig);
        } else {
            app = getApp();
        }
        if (app) {
           db = getDatabase(app);
        }
    }
    return db;
};


// Function to fetch historical data for a specific device
export const getDeviceHistory = async (deviceId: string, limit = 100) => {
    const db = getClientDatabase();
    if (!db) return null;
    const historyRef = ref(db, `linked_devices/${deviceId}/bms_devices`);
    // Query the last 'limit' number of records, ordered by key (which should be chronological if using push keys or timestamps)
    const historyQuery = query(historyRef, orderByKey(), limitToLast(limit));
    const snapshot = await get(historyQuery);
    if (snapshot.exists()) {
        return snapshot.val();
    }
    return null;
};


export { db, auth, ref, onValue, set, get, update, push, serverTimestamp, query, limitToLast, orderByKey, orderByChild, remove, off };

    