const db = require('../config/database');

// Get dashboard statistics
exports.getStats = async (req, res) => {
  try {
    // Total Packages
    const [packages] = await db.query('SELECT COUNT(*) as total FROM packages');
    
    // Total Questions
    const [questions] = await db.query('SELECT COUNT(*) as total FROM questions');
    
    // Total Students (unique users who took exams)
    const [students] = await db.query(`
      SELECT COUNT(DISTINCT user_id) as total 
      FROM exam_results 
      WHERE user_id IS NOT NULL AND user_id != ''
    `);
    
    // Total Exams (exam results)
    const [exams] = await db.query('SELECT COUNT(*) as total FROM exam_results');

    // Recent Exams (last 5)
    const [recentExams] = await db.query(`
      SELECT 
        er.user_name,
        er.user_email,
        er.score,
        er.package_title,
        er.submitted_at
      FROM exam_results er
      ORDER BY er.submitted_at DESC
      LIMIT 5
    `);

    // Top Performers (highest scores)
    const [topPerformers] = await db.query(`
      SELECT 
        er.user_name,
        er.user_email,
        er.score,
        er.package_title,
        er.submitted_at
      FROM exam_results er
      ORDER BY er.score DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {  // ← FIX: Tambah 'data:' key di sini!
        totalPackages: packages[0].total,
        totalQuestions: questions[0].total,
        totalStudents: students[0].total,
        totalExams: exams[0].total,
        recentExams: recentExams || [],
        topPerformers: topPerformers || []
      }
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch dashboard stats',
      error: error.message 
    });
  }
};