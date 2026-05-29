/**
 * FINAL COMPREHENSIVE SYNC
 * Firebase (camelCase) → MySQL (snake_case)
 */

const { db: firestoreDb } = require('../config/firebase');
const db = require('../config/database');

const finalSync = async () => {
  try {
    console.log('\n ====================================');
    console.log('🔧 FINAL COMPREHENSIVE SYNC');
    console.log('🔧 ====================================\n');

    // ====================================
    // STEP 1: Sync Packages
    // ====================================
    console.log('📦 STEP 1: Syncing packages...');
    const packagesSnapshot = await firestoreDb.collection('packages').get();
    
    let packagesSynced = 0;
    const firebaseToMysqlMap = {}; // Firebase ID → MySQL ID

    for (const doc of packagesSnapshot.docs) {
      const data = doc.data();
      
      try {
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
          data.durationMinutes || 30,        // Firebase: durationMinutes
          data.totalQuestions || 0,           // Firebase: totalQuestions
          data.isActive !== false ? 1 : 0     // Firebase: isActive
        ]);

        // Get MySQL ID
        const [result] = await db.query(
          'SELECT id FROM packages WHERE firebase_package_id = ?',
          [doc.id]
        );

        if (result.length > 0) {
          firebaseToMysqlMap[doc.id] = result[0].id;
          packagesSynced++;
          console.log(`   ✅ Package: ${data.title} (MySQL ID: ${result[0].id})`);
        }
      } catch (error) {
        console.log(`   ❌ Error syncing package ${doc.id}:`, error.message);
      }
    }
    console.log(`\n✅ Packages synced: ${packagesSynced}\n`);

    // ====================================
    // STEP 2: Sync Questions
    // ====================================
    console.log('📝 STEP 2: Syncing questions...');
    const questionsSnapshot = await firestoreDb.collection('questions').get();
    
    let questionsSynced = 0;
    let questionsSkipped = 0;

    for (const doc of questionsSnapshot.docs) {
      const data = doc.data();
      
      try {
        // Get MySQL package_id from mapping
        const mysqlPackageId = firebaseToMysqlMap[data.packageId];  // Firebase: packageId

        if (!mysqlPackageId) {
          console.log(`   ⚠️  Skip question ${doc.id}: Package '${data.packageId}' not found`);
          questionsSkipped++;
          continue;
        }

        // Insert question
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
          mysqlPackageId,                       // Use MySQL ID (INT)
          data.questionText || '',              // Firebase: questionText
          data.correctOption || 1,              // Firebase: correctOption
          data.explanation || ''
        ]);

        // Get MySQL question ID
        const [qResult] = await db.query(
          'SELECT id FROM questions WHERE firebase_question_id = ?',
          [doc.id]
        );

        const mysqlQuestionId = qResult.length > 0 ? qResult[0].id : null;

        // Sync options (array)
        if (data.options && data.options.length > 0 && mysqlQuestionId) {
          // Delete old options
          await db.query('DELETE FROM options WHERE question_id = ?', [mysqlQuestionId]);
          
          // Insert new options
          for (const opt of data.options) {
            await db.query(`
              INSERT INTO options (question_id, option_number, option_text)
              VALUES (?, ?, ?)
            `, [
              mysqlQuestionId,
              opt.optionNumber || opt.option_number,  // Handle both camelCase & snake_case
              opt.optionText || opt.option_text
            ]);
          }
        }

        questionsSynced++;
      } catch (error) {
        console.log(`   ❌ Error syncing question ${doc.id}:`, error.message);
        questionsSkipped++;
      }
    }
    console.log(`✅ Questions synced: ${questionsSynced}`);
    console.log(`⚠️  Questions skipped: ${questionsSkipped}\n`);

    // ====================================
    // STEP 3: Sync Results
    // ====================================
    console.log('📊 STEP 3: Syncing exam results...');
    
    let resultsSnapshot;
    try {
      // Try camelCase first
      resultsSnapshot = await firestoreDb.collection('examResults').get();
    } catch (e) {
      // Fallback to snake_case
      resultsSnapshot = await firestoreDb.collection('exam_results').get();
    }

    let resultsSynced = 0;
    let resultsSkipped = 0;

    for (const doc of resultsSnapshot.docs) {
      const data = doc.data();
      
      try {
        // Get MySQL package_id
        const mysqlPackageId = firebaseToMysqlMap[data.packageId];

        if (!mysqlPackageId) {
          console.log(`   ⚠️  Skip result ${doc.id}: Package '${data.packageId}' not found`);
          resultsSkipped++;
          continue;
        }

        // Get package title
        const [pkgData] = await db.query(
          'SELECT title FROM packages WHERE id = ?',
          [mysqlPackageId]
        );
        const packageTitle = pkgData.length > 0 ? pkgData[0].title : '';

        // Handle timestamp (Firebase: finishedAt)
        const submittedAt = data.finishedAt || data.startedAt;
        const submittedDate = submittedAt && submittedAt.toDate 
          ? submittedAt.toDate() 
          : new Date();

        // Get user info if available
        let userName = '';
        let userEmail = '';
        
        if (data.userId) {
          try {
            const userDoc = await firestoreDb.collection('users').doc(data.userId).get();
            if (userDoc.exists) {
              const userData = userDoc.data();
              userName = userData.name || '';
              userEmail = userData.email || '';
            }
          } catch (e) {
            // User not found, use empty strings
          }
        }

        // Insert/Update result
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
            submitted_at = VALUES(submitted_at)
        `, [
          doc.id,
          data.userId || '',                    // Firebase: userId
          userName,
          userEmail,
          mysqlPackageId,
          packageTitle,
          data.score || 0,
          data.correctCount || 0,               // Firebase: correctCount
          data.wrongCount || 0,                 // Firebase: wrongCount
          data.durationMinutes || 0,            // Firebase: durationMinutes
          JSON.stringify(data.userAnswers || {}),
          submittedDate
        ]);

        resultsSynced++;
        console.log(`   ✅ Result: User ${userEmail || data.userId} - Score: ${data.score}`);
      } catch (error) {
        console.log(`   ❌ Error syncing result ${doc.id}:`, error.message);
        resultsSkipped++;
      }
    }
    console.log(`✅ Results synced: ${resultsSynced}`);
    console.log(`⚠️  Results skipped: ${resultsSkipped}\n`);

    // ====================================
    // SUMMARY
    // ====================================
    console.log('🎉 ====================================');
    console.log('🎉 FINAL SYNC COMPLETED!');
    console.log('🎉 ====================================');
    console.log(`📦 Packages: ${packagesSynced}`);
    console.log(`📝 Questions: ${questionsSynced} (${questionsSkipped} skipped)`);
    console.log(`📊 Results: ${resultsSynced} (${resultsSkipped} skipped)`);
    console.log('\n✅ Now check your web admin!');
    console.log('   → http://localhost:3000/packages');
    console.log('   → http://localhost:3000/questions');
    console.log('   → http://localhost:3000/results\n');

  } catch (error) {
    console.error('\n❌ ====================================');
    console.error('❌ FINAL SYNC FAILED!');
    console.error('❌ ====================================');
    console.error(error);
    console.log('');
  }
};

// Run sync
finalSync();