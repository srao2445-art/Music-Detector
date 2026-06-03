// Replace these placeholder values with your Firebase web app configuration.
// Firebase Console: Project settings > General > Your apps > Web app.
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Must match the email in firestore.rules and storage.rules before deployment.
export const ADMIN_EMAIL = "admin@simtolite.com";
