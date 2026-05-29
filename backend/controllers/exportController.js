const { Parser } = require('json2csv');
const xlsx = require('xlsx');
const db = require('../config/database');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Configure multer for file upload
const upload = multer({ 
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || 
        file.originalname.endsWith('.csv') ||
        file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files allowed'), false);
    }
  }
});

// Export Results to CSV
exports.exportResultsToCSV = async (req, res) => {
  try {
    const { package_id } = req.query;
    
    let query = `
      SELECT 
        er.user_name as 'Student Name',
        er.user_email as 'Email',
        er.package_title as 'Package',
        er.score as 'Score',
        er.correct_count as 'Correct',
        er.wrong_count as 'Wrong',
        er.duration_minutes as 'Duration (min)',
        er.submitted_at as 'Submitted At'
      FROM exam_results er
    `;
    
    let params = [];
    if (package_id) {
      query += ' WHERE er.package_id = ?';
      params.push(package_id);
    }
    query += ' ORDER BY er.submitted_at DESC';

    const [results] = await db.query(query, params);

    if (results.length === 0) {
      return res.status(404).json({ message: 'No results found' });
    }

    const parser = new Parser();
    const csv = parser.parse(results);

    res.header('Content-Type', 'text/csv');
    res.attachment(`exam_results_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);

  } catch (error) {
    console.error('Export results error:', error);
    res.status(500).json({ message: 'Export failed', error: error.message });
  }
};

// Export Questions to CSV
exports.exportQuestionsToCSV = async (req, res) => {
  try {
    const { package_id } = req.params;

    const [questions] = await db.query(`
      SELECT 
        q.question_text as 'Question',
        q.correct_option as 'Correct Option',
        q.explanation as 'Explanation',
        GROUP_CONCAT(CONCAT(o.option_number, ': ', o.option_text) SEPARATOR ' | ') as 'Options'
      FROM questions q
      LEFT JOIN options o ON q.id = o.question_id
      WHERE q.package_id = ?
      GROUP BY q.id
      ORDER BY q.id
    `, [package_id]);

    if (questions.length === 0) {
      return res.status(404).json({ message: 'No questions found' });
    }

    const parser = new Parser();
    const csv = parser.parse(questions);

    res.header('Content-Type', 'text/csv');
    res.attachment(`questions_package_${package_id}.csv`);
    res.send(csv);

  } catch (error) {
    console.error('Export questions error:', error);
    res.status(500).json({ message: 'Export failed', error: error.message });
  }
};

// Import Questions from CSV
exports.importQuestionsFromCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { package_id } = req.body;
    const filePath = req.file.path;

    // Read CSV file
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    if (data.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: 'CSV file is empty' });
    }

    let imported = 0;
    let errors = [];

    // Start transaction
    await db.query('START TRANSACTION');

    for (let i = 0; i < data.length; i++) {
      try {
        const row = data[i];
        
        // Validate required fields
        if (!row['Question'] || !row['Correct Option']) {
          errors.push(`Row ${i + 1}: Missing required fields`);
          continue;
        }

        // Insert question
        const [result] = await db.query(`
          INSERT INTO questions (package_id, question_text, correct_option, explanation)
          VALUES (?, ?, ?, ?)
        `, [
          package_id,
          row['Question'],
          parseInt(row['Correct Option']) || 1,
          row['Explanation'] || ''
        ]);

        const questionId = result.insertId;

        // Parse options (format: "1: Option A | 2: Option B | 3: Option C | 4: Option D")
        if (row['Options']) {
          const optionsArray = row['Options'].split(' | ');
          
          for (const opt of optionsArray) {
            const [num, text] = opt.split(': ');
            if (num && text) {
              await db.query(`
                INSERT INTO options (question_id, option_number, option_text)
                VALUES (?, ?, ?)
              `, [questionId, parseInt(num), text.trim()]);
            }
          }
        }

        imported++;
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error.message}`);
      }
    }

    // Commit or rollback
    if (errors.length === data.length) {
      await db.query('ROLLBACK');
    } else {
      await db.query('COMMIT');
    }

    // Clean up
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      message: `Imported ${imported} questions`,
      imported,
      total: data.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Import questions error:', error);
    await db.query('ROLLBACK');
    res.status(500).json({ message: 'Import failed', error: error.message });
  }
};

// Get CSV Template
exports.getCSVTemplate = (req, res) => {
  const template = [
    {
      'Question': 'Contoh soal pilihan ganda?',
      'Options': '1: Pilihan A | 2: Pilihan B | 3: Pilihan C | 4: Pilihan D',
      'Correct Option': '1',
      'Explanation': 'Penjelasan jawaban yang benar'
    }
  ];

  const parser = new Parser();
  const csv = parser.parse(template);

  res.header('Content-Type', 'text/csv');
  res.attachment('questions_template.csv');
  res.send(csv);
};

module.exports.upload = upload;