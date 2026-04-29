/**
 * Environment variable validation utility
 * Ensures all required Firebase and database config are present at startup
 */

const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_DATABASE_URL',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
];

const requiredServerEnvVars = [
  'DATABASE_URL',
];

/**
 * Check if a value is valid (not empty, not just whitespace)
 */
function isValidEnvValue(value: string | undefined): boolean {
  return value !== undefined && value !== null && value.trim() !== '' && value !== '""' && value !== "''";
}

/**
 * Validates that all required environment variables are present
 * Call this on app initialization
 */
export function validateEnvVars() {
  const missing: string[] = [];
  const isServer = typeof window === 'undefined';

  // Check client-side vars
  const firebaseConfig = getFirebaseConfig();
  if (!isValidEnvValue(firebaseConfig.apiKey)) missing.push('NEXT_PUBLIC_FIREBASE_API_KEY');
  if (!isValidEnvValue(firebaseConfig.authDomain)) missing.push('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
  if (!isValidEnvValue(firebaseConfig.databaseURL)) missing.push('NEXT_PUBLIC_FIREBASE_DATABASE_URL');
  if (!isValidEnvValue(firebaseConfig.projectId)) missing.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
  if (!isValidEnvValue(firebaseConfig.storageBucket)) missing.push('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET');
  if (!isValidEnvValue(firebaseConfig.messagingSenderId)) missing.push('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID');
  if (!isValidEnvValue(firebaseConfig.appId)) missing.push('NEXT_PUBLIC_FIREBASE_APP_ID');

  // Check server-side vars (only if not in browser)
  if (isServer) {
    if (!isValidEnvValue(process.env.DATABASE_URL)) {
      missing.push('DATABASE_URL');
    }
  }

  if (missing.length > 0) {
    const isDev = process.env.NODE_ENV === 'development';
    
    console.error(
      '❌ Missing required environment variables:',
      missing.join(', ')
    );
    console.error(
      '📝 Please copy .env.example to .env.local and fill in the required values'
    );
    console.error(
      '💡 Environment variables loaded:', 
      Object.keys(process.env).filter(k => k.startsWith('NEXT_PUBLIC_FIREBASE_'))
    );
    
    if (isServer && !isDev) {
      // Server-side production: throw error to prevent app from starting
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}`
      );
    }
  }
}

export function getFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };
}
