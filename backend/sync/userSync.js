// userSync.js
const admin = require('firebase-admin');
const db = require('../config/database');

// 1. Load Firebase Service Account Key
const serviceAccount = require('../config/serviceAccountKey.json'); // Pastikan file ini ada di folder config

// 2. Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://tryout-app-7ec6d-default-rtdb.firebaseio.com"
});

async function syncUsers() {
  console.log('🔄 Starting User Sync...');
  
  try {
    // 3. Get all users from Firebase Auth
    const listUsers = await admin.auth().listUsers(1000);
    const firebaseUsers = listUsers.users;
    console.log(`✅ Found ${firebaseUsers.length} users in Firebase`);

    // 4. Get all users from MySQL
    const [mysqlUsers] = await db.query('SELECT id, firebase_uid, email, name FROM users');
    const mysqlEmailMap = new Map();
    const mysqlUidMap = new Map();

    mysqlUsers.forEach(user => {
      if (user.email) mysqlEmailMap.set(user.email, user);
      if (user.firebase_uid) mysqlUidMap.set(user.firebase_uid, user);
    });

    console.log(`✅ Found ${mysqlUsers.length} users in MySQL`);

    let inserted = 0;
    let updated = 0;

    // 5. Process each Firebase user
    for (const fbUser of firebaseUsers) {
      const { uid, email, displayName } = fbUser;
      const name = displayName || email.split('@')[0];

      // Skip jika email null atau kosong
      if (!email || email.trim() === '') {
        console.warn(`⚠️ Skipping user with no email: ${uid}`);
        continue;
      }

      // Cek apakah sudah ada di MySQL berdasarkan email
      const existingByMail = mysqlEmailMap.get(email);
      const existingByUid = mysqlUidMap.get(uid);

      if (existingByMail) {
        // Update jika nama berubah
        if (existingByMail.name !== name || existingByMail.firebase_uid !== uid) {
          await db.query(
            'UPDATE users SET name = ?, firebase_uid = ? WHERE id = ?',
            [name, uid, existingByMail.id]
          );
          updated++;
          console.log(`🔄 Updated: ${email} -> ${name} (ID: ${existingByMail.id})`);
        }
      } else if (existingByUid) {
        // Jika hanya UID yang match, update email & name
        await db.query(
        'INSERT INTO users (firebase_uid, name, email, role, created_at) VALUES (?, ?, ?, "student", NOW())',
        [uid, name, email]
        );
        updated++;
        console.log(`🔄 Updated by UID: ${uid} -> ${email} (${name})`);
      } else {
        // Insert baru
        await db.query(
          'INSERT INTO users (firebase_uid, name, email, role, created_at) VALUES (?, ?, ?, "student", NOW())',
          [uid, name, email]
        );
        inserted++;
        console.log(`✅ Inserted: ${email} (${name})`);
      }
    }

    console.log(`🎉 Sync complete: ${inserted} inserted, ${updated} updated`);
    
  } catch (error) {
    console.error('❌ User sync failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

// Jalankan
syncUsers();