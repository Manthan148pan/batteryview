
import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";

const secondaryFirebaseConfig = {
    apiKey: "AIzaSyDcLlYIAiUcDP13VXsOkZ-LqbpO5NkrmLU",
    authDomain: "esp8266-fd435.firebaseapp.com",
    databaseURL: "https://esp8266-fd435-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "esp8266-fd435",
    storageBucket: "esp8266-fd435.firebasestorage.app",
    messagingSenderId: "524201252677",
    appId: "1:524201252677:web:65dd355dffd4934142902c",
    measurementId: "G-2CFYKF7DPW"
};

let secondaryApp: FirebaseApp | null = null;
let auth: Auth | null = null;

if (typeof window !== 'undefined') {
    const existingApp = getApps().find(app => app.name === 'secondary');
    if (existingApp) {
        secondaryApp = existingApp;
    } else {
        secondaryApp = initializeApp(secondaryFirebaseConfig, 'secondary');
    }
    
    if (secondaryApp) {
        auth = getAuth(secondaryApp);
    }
}

export { auth };
