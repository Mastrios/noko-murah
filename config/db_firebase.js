// src/services/firebaseService.js
require('dotenv').config();
const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getDatabase } = require('firebase-admin/database');

// ============================================
// 🔐 DECODE CREDENTIALS FROM BASE64
// ============================================

// Untuk keamanan, credentials disimpan di .env sebagai BASE64
// Cara generate: base64 -w 0 firebase-credentials.json
const credentialsUsers = JSON.parse(Buffer.from(process.env.CREDENTIALS_FIREBASE, "base64").toString('utf8'));


// ============================================
// 🚀 INITIALIZE FIREBASE APPS
// ============================================

// 1️⃣ Firebase App untuk Users (Primary)
const usersApp = admin.initializeApp({
  credential: admin.cert(credentialsUsers),
  databaseURL: process.env.DATABASE_URL_FIREBASE,
}, "usersApp");

// 2️⃣ Optional: Firebase App untuk Admin (jika terpisah)
// const adminApp = admin.initializeApp({
//     credential: admin.cert(credentialsAdmin),
//     databaseURL: process.env.FIREBASE_DATABASE_URL_ADMIN,
// }, "adminApp");

// ============================================
// 📦 EXPORT SERVICES
// ============================================

// 🔹 Firestore untuk Users
const firestore = getFirestore(usersApp);

// 🔹 Realtime Database untuk Users
const realtimeUsers = getDatabase(usersApp);


// 🔹 Storage (opsional)
// const storage = admin.storage(usersApp);

module.exports = {
    // Core Firebase
    admin,
    usersApp,
    
    // Firestore
    firestore,
    db: firestore, // alias
    
    // Realtime Database
    realtimeUsers,
    rtdb: realtimeUsers, // alias
    

    // FieldValue utilities
    FieldValue,
    deleteField: FieldValue.delete,
    increment: FieldValue.increment,
    arrayUnion: FieldValue.arrayUnion,
    arrayRemove: FieldValue.arrayRemove,
    serverTimestamp: FieldValue.serverTimestamp,
};