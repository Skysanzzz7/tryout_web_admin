const db = require('../config/database');
const { db: firestoreDb } = require('../config/firebase');

// Get all questions by package
exports.getQuestionsByPackage = async (req, res) => {
  try {
    const { package_id } = req.query;
    
    let query = 'SELECT * FROM questions';
    let params = [];
    
    if (package_id) {
      query += ' WHERE package_id = ?';
      params.push(package_id);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const [questions] = await db.query(query, params);
    
    // Get options for each question
    const questionsWithOptions = await Promise.all(
      questions.map(async (question) => {
        const [options] = await db.query(
          'SELECT * FROM options WHERE question_id = ? ORDER BY option_number',
          [question.id]
        );
        return {
          ...question,
          options: options.map(opt => ({
            optionNumber: opt.option_number,
            optionText: opt.option_text
          }))
        };
      })
    );

    res.json({
      success: true,
      data: questionsWithOptions
    });
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch questions',
      error: error.message 
    });
  }
};

// Get single question
exports.getQuestionById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [questions] = await db.query(
      'SELECT * FROM questions WHERE id = ?',
      [id]
    );

    if (questions.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Question not found' 
      });
    }

    const [options] = await db.query(
      'SELECT * FROM options WHERE question_id = ? ORDER BY option_number',
      [id]
    );

    const question = {
      ...questions[0],
      options: options.map(opt => ({
        optionNumber: opt.option_number,
        optionText: opt.option_text
      }))
    };

    res.json({
      success: true,
      data: question
    });
  } catch (error) {
    console.error('Get question error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch question',
      error: error.message 
    });
  }
};

// Create question
exports.createQuestion = async (req, res) => {
  try {
    const { package_id, question_text, correct_option, explanation, options } = req.body;

    // Insert question to MySQL
    const [result] = await db.query(
      'INSERT INTO questions (package_id, question_text, correct_option, explanation) VALUES (?, ?, ?, ?)',
      [package_id, question_text, correct_option, explanation]
    );

    const questionId = result.insertId;

    // Insert options
    if (options && options.length > 0) {
      const optionValues = options.map(opt => 
        [questionId, opt.optionNumber, opt.optionText]
      );
      
      await db.query(
        'INSERT INTO options (question_id, option_number, option_text) VALUES ?',
        [optionValues]
      );
    }

    // Sync to Firebase
    const questionData = {
      packageId: package_id.toString(),
      questionText: question_text,
      correctOption: correct_option,
      explanation: explanation,
      options: options || [],
      createdAt: new Date().toISOString()
    };

    await firestoreDb.collection('questions').doc(questionId.toString()).set(questionData);

    // Update firebase_question_id
    await db.query(
      'UPDATE questions SET firebase_question_id = ? WHERE id = ?',
      [questionId.toString(), questionId]
    );

    // Update package total_questions
    await db.query(
      'UPDATE packages SET total_questions = total_questions + 1 WHERE id = ?',
      [package_id]
    );

    res.status(201).json({
      success: true,
      message: 'Question created successfully',
      data: { id: questionId, ...questionData }
    });

  } catch (error) {
    console.error('Create question error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create question',
      error: error.message 
    });
  }
};

// Update question
exports.updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { package_id, question_text, correct_option, explanation, options } = req.body;

    // Update question in MySQL
    await db.query(
      'UPDATE questions SET package_id = ?, question_text = ?, correct_option = ?, explanation = ? WHERE id = ?',
      [package_id, question_text, correct_option, explanation, id]
    );

    // Delete old options
    await db.query('DELETE FROM options WHERE question_id = ?', [id]);

    // Insert new options
    if (options && options.length > 0) {
      const optionValues = options.map(opt => 
        [id, opt.optionNumber, opt.optionText]
      );
      
      await db.query(
        'INSERT INTO options (question_id, option_number, option_text) VALUES ?',
        [optionValues]
      );
    }

    // Update Firebase
    const questionData = {
      packageId: package_id.toString(),
      questionText: question_text,
      correctOption: correct_option,
      explanation: explanation,
      options: options || [],
      updatedAt: new Date().toISOString()
    };

    await firestoreDb.collection('questions').doc(id).update(questionData);

    res.json({
      success: true,
      message: 'Question updated successfully'
    });

  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update question',
      error: error.message 
    });
  }
};

// Delete question
exports.deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;

    // Get package_id before deleting
    const [questions] = await db.query(
      'SELECT package_id FROM questions WHERE id = ?',
      [id]
    );

    if (questions.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Question not found' 
      });
    }

    const packageId = questions[0].package_id;

    // Delete from MySQL (will cascade to options)
    await db.query('DELETE FROM questions WHERE id = ?', [id]);

    // Delete from Firebase
    await firestoreDb.collection('questions').doc(id).delete();

    // Update package total_questions
    await db.query(
      'UPDATE packages SET total_questions = total_questions - 1 WHERE id = ?',
      [packageId]
    );

    res.json({
      success: true,
      message: 'Question deleted successfully'
    });

  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete question',
      error: error.message 
    });
  }
};