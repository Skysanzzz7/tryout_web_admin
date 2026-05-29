import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/Layout/DashboardLayout';
import api from '../services/api';

const Questions = () => {
  const [searchParams] = useSearchParams();
  const packageId = searchParams.get('package_id');

  const [questions, setQuestions] = useState([]);
  const [packages, setPackages] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(packageId || '');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    package_id: '',
    question_text: '',
    correct_option: 1,
    explanation: '',
    options: [
      { optionNumber: 1, optionText: '' },
      { optionNumber: 2, optionText: '' },
      { optionNumber: 3, optionText: '' },
      { optionNumber: 4, optionText: '' }
    ]
  });

  useEffect(() => {
    fetchPackages();
    if (selectedPackage) {
      fetchQuestions();
    }
  }, [selectedPackage]);

  const fetchPackages = async () => {
    try {
      const { data } = await api.get('/packages');
      setPackages(data.data || []);
      if (!selectedPackage && data.data?.length > 0) {
        setSelectedPackage(data.data[0].id.toString());
        setFormData(prev => ({ ...prev, package_id: data.data[0].id.toString() }));
      }
    } catch (error) {
      console.error('Fetch packages error:', error);
    }
  };

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/questions?package_id=${selectedPackage}`);
      setQuestions(data.data || []);
    } catch (error) {
      console.error('Fetch questions error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...formData.options];
    newOptions[index].optionText = value;
    setFormData({
      ...formData,
      options: newOptions
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingQuestion) {
        await api.put(`/questions/${editingQuestion.id}`, formData);
      } else {
        await api.post('/questions', formData);
      }
      
      setShowModal(false);
      setEditingQuestion(null);
      resetForm();
      fetchQuestions();
    } catch (error) {
      alert(error.response?.data?.message || 'Operation failed');
    }
  };

  const resetForm = () => {
    setFormData({
      package_id: selectedPackage || '',
      question_text: '',
      correct_option: 1,
      explanation: '',
      options: [
        { optionNumber: 1, optionText: '' },
        { optionNumber: 2, optionText: '' },
        { optionNumber: 3, optionText: '' },
        { optionNumber: 4, optionText: '' }
      ]
    });
  };

  const handleEdit = (question) => {
    setEditingQuestion(question);
    setFormData({
      package_id: question.package_id.toString(),
      question_text: question.question_text,
      correct_option: question.correct_option,
      explanation: question.explanation || '',
      options: question.options?.length === 4 
        ? question.options.map(opt => ({
            optionNumber: opt.optionNumber,
            optionText: opt.optionText
          }))
        : [
            { optionNumber: 1, optionText: '' },
            { optionNumber: 2, optionText: '' },
            { optionNumber: 3, optionText: '' },
            { optionNumber: 4, optionText: '' }
          ]
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    
    try {
      await api.delete(`/questions/${id}`);
      fetchQuestions();
    } catch (error) {
      alert(error.response?.data?.message || 'Delete failed');
    }
  };

  const handleCreate = () => {
    if (!selectedPackage) {
      alert('Please select a package first!');
      return;
    }
    setEditingQuestion(null);
    resetForm();
    setShowModal(true);
  };

  const handleExportCSV = async () => {
    try {
      if (!selectedPackage) {
        alert('Please select a package first');
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please login again');
        return;
      }

      // Fetch dengan token
      const response = await fetch(`http://localhost:5000/api/export/questions/${selectedPackage}/csv`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Download file
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `questions_package_${selectedPackage}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

    } catch (error) {
      alert('Export failed: ' + error.message);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please login again');
        return;
      }

      // Fetch dengan token
      const response = await fetch('http://localhost:5000/api/export/questions/template', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      // Download file
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'questions_template.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

    } catch (error) {
      alert('Download failed: ' + error.message);
    }
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedPackage) return;

    const formDataImport = new FormData();
    formDataImport.append('file', file);
    formDataImport.append('package_id', selectedPackage);

    try {
      setUploading(true);
      const response = await api.post('/export/questions/import', formDataImport, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      alert(`Imported ${response.data.imported} questions successfully!`);
      setShowImportModal(false);
      fetchQuestions();
    } catch (error) {
      alert('Import failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setUploading(false);
    }
  };

  if (loading && questions.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-200 border-t-green-600"></div>
            <div className="absolute top-0 left-0 w-16 h-16 rounded-full border-4 border-green-300 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-gray-500 animate-pulse">Loading questions...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">
          Questions
        </h1>
        <p className="text-gray-600 mt-2">Manage exam questions with ease</p>
      </div>

      <div className="mb-8 animate-slide-up">
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Select Package
        </label>
        <div className="relative max-w-2xl">
          <select
            value={selectedPackage}
            onChange={(e) => setSelectedPackage(e.target.value)}
            className="w-full px-6 py-4 bg-white border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-green-200 focus:border-green-500 transition-all duration-300 text-lg appearance-none cursor-pointer hover:border-gray-300 shadow-sm"
          >
            <option value="">-- Select Package --</option>
            {packages.map((pkg) => (
              <option key={pkg.id} value={pkg.id.toString()}>
                {pkg.title} ({pkg.total_questions} questions)
              </option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      <div className="mb-6 flex justify-between items-center animate-slide-up delay-100">
        <div className="flex space-x-3">
          {selectedPackage && questions.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="btn-animated px-6 py-3 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-xl shadow-lg hover:shadow-green-500/30 flex items-center space-x-2 transform hover:-translate-y-1 transition-all duration-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Export</span>
            </button>
          )}
          
          <button
            onClick={() => setShowImportModal(true)}
            className="btn-animated px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl shadow-lg hover:shadow-purple-500/30 flex items-center space-x-2 transform hover:-translate-y-1 transition-all duration-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>Import</span>
          </button>
        </div>

        <button
          onClick={handleCreate}
          className="btn-animated px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl shadow-lg hover:shadow-blue-500/30 flex items-center space-x-2 transform hover:-translate-y-1 transition-all duration-300"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Add Question</span>
        </button>
      </div>

      {!selectedPackage && (
        <div className="text-center py-16 animate-scale-in">
          <div className="inline-block animate-float mb-6">
            <svg className="w-24 h-24 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">Select a package</h3>
          <p className="text-gray-500">Choose a package from the dropdown to view questions</p>
        </div>
      )}

      {selectedPackage && questions.length === 0 && (
        <div className="text-center py-16 animate-scale-in">
          <div className="inline-block animate-float mb-6">
            <svg className="w-24 h-24 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">No questions yet</h3>
          <p className="text-gray-500 mb-6">Add your first question to this package</p>
          <button
            onClick={handleCreate}
            className="btn-animated px-8 py-3 bg-green-600 text-white rounded-xl shadow-lg hover:shadow-green-500/30 transition-all duration-300"
          >
            Add Question
          </button>
        </div>
      )}

      {selectedPackage && questions.length > 0 && (
        <div className="space-y-4">
          {questions.map((question, index) => (
            <div 
              key={question.id} 
              className="group bg-white rounded-2xl shadow-md hover:shadow-2xl border border-gray-100 p-6 transition-all duration-300 transform hover:-translate-y-1 animate-slide-up"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-teal-600 text-white font-bold text-lg shadow-lg group-hover:scale-110 transition-transform duration-300">
                    {index + 1}
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                      Correct: Option {question.correct_option}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                  <button
                    onClick={() => handleEdit(question)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(question.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <p className="text-lg font-semibold text-gray-900 mb-4 pl-14">
                {question.question_text}
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 pl-14">
                {question.options?.map((opt) => (
                  <div
                    key={opt.optionNumber}
                    className={`px-4 py-3 rounded-xl border-2 transition-all duration-300 ${
                      opt.optionNumber === question.correct_option
                        ? 'bg-green-50 border-green-400 text-green-800 font-semibold shadow-md'
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white text-xs font-bold mr-2 shadow-sm">
                      {opt.optionNumber}
                    </span>
                    {opt.optionText}
                  </div>
                ))}
              </div>
              
              {question.explanation && (
                <div className="mt-4 pt-4 border-t border-gray-200 pl-14 animate-fade-in">
                  <div className="flex items-start space-x-2">
                    <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-1">Explanation:</p>
                      <p className="text-sm text-gray-600 leading-relaxed">{question.explanation}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Form (Existing) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowModal(false)}></div>
          
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-scale-in z-10">
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">
                  {editingQuestion ? 'Edit Question' : 'Add New Question'}
                </h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Package *</label>
                  <select
                    name="package_id"
                    value={formData.package_id}
                    onChange={handleInputChange}
                    className="input-animated w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                    disabled={!!editingQuestion}
                  >
                    <option value="">-- Select Package --</option>
                    {packages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id.toString()}>
                        {pkg.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Question Text *</label>
                  <textarea
                    name="question_text"
                    value={formData.question_text}
                    onChange={handleInputChange}
                    rows="3"
                    className="input-animated w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Enter your question..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Options * <span className="text-gray-400 font-normal">(Click "Correct" to mark the right answer)</span>
                  </label>
                  <div className="space-y-3">
                    {formData.options.map((opt, index) => (
                      <div key={index} className="flex items-center space-x-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                        <div className={`w-10 h-10 flex items-center justify-center rounded-full font-bold text-sm shadow-md transition-all duration-300 ${
                          formData.correct_option === opt.optionNumber
                            ? 'bg-gradient-to-br from-green-500 to-teal-600 text-white scale-110'
                            : 'bg-gray-200 text-gray-600'
                        }`}>
                          {opt.optionNumber}
                        </div>
                        <input
                          type="text"
                          value={opt.optionText}
                          onChange={(e) => handleOptionChange(index, e.target.value)}
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                          placeholder={`Option ${opt.optionNumber}`}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, correct_option: opt.optionNumber })}
                          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
                            formData.correct_option === opt.optionNumber
                              ? 'bg-gradient-to-r from-green-600 to-teal-600 text-white shadow-lg scale-105'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {formData.correct_option === opt.optionNumber ? '✓ Correct' : 'Set Correct'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Explanation <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    name="explanation"
                    value={formData.explanation}
                    onChange={handleInputChange}
                    rows="3"
                    className="input-animated w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Explain why the correct answer is right..."
                  />
                </div>

                <div className="flex justify-end space-x-4 pt-6 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-300 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-animated px-8 py-3 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-xl shadow-lg hover:shadow-green-500/30 transition-all duration-300 font-medium"
                  >
                    {editingQuestion ? 'Update Question' : 'Create Question'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowImportModal(false)}></div>
          
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8 animate-scale-in z-10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                Import Questions from CSV
              </h2>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {!selectedPackage ? (
              <div className="text-center py-8 text-red-600">
                <p>Please select a package first!</p>
              </div>
            ) : (
              <>
                <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <p className="text-sm text-blue-800 font-medium mb-2">📋 CSV Format:</p>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Column: <strong>Question</strong> - Your question text</li>
                    <li>• Column: <strong>Options</strong> - Format: "1: Option A | 2: Option B | 3: Option C | 4: Option D"</li>
                    <li>• Column: <strong>Correct Option</strong> - Number (1-4)</li>
                    <li>• Column: <strong>Explanation</strong> - Optional explanation</li>
                  </ul>
                </div>

                <div className="space-y-4">
                  <button
                    onClick={handleDownloadTemplate}
                    className="w-full px-6 py-3 bg-blue-100 text-blue-700 rounded-xl hover:bg-blue-200 transition-all font-medium"
                  >
                    📥 Download CSV Template
                  </button>

                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-purple-500 transition-colors">
                    <input
                      type="file"
                      accept=".csv,.xlsx"
                      onChange={handleImportCSV}
                      disabled={uploading}
                      className="hidden"
                      id="csv-upload"
                    />
                    <label htmlFor="csv-upload" className="cursor-pointer">
                      <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-lg font-medium text-gray-700 mb-2">
                        {uploading ? 'Uploading...' : 'Click to upload CSV/Excel'}
                      </p>
                      <p className="text-sm text-gray-500">Support .csv and .xlsx files</p>
                    </label>
                  </div>

                  {uploading && (
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600 mx-auto"></div>
                      <p className="text-gray-600 mt-4">Importing questions...</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default Questions;