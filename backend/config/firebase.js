const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

// Path ke serviceAccountKey.json
const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');

let firebaseApp;

try {
  // Initialize Firebase Admin
  const serviceAccount = require(serviceAccountPath);
  
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  console.log('✅ Firebase Admin initialized successfully!');
} catch (error) {
  console.error('❌ Firebase Admin initialization failed:', error.message);
  console.error('Make sure serviceAccountKey.json exists in backend folder');
}

const db = admin.firestore();
const auth = admin.auth();

module.exports = { db, auth, admin };