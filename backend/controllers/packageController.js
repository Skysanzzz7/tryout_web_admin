const db = require('../config/database');
const { db: firestoreDb } = require('../config/firebase');

// Get all packages
exports.getAllPackages = async (req, res) => {
  try {
    const [packages] = await db.query('SELECT * FROM packages ORDER BY created_at DESC');
    
    res.json({
      success: true,
      data: packages
    });
  } catch (error) {
    console.error('Get packages error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch packages',
      error: error.message 
    });
  }
};

// Get single package
exports.getPackageById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [packages] = await db.query(
      'SELECT * FROM packages WHERE id = ?',
      [id]
    );

    if (packages.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Package not found' 
      });
    }

    res.json({
      success: true,
      data: packages[0]
    });
  } catch (error) {
    console.error('Get package error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch package',
      error: error.message 
    });
  }
};

// Create package
exports.createPackage = async (req, res) => {
  try {
    const { title, subject, description, duration_minutes, total_questions, is_active } = req.body;

    // Insert to MySQL
    const [result] = await db.query(
      'INSERT INTO packages (title, subject, description, duration_minutes, total_questions, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [title, subject, description, duration_minutes || 30, total_questions || 0, is_active !== undefined ? is_active : 1]
    );

    const packageId = result.insertId;

    // Sync to Firebase
    const packageData = {
      title,
      subject,
      description,
      durationMinutes: duration_minutes || 30,
      totalQuestions: total_questions || 0,
      isActive: is_active !== undefined ? is_active : true,
      createdAt: new Date().toISOString()
    };

    await firestoreDb.collection('packages').doc(packageId.toString()).set(packageData);

    // Update firebase_package_id
    await db.query(
      'UPDATE packages SET firebase_package_id = ? WHERE id = ?',
      [packageId.toString(), packageId]
    );

    res.status(201).json({
      success: true,
      message: 'Package created successfully',
      data: { id: packageId, ...packageData }
    });

  } catch (error) {
    console.error('Create package error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create package',
      error: error.message 
    });
  }
};

// Update package
exports.updatePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subject, description, duration_minutes, total_questions, is_active } = req.body;

    // Update MySQL
    await db.query(
      'UPDATE packages SET title = ?, subject = ?, description = ?, duration_minutes = ?, total_questions = ?, is_active = ? WHERE id = ?',
      [title, subject, description, duration_minutes, total_questions, is_active, id]
    );

    // Update Firebase
    const packageData = {
      title,
      subject,
      description,
      durationMinutes: duration_minutes,
      totalQuestions: total_questions,
      isActive: is_active,
      updatedAt: new Date().toISOString()
    };

    await firestoreDb.collection('packages').doc(id).update(packageData);

    res.json({
      success: true,
      message: 'Package updated successfully'
    });

  } catch (error) {
    console.error('Update package error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update package',
      error: error.message 
    });
  }
};

// Delete package
exports.deletePackage = async (req, res) => {
  try {
    const { id } = req.params;

    // Delete from MySQL (will cascade to questions & options)
    await db.query('DELETE FROM packages WHERE id = ?', [id]);

    // Delete from Firebase
    await firestoreDb.collection('packages').doc(id).delete();

    res.json({
      success: true,
      message: 'Package deleted successfully'
    });

  } catch (error) {
    console.error('Delete package error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete package',
      error: error.message 
    });
  }
};