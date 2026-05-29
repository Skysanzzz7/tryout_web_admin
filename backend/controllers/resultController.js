const db = require('../config/database');
const { db: firestoreDb } = require('../config/firebase');

// Get all results
exports.getAllResults = async (req, res) => {
  try {
    const [results] = await db.query(`
      SELECT 
        er.*,
        p.title as package_title,
        p.duration_minutes
      FROM exam_results er
      JOIN packages p ON er.package_id = p.id
      ORDER BY er.submitted_at DESC
    `);
    
    res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch results',
      error: error.message 
    });
  }
};

// Get results by package
exports.getResultsByPackage = async (req, res) => {
  try {
    const { package_id } = req.params;
    
    const [results] = await db.query(`
      SELECT 
        er.*,
        p.title as package_title
      FROM exam_results er
      JOIN packages p ON er.package_id = p.id
      WHERE er.package_id = ?
      ORDER BY er.score DESC, er.submitted_at DESC
    `, [package_id]);
    
    res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Get results by package error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch results',
      error: error.message 
    });
  }
};

// Get single result detail
exports.getResultDetail = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [results] = await db.query(
      'SELECT * FROM exam_results WHERE id = ?',
      [id]
    );

    if (results.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Result not found' 
      });
    }

    res.json({
      success: true,
      data: results[0]
    });
  } catch (error) {
    console.error('Get result detail error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch result',
      error: error.message 
    });
  }
};

// Sync result from Firebase (called by Cloud Function or webhook)
exports.syncResultFromFirebase = async (req, res) => {
  try {
    const { 
      firebase_result_id, 
      user_id, 
      user_name, 
      user_email, 
      package_id, 
      package_title,
      score, 
      correct_count, 
      wrong_count, 
      duration_minutes,
      user_answers,
      submitted_at 
    } = req.body;

    await db.query(`
      INSERT INTO exam_results (
        firebase_result_id, user_id, user_name, user_email, 
        package_id, package_title, score, correct_count, 
        wrong_count, duration_minutes, user_answers, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        score = VALUES(score),
        correct_count = VALUES(correct_count),
        wrong_count = VALUES(wrong_count),
        duration_minutes = VALUES(duration_minutes),
        user_answers = VALUES(user_answers)
    `, [
      firebase_result_id, user_id, user_name, user_email,
      package_id, package_title, score, correct_count,
      wrong_count, duration_minutes, JSON.stringify(user_answers), submitted_at
    ]);

    res.json({
      success: true,
      message: 'Result synced successfully'
    });

  } catch (error) {
    console.error('Sync result error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to sync result',
      error: error.message 
    });
  }
};  // ← ✅ TUTUP FUNGSI INI DI SINI!

// ✅ Sync ONLY latest results from Firebase (Optimized for Real-time) - SEPARATE FUNCTION!
exports.syncLatestResults = async (req, res) => {
  try {
    const { db: firestoreDb } = require('../config/firebase');
    
    console.log('🔄 Starting sync (User + Results)...');
    
    // Get only last 5 results ordered by time
    const snapshot = await firestoreDb.collection('examResults')
      .orderBy('finishedAt', 'desc')
      .limit(5)
      .get();

    let syncedCount = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const userId = data.userId; // ID dari Firebase Auth

      // --- 🔥 1. CHECK & SYNC USER FIRST ---
      let finalUserName = data.userName || '';
      let finalUserEmail = data.userEmail || '';

      // Jika user ID ada tapi nama kosong (Anonymous), coba ambil dari Firestore Users
      if (userId && !finalUserName) {
        console.log(`👤 User missing, fetching from Firestore: ${userId}`);
        
        // Coba ambil data user dari collection 'users' di Firestore
        const userDoc = await firestoreDb.collection('users').doc(userId).get();
        
        if (userDoc.exists) {
          const userData = userDoc.data();
          finalUserName = userData.displayName || userData.name || userData.fullName;
          finalUserEmail = userData.email || '';
          
          // Masukkan user baru ke MySQL Table 'users'
          await db.query(`
            INSERT IGNORE INTO users (firebase_uid, name, email, role, created_at)
            VALUES (?, ?, ?, 'student', NOW())
          `, [userId, finalUserName, finalUserEmail]);
          
          console.log(`✅ User synced to MySQL: ${finalUserName}`);
        } else {
          console.log(`⚠️ User ${userId} not found in Firestore 'users' collection.`);
        }
      } else if (userId && finalUserName) {
         // Jika nama sudah ada di result, pastikan user tetap tersimpan di MySQL (biar aman)
         await db.query(`
            INSERT IGNORE INTO users (firebase_uid, name, email, role, created_at)
            VALUES (?, ?, ?, 'student', NOW())
          `, [userId, finalUserName, finalUserEmail]);
      }

      // --- 🔥 2. CONTINUE SYNC RESULT ---
      
      // Check if result already exists
      const [existing] = await db.query(
        'SELECT id FROM exam_results WHERE firebase_result_id = ?',
        [doc.id]
      );

      if (existing.length > 0) {
        continue; // Skip if exists
      }

      // Convert Firebase packageId to MySQL package_id
      let mysqlPackageId = null;
      let packageTitle = 'Unknown Package';
      
      if (data.packageId) {
        const [pkgResult] = await db.query(
          'SELECT id, title FROM packages WHERE firebase_package_id = ?',
          [data.packageId]
        );
        
        if (pkgResult.length > 0) {
          mysqlPackageId = pkgResult[0].id;
          packageTitle = pkgResult[0].title;
        } else {
          console.warn(`⚠️ Package not found: ${data.packageId}`);
          continue;
        }
      }

      // Handle date
      let submittedDate;
      if (data.finishedAt && data.finishedAt.toDate) {
        submittedDate = data.finishedAt.toDate();
      } else if (data.finishedAt) {
        submittedDate = new Date(data.finishedAt);
      } else {
        submittedDate = new Date();
      }

      // Insert Result with the CORRECT User Name
      await db.query(`
        INSERT IGNORE INTO exam_results (
          firebase_result_id, user_id, user_name, user_email,
          package_id, package_title, score, correct_count,
          wrong_count, duration_minutes, user_answers, submitted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        doc.id,
        userId || '',
        finalUserName,      // ← GUNAKAN NAMA YANG SUDAH DI-SYNC
        finalUserEmail,     // ← GUNAKAN EMAIL YANG SUDAH DI-SYNC
        mysqlPackageId,
        packageTitle,
        data.score || 0,
        data.correctCount || 0,
        data.wrongCount || 0,
        data.durationMinutes || 0,
        JSON.stringify(data.userAnswers || {}),
        submittedDate
      ]);

      syncedCount++;
      console.log(`✅ Synced Result: ${finalUserName} - ${packageTitle}`);
    }

    console.log(`🎉 Sync complete: ${syncedCount} items`);

    res.json({
      success: true,
      message: `Synced ${syncedCount} results`,
      synced: syncedCount
    });

  } catch (error) {
    console.error('❌ Sync error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Sync failed',
      error: error.message 
    });
  }
}; // ← ✅ TUTUP FUNGSI INI JUGA

// Delete a single result
exports.deleteResult = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Delete from MySQL
    const [result] = await db.query('DELETE FROM exam_results WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Result not found' });
    }

    res.json({
      success: true,
      message: 'Result deleted successfully'
    });

  } catch (error) {
    console.error('Delete result error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete result',
      error: error.message 
    });
  }
};