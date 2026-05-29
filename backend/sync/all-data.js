/**
 * Sync All Data from Firebase to MySQL
 * FIXED: Handle package_id mapping
 */

const { db: firestoreDb } = require('../config/firebase');
const db = require('../config/database');

const syncAllData = async () => {
  try {
    console.log('\n🔄 ====================================');
    console.log('🔄 Starting FULL sync from Firebase...');
    console.log('🔄 ====================================\n');

    // ====================================
    // STEP 1: Sync Packages First
    // ====================================
    console.log('📦 Syncing packages...');
    const packagesSnapshot = await firestoreDb.collection('packages').get();
    let packagesSynced = 0;
    
    // Create mapping: Firebase ID → MySQL ID
    const firebaseToMysqlMap = {};

    for (const doc of packagesSnapshot.docs) {
      const data = doc.data();
      
      // Insert/Update package
      await db.query(`
        INSERT INTO packages (
          firebase_package_id, title, subject, description,
          duration_minutes, total_questions, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          subject = VALUES(subject),
          description = VALUES(description),
          duration_minutes = VALUES(duration_minutes),
          total_questions = VALUES(total_questions),
          is_active = VALUES(is_active)
      `, [
        doc.id,
        data.title || '',
        data.subject || '',
        data.description || '',
        data.durationMinutes || 30,
        data.totalQuestions || 0,
        data.isActive !== false ? 1 : 0
      ]);

      // Get MySQL ID for this package
      const [result] = await db.query(
        'SELECT id FROM packages WHERE firebase_package_id = ?',
        [doc.id]
      );

      if (result.length > 0) {
        firebaseToMysqlMap[doc.id] = result[0].id;
      }

      packagesSynced++;
    }
    console.log(`✅ Packages synced: ${packagesSynced}`);
    console.log(`📊 Firebase → MySQL ID mapping: ${Object.keys(firebaseToMysqlMap).length}\n`);

    // ====================================
    // STEP 2: Sync Questions (with mapped package_id)
    // ====================================
    console.log('📝 Syncing questions...');
    const questionsSnapshot = await firestoreDb.collection('questions').get();
    let questionsSynced = 0;
    let questionsSkipped = 0;
    
    for (const doc of questionsSnapshot.docs) {
      try {
        const data = doc.data();
        
        // Get MySQL package_id from mapping
        const mysqlPackageId = firebaseToMysqlMap[data.packageId];
        
        if (!mysqlPackageId) {
          // Package not found in MySQL, skip this question
          console.log(`⚠️  Skipping question ${doc.id}: Package '${data.packageId}' not found in MySQL`);
          questionsSkipped++;
          continue;
        }

        await db.query(`
          INSERT INTO questions (
            firebase_question_id, package_id, question_text,
            correct_option, explanation
          ) VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            question_text = VALUES(question_text),
            correct_option = VALUES(correct_option),
            explanation = VALUES(explanation)
        `, [
          doc.id,
          mysqlPackageId,  // ← USE MYSQL ID, NOT FIREBASE ID!
          data.questionText || '',
          data.correctOption || 1,
          data.explanation || ''
        ]);

        questionsSynced++;
      } catch (error) {
        console.error(`❌ Error syncing question ${doc.id}:`, error.message);
      }
    }
    console.log(`✅ Questions synced: ${questionsSynced}`);
    console.log(`⚠️  Questions skipped: ${questionsSkipped}\n`);

    // ====================================
    // STEP 3: Sync Results (with mapped package_id)
    // ====================================
    console.log('📊 Syncing results...');
    const resultsSnapshot = await firestoreDb.collection('exam_results').get();
    let resultsSynced = 0;
    let resultsSkipped = 0;

    for (const doc of resultsSnapshot.docs) {
      try {
        const data = doc.data();
        
        // Get MySQL package_id from mapping
        const mysqlPackageId = firebaseToMysqlMap[data.packageId];
        
        if (!mysqlPackageId) {
          console.log(`⚠️  Skipping result ${doc.id}: Package '${data.packageId}' not found in MySQL`);
          resultsSkipped++;
          continue;
        }

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
            user_answers = VALUES(user_answers),
            submitted_at = VALUES(submitted_at)
        `, [
          doc.id,
          data.userId || '',
          data.userName || '',
          data.userEmail || '',
          mysqlPackageId,  // ← USE MYSQL ID
          data.packageTitle || '',
          data.score || 0,
          data.correctCount || 0,
          data.wrongCount || 0,
          data.durationMinutes || 0,
          JSON.stringify(data.userAnswers || {}),
          data.submittedAt ? new Date(data.submittedAt) : new Date()
        ]);

        resultsSynced++;
      } catch (error) {
        console.error(`❌ Error syncing result ${doc.id}:`, error.message);
      }
    }
    console.log(`✅ Results synced: ${resultsSynced}`);
    console.log(`⚠️  Results skipped: ${resultsSkipped}\n`);

    // ====================================
    // SUMMARY
    // ====================================
    console.log('🎉 ====================================');
    console.log('🎉 FULL SYNC COMPLETED!');
    console.log('🎉 ====================================');
    console.log(`📦 Packages: ${packagesSynced}`);
    console.log(`📝 Questions: ${questionsSynced} (${questionsSkipped} skipped)`);
    console.log(`📊 Results: ${resultsSynced} (${resultsSkipped} skipped)`);
    console.log('');

  } catch (error) {
    console.error('\n❌ ====================================');
    console.error('❌ Full sync failed!');
    console.error('❌ ====================================');
    console.error(error);
    console.log('');
  }
};

// Run sync
syncAllData();