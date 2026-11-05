/* ════════════════════════════════════════════════════════════
   OTW — Firebase configuration (Cloud Mode)

   • Leave FIREBASE_CONFIG as null  →  the app runs in LOCAL mode
     (data saved in each browser, exactly as before).

   • Paste your Firebase web-app config here  →  CLOUD mode is
     enabled for everyone: login accounts + one shared, live
     database for the whole team.

   How to get this config: follow CLOUD_SETUP.md (step-by-step).
   It comes from  Firebase Console → Project settings → General
   → "Your apps" → Web app → firebaseConfig.

   Example:
   const FIREBASE_CONFIG = {
     apiKey: "AIzaSy...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abcdef..."
   };

   Note: this config is NOT a secret — it is safe to publish.
   Real security is enforced by firestore.rules + login roles.
   ════════════════════════════════════════════════════════════ */

const FIREBASE_CONFIG = {
     apiKey: "AIzaSyDzqFSuzSc_LV9ozZzp8lsEdSaaDqX4eLQ",
   authDomain: "otw-demo-project.firebaseapp.com",
   projectId: "otw-demo-project",
   storageBucket: "otw-demo-project.firebasestorage.app",
   messagingSenderId: "399606768606",
   appId: "1:399606768606:web:b45291905f8e9288e4b34f",
   measurementId: "G-TC47BB02G2"
};
