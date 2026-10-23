/**
 * Helper Modular untuk Firestore onSnapshot Realtime Listener
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// --- KONFIGURASI FIREBASE KAMU ---
const firebaseConfig = {
    apiKey: "AIzaSyC3IqNlcGVZBTNdeDhRq57LBHxCLpwplXc",
    authDomain: "phising-5317b.firebaseapp.com",
    databaseURL: "https://phising-5317b.firebaseio.com",
    projectId: "phising-5317b",
    storageBucket: "phising-5317b.firebasestorage.app",
    messagingSenderId: "877220268081",
    appId: "1:877220268081:web:4bd84cc4b7ef0d15752d10",
    measurementId: "G-W0GD5R7K7V"
};

// Inisialisasi otomatis saat modul dipanggil
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Mendengarkan perubahan data dokumen secara realtime menggunakan onSnapshot
 * @param {string} collectionName - Nama koleksi Firestore (misal: 'transactions')
 * @param {string} documentId - ID dokumen / Order ID
 * @param {Function} onUpdate - Callback saat data berubah
 * @param {Function} onError - Callback jika terjadi error
 * @returns {Function} - Fungsi unsubscription untuk menghentikan listener
 */
export function listenToDocumentChanges(collectionName, documentId, onUpdate, onError) {
    if (!db) {
        console.error("Database Firestore belum diinisialisasi!");
        return null;
    }

    const docRef = doc(db, collectionName, documentId);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            onUpdate(data, docSnap.id);
        } else {
            console.warn(`Dokumen ${documentId} tidak ditemukan di koleksi ${collectionName}.`);
        }
    }, (error) => {
        console.error("Error pada Firestore onSnapshot:", error);
        if (onError) onError(error);
    });

    return unsubscribe;
}
