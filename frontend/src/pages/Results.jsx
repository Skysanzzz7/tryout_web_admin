import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import DashboardLayout from '../components/Layout/DashboardLayout';
import api from '../services/api';

const Results = () => {
  const [results, setResults] = useState([]);
  const [packages, setPackages] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Refs for debounce
  const lastSyncRef = useRef(0);
  const syncTimeoutRef = useRef(null);

  const [stats, setStats] = useState({
    totalResults: 0,
    averageScore: 0,
    highestScore: 0,
    lowestScore: 0
  });

  useEffect(() => {
    fetchPackages();
    fetchResults();
    setupFirebaseListener();

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [selectedPackage]);

  const setupFirebaseListener = () => {
    console.log('🔥 Listener Active');
    const examResultsRef = collection(db, 'examResults');
    const q = query(examResultsRef, orderBy('finishedAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('🔥 Change detected in Firebase!');
      
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      
      const now = Date.now();
      if (now - lastSyncRef.current > 3000) {
        syncTimeoutRef.current = setTimeout(() => {
          triggerSync();
          lastSyncRef.current = Date.now();
        }, 3000);
      }
    });

    return () => unsubscribe();
  };

  const triggerSync = async () => {
    setIsSyncing(true);
    try {
      await api.post('/results/sync-latest');
      await fetchResults();
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchPackages = async () => {
    try {
      const { data } = await api.get('/packages');
      setPackages(data.data || []);
    } catch (error) {
      console.error('Fetch packages error:', error);
    }
  };

  const fetchResults = async () => {
    try {
      setLoading(true);
      let url = '/results';
      if (selectedPackage) url = `/results/package/${selectedPackage}`;
      
      const { data } = await api.get(url);
      const resultsData = data.results || [];
      setResults(resultsData);

      if (resultsData.length > 0) {
        const scores = resultsData.map(r => parseFloat(r.score));
        setStats({
          totalResults: resultsData.length,
          averageScore: (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2),
          highestScore: Math.max(...scores),
          lowestScore: Math.min(...scores)
        });
      } else {
        setStats({ totalResults: 0, averageScore: 0, highestScore: 0, lowestScore: 0 });
      }
    } catch (error) {
      console.error('Fetch results error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this result?')) return;
    try {
      await api.delete(`/results/${id}`);
      await fetchResults();
    } catch (error) {
      alert('Failed to delete result: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleExportCSV = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return alert('Please login again');
      const url = selectedPackage 
        ? `/export/results/csv?package_id=${selectedPackage}`
        : '/export/results/csv';
      
      const response = await fetch(`http://localhost:5000/api${url}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `exam_results_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
    } catch (error) {
      alert('Export failed: ' + error.message);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  if (loading && results.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600"></div>
          <p className="text-gray-500 animate-pulse">Loading results...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Header Section */}
      <div className="mb-6 animate-fade-in-up">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              Exam Results
            </h1>
            <p className="text-gray-600 mt-1 text-sm md:text-base">Analyze student performance and scores</p>
          </div>
          
          {/* Live Indicator */}
          <div className={`px-4 py-2 rounded-full border flex items-center space-x-2 transition-all shadow-sm ${
            isSyncing 
              ? 'bg-yellow-50 border-yellow-300 text-yellow-700' 
              : 'bg-white border-gray-200 text-gray-700 hover:border-green-300 hover:bg-green-50'
          }`}>
            <div className={`w-2.5 h-2.5 rounded-full ${isSyncing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
            <span className="text-xs md:text-sm font-bold uppercase tracking-wide">
              {isSyncing ? 'Syncing...' : 'Real-time Active'}
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Export Bar */}
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-slide-up">
        <div className="w-full md:w-1/2 lg:w-1/3">
          <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Filter by Package</label>
          <div className="relative">
            <select 
              value={selectedPackage} 
              onChange={(e) => setSelectedPackage(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm appearance-none cursor-pointer hover:border-gray-400 shadow-sm"
            >
              <option value="">All Packages</option>
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id.toString()}>{pkg.title}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
        
        {results.length > 0 && (
          <button 
            onClick={handleExportCSV} 
            className="btn-animated px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg shadow-md hover:shadow-lg flex items-center space-x-2 transform hover:-translate-y-0.5 transition-all duration-200 text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Export CSV</span>
          </button>
        )}
      </div>

      {/* Stats Cards */}
      {results.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Results', value: stats.totalResults, color: 'text-gray-800', bg: 'bg-white', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
            { label: 'Average Score', value: stats.averageScore, color: 'text-indigo-600', bg: 'bg-indigo-50', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
            { label: 'Highest Score', value: stats.highestScore, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
            { label: 'Lowest Score', value: stats.lowestScore, color: 'text-rose-600', bg: 'bg-rose-50', icon: 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6' }
          ].map((stat, index) => (
            <div 
              key={index} 
              className={`${stat.bg} rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 animate-slide-up`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">{stat.label}</p>
              <div className="flex items-end justify-between">
                <p className={`text-2xl md:text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                <div className="p-1.5 bg-white rounded-lg shadow-sm">
                  <svg className={`w-5 h-5 ${stat.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table Container */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden animate-slide-up delay-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Student</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Package</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Score</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Correct/Wrong</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Duration</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Submitted</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {results.map((result, index) => (
                <tr 
                  key={result.id} 
                  className="hover:bg-gray-50 transition-colors duration-200 group"
                >
                  {/* Student */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-sm group-hover:scale-110 transition-transform duration-300">
                        {result.user_name ? result.user_name.charAt(0).toUpperCase() : 'S'}
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-semibold text-gray-900 truncate max-w-[140px]" title={result.user_name}>
                          {result.user_name || 'Anonymous'}
                        </div>
                        <div className="text-xs text-gray-500 truncate max-w-[140px]" title={result.user_email}>
                          {result.user_email}
                        </div>
                      </div>
                    </div>
                  </td>
                  
                  {/* Package */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-700 line-clamp-1 max-w-[180px]" title={result.package_title}>
                      {result.package_title}
                    </div>
                  </td>
                  
                  {/* Score */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex items-center text-xs font-bold rounded-full border ${getScoreColor(result.score)} shadow-sm transform group-hover:scale-105 transition-all duration-300`}>
                      {result.score}
                    </span>
                  </td>
                  
                  {/* Correct/Wrong */}
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-emerald-600 font-bold">{result.correct_count}</span> 
                      <span className="text-gray-400 text-xs">/</span> 
                      <span className="text-rose-500 font-bold">{result.wrong_count}</span>
                    </div>
                  </td>
                  
                  {/* Duration */}
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 font-medium">
                    {result.duration_minutes} min
                  </td>
                  
                  {/* Submitted */}
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(result.submitted_at)}
                  </td>
                  
                  {/* Action */}
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <button 
                      onClick={() => handleDelete(result.id)}
                      className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-2 rounded-lg transition-all duration-200 transform hover:scale-110"
                      title="Delete Result"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {results.length === 0 && (
          <div className="text-center py-12 animate-scale-in">
            <div className="inline-block animate-float mb-4">
              <svg className="w-16 h-16 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">No results yet</h3>
            <p className="text-sm text-gray-500">
              {selectedPackage ? 'No results for this package yet' : 'Students have not taken any exams yet'}
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Results;