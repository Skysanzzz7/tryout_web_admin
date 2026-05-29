const { db: firestoreDb } = require('../config/firebase');
const db = require('../config/database');

const syncResultsFromFirebase = async () => {
  try {
    console.log('\n🔄 ====================================');
    console.log('🔄 Starting sync from Firebase to MySQL...');
    console.log('🔄 ====================================\n');

    // Get all exam results from Firebase
    // Collection name: examResults (camelCase)
    const snapshot = await firestoreDb.collection('examResults').get();

    if (snapshot.empty) {
      console.log('✅ No results to sync in Firebase');
      return;
    }

    console.log(`📦 Found ${snapshot.size} results in Firebase\n`);

    let synced = 0;
    let updated = 0;
    let errors = 0;

    // Get packages mapping first
    const [packages] = await db.query('SELECT id, firebase_package_id FROM packages');
    const packageMap = {};
    packages.forEach(pkg => {
      packageMap[pkg.firebase_package_id] = pkg.id;
    });

    // Insert/Update each result to MySQL
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        // Map Firebase field names to MySQL fields
        const firebasePackageId = data.packageId;  // camelCase from Firebase
        const mysqlPackageId = packageMap[firebasePackageId];

        if (!mysqlPackageId) {
          console.log(`⚠️  Skipping result ${doc.id}: Package '${firebasePackageId}' not found in MySQL`);
          errors++;
          continue;
        }

        // Get package title
        const [pkgData] = await db.query(
          'SELECT title FROM packages WHERE id = ?',
          [mysqlPackageId]
        );
        const packageTitle = pkgData.length > 0 ? pkgData[0].title : '';

        // Check if result already exists
        const [existing] = await db.query(
          'SELECT id FROM exam_results WHERE firebase_result_id = ?',
          [doc.id]
        );

        const resultData = {
          firebase_result_id: doc.id,
          user_id: data.userId || '',
          user_name: data.userName || data.userEmail?.split('@')[0] || 'Anonymous',
          user_email: data.userEmail || '',
          package_id: mysqlPackageId,
          package_title: packageTitle,
          score: data.score || 0,
          correct_count: data.correctCount || 0,
          wrong_count: data.wrongCount || 0,
          duration_minutes: data.durationMinutes || 0,
          user_answers: JSON.stringify(data.userAnswers || {}),
          submitted_at: data.finishedAt ? new Date(data.finishedAt) : new Date(data.startedAt || Date.now())
        };

        if (existing.length > 0) {
          // Update existing
          await db.query(`
            UPDATE exam_results SET
              user_id = ?,
              user_name = ?,
              user_email = ?,
              package_id = ?,
              package_title = ?,
              score = ?,
              correct_count = ?,
              wrong_count = ?,
              duration_minutes = ?,
              user_answers = ?,
              submitted_at = ?
            WHERE firebase_result_id = ?
          `, [
            resultData.user_id,
            resultData.user_name,
            resultData.user_email,
            resultData.package_id,
            resultData.package_title,
            resultData.score,
            resultData.correct_count,
            resultData.wrong_count,
            resultData.duration_minutes,
            resultData.user_answers,
            resultData.submitted_at,
            doc.id
          ]);
          
          updated++;
          console.log(`🔄 Updated result: ${doc.id} - Score: ${data.score}`);
        } else {
          // Insert new
          await db.query(`
            INSERT INTO exam_results (
              firebase_result_id, user_id, user_name, user_email,
              package_id, package_title, score, correct_count,
              wrong_count, duration_minutes, user_answers, submitted_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            resultData.firebase_result_id,
            resultData.user_id,
            resultData.user_name,
            resultData.user_email,
            resultData.package_id,
            resultData.package_title,
            resultData.score,
            resultData.correct_count,
            resultData.wrong_count,
            resultData.duration_minutes,
            resultData.user_answers,
            resultData.submitted_at
          ]);

          synced++;
          console.log(`✅ Synced result: ${doc.id} - User: ${resultData.user_email} - Score: ${data.score}`);
        }
      } catch (error) {
        errors++;
        console.error(`❌ Error syncing ${doc.id}:`, error.message);
      }
    }

    console.log('\n🎉 ====================================');
    console.log('🎉 Sync completed!');
    console.log('🎉 ====================================');
    console.log(`✅ New results: ${synced}`);
    console.log(`🔄 Updated: ${updated}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📊 Total processed: ${snapshot.size}\n`);

  } catch (error) {
    console.error('\n❌ ====================================');
    console.error('❌ Sync failed!');
    console.error('❌ ====================================');
    console.error(error);
    console.log('');
  }
};

// Run sync
syncResultsFromFirebase();