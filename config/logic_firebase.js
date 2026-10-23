// src/config/db_firebase.js
const { firestore } = require('./db_firebase');

//HELPER
// Definisikan di luar fungsi agar tidak dibuat ulang pada setiap pemanggilan (lebih efisien)
const GLOBAL_COLLECTIONS = new Set([
  "settings",
  "notifications"
]);

function getColl(collectionName) {
  // Cek apakah collection masuk dalam daftar global (mengabaikan prefix sandbox)
  if (GLOBAL_COLLECTIONS.has(collectionName)) {
    return collectionName;
  }
  
  // Tentukan prefix berdasarkan environment
  const isProduction = process.env.NODE_ENV === "production";
  const prefix = isProduction ? "" : "sbx_";
  
  return `${prefix}${collectionName}`;
}

class FirestoreService {
  
    // ============================================
    // 📖 READ
    // ============================================

    async get(collectionName, id) {
        try {
            const docSnap = await firestore.collection(getColl(collectionName)).doc(id).get();
            if (!docSnap.exists) return null;
            return { id: docSnap.id, ...docSnap.data() };
        } catch (error) {
            throw error;
        }
    }
    async getByField(collectionName, fieldName, value) {
    try {
        // Gunakan .where() untuk mencari dokumen berdasarkan isi field, bukan ID dokumen
        const querySnapshot = await firestore.collection(getColl(collectionName))
            .where(fieldName, '==', value)
            .get();

        // Jika tidak ada dokumen yang cocok
        if (querySnapshot.empty) {
            return null; 
        }

        // Karena query bisa mengembalikan banyak dokumen, 
        // kita ambil dokumen pertama yang cocok (.docs[0])
        const docSnap = querySnapshot.docs[0];
        
        // Mengembalikan ID dokumen asli beserta seluruh isi datanya
        return { documentId: docSnap.id, ...docSnap.data() };
    } catch (error) {
        throw error;
    }
}

    async getAll(collectionName, options = {}) {
    try {
        let query = firestore.collection(getColl(collectionName));
        if (options.orderBy) {
            query = query.orderBy(options.orderBy, options.orderDirection || 'asc');
        }
        if (options.limit) {
            query = query.limit(options.limit);
        }
        // Tambahkan dukungan offset di sini
        if (options.offset) {
            query = query.offset(options.offset);
        }
        const snapshot = await query.get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        throw error;
    }
}


    async query(collectionName, filters = [], options = {}) {
        try {
            let query = firestore.collection(getColl(collectionName));
            filters.forEach(filter => {
                if (filter.field && filter.operator && filter.value !== undefined) {
                    query = query.where(filter.field, filter.operator, filter.value);
                }
            });
            if (options.orderBy) {
                query = query.orderBy(options.orderBy, options.orderDirection || 'asc');
            }
            if (options.limit) {
                query = query.limit(options.limit);
            }
            const snapshot = await query.get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            throw error;
        }
    }

    async count(collectionName, filters = []) {
        try {
            let query = firestore.collection(getColl(collectionName));
            filters.forEach(filter => {
                if (filter.field && filter.operator && filter.value !== undefined) {
                    query = query.where(filter.field, filter.operator, filter.value);
                }
            });
            const snapshot = await query.count().get();
            return snapshot.data().count || 0;
        } catch (error) {
            return 0;
        }
    }

    // ============================================
    // ✍️ WRITE
    // ============================================

    async add(collectionName, data) {
        try {
            const docRef = await firestore.collection(getColl(collectionName)).add({
                ...data,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            return docRef.id;
        } catch (error) {
            throw error;
        }
    }

    async set(collectionName, id, data) {
        try {
            await firestore.collection(getColl(collectionName)).doc(id).set({
                ...data,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },{ merge : true });
            return true;
        } catch (error) {
            throw error;
        }
    }

    async update(collectionName, id, data) {
        try {
            await firestore.collection(getColl(collectionName)).doc(id).update({
                ...data,
                updatedAt: new Date().toISOString()
            });
            return true;
        } catch (error) {
            throw error;
        }
    }

    async deleteId(collectionName, id) {
        try {
            await firestore.collection(getColl(collectionName)).doc(id).delete();
            return true;
        } catch (error) {
            throw error;
        }
    }

    // ============================================
    // 🗑️ DELETE COLLECTION
    // ============================================

    async deleteCollection(collectionName, batchSize = 100) {
        try {
            const collectionRef = firestore.collection(getColl(collectionName));
            const query = collectionRef.limit(batchSize);
            return new Promise((resolve, reject) => {
                this._deleteQueryBatch(query, batchSize, resolve, reject);
            });
        } catch (error) {
            throw error;
        }
    }

    async deleteCollectionRecursive(collectionName) {
        try {
            const { firestore: adminFirestore } = require('./firebaseService');
            await adminFirestore.recursiveDelete(firestore.collection(getColl(collectionName)));
            return true;
        } catch (error) {
            throw error;
        }
    }

    async deleteCollectionBatches(collectionName, maxBatchSize = 100) {
        try {
            let totalDeleted = 0;
            let hasMore = true;

            while (hasMore) {
                const snapshot = await firestore.collection(getColl(collectionName))
                    .limit(maxBatchSize)
                    .get();

                if (snapshot.empty) {
                    hasMore = false;
                    break;
                }

                const batch = firestore.batch();
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                totalDeleted += snapshot.size;
            }

            return totalDeleted;
        } catch (error) {
            throw error;
        }
    }

    async deleteWhere(collectionName, filters = [], batchSize = 100) {
        try {
            let query = firestore.collection(getColl(collectionName));
            filters.forEach(filter => {
                if (filter.field && filter.operator && filter.value !== undefined) {
                    query = query.where(filter.field, filter.operator, filter.value);
                }
            });
            query = query.limit(batchSize);

            let totalDeleted = 0;
            let hasMore = true;

            while (hasMore) {
                const snapshot = await query.get();
                if (snapshot.empty) {
                    hasMore = false;
                    break;
                }
                const batch = firestore.batch();
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                totalDeleted += snapshot.size;
            }

            return totalDeleted;
        } catch (error) {
            throw error;
        }
    }

    // ============================================
    // 🛠️ PRIVATE
    // ============================================

    async _deleteQueryBatch(query, batchSize, resolve, reject) {
        try {
            const snapshot = await query.get();
            if (snapshot.size === 0) {
                resolve(true);
                return;
            }
            const batch = firestore.batch();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            process.nextTick(() => {
                this._deleteQueryBatch(query, batchSize, resolve, reject);
            });
        } catch (error) {
            reject(error);
        }
    }
}

module.exports = new FirestoreService();