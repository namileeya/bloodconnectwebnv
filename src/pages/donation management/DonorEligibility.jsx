import React, { useState, useEffect } from 'react';
import {
  Search,
  Edit2,
  Trash2,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
} from 'lucide-react';
import Layout from '../../components/Layout';
import './DonorEligibility.css';

// Firebase imports
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  addDoc,
  onSnapshot
} from 'firebase/firestore';
import app from '../../firebase';

const auth = getAuth(app);
const db = getFirestore(app);

const DonorEligibility = ({ onNavigate }) => {
  const [donors, setDonors] = useState([]);
  const [filteredDonors, setFilteredDonors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [eligibilityFilter, setEligibilityFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);
  const [selectedDonor, setSelectedDonor] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [viewMode, setViewMode] = useState('pending'); // 'pending' or 'all'
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState({});

  // Initialize with default admin decision values
  const [adminDecision, setAdminDecision] = useState({
    admin_decision: '',
    display_status: '',
    admin_notes: '',
    decision_date: null,
  });

  // Status mapping
  const statusMapping = {
    'approved': 'Eligible',
    'deferred': 'Temporarily Deferred',
    'rejected': 'Permanently Ineligible'
  };

  // Reverse mapping for dropdown
  const reverseStatusMapping = {
    'Eligible': 'approved',
    'Temporarily Deferred': 'deferred',
    'Permanently Ineligible': 'rejected'
  };

  // Helper function to check if a question should have true=bad or true=good
  const isPositiveQuestion = (question) => {
    // Only "Are you feeling well today?" should have true=good
    // All other questions: true=bad (concerning)
    return question.toLowerCase().includes('are you feeling well today');
  };

  useEffect(() => {
    loadDonors();
    
    // Set up real-time listener for eligibility requests
    const unsubscribe = onSnapshot(
      query(collection(db, 'eligibility_requests'), orderBy('submittedDate', 'desc')),
      (snapshot) => {
        console.log('Real-time update received');
        loadDonors(); // Reload when data changes
      }
    );

    return () => unsubscribe();
  }, [viewMode]);

  useEffect(() => {
    let filtered = [...donors];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.fullName.toLowerCase().includes(term) ||
          d.ic.includes(term) ||
          d.bloodType.toLowerCase().includes(term) ||
          d.userEmail?.toLowerCase().includes(term)
      );
    }

    if (eligibilityFilter !== 'All') {
      filtered = filtered.filter((d) => d.display_status === eligibilityFilter);
    }

    setFilteredDonors(filtered);
    setCurrentPage(1);
  }, [searchTerm, eligibilityFilter, donors]);

  const loadDonors = async () => {
    setLoading(true);
    try {
      console.log('Loading donors...');
      
      // Always get all requests first
      const allRequestsQuery = query(
        collection(db, 'eligibility_requests'),
        orderBy('submittedDate', 'desc')
      );
      const allSnapshot = await getDocs(allRequestsQuery);
      
      console.log(`Total requests in collection: ${allSnapshot.size}`);
      
      const donorsData = [];

      for (const eligibilityDoc of allSnapshot.docs) {
        const eligibilityData = eligibilityDoc.data();
        const userId = eligibilityData.userId;

        // Filter for pending view
        if (viewMode === 'pending') {
          // Check if this request already has a decision
          const hasDecision = eligibilityData.admin_decision && 
            ['approved', 'deferred', 'rejected'].includes(eligibilityData.admin_decision);
          
          const hasDisplayStatus = eligibilityData.display_status && 
            ['Eligible', 'Temporarily Deferred', 'Permanently Ineligible'].includes(eligibilityData.display_status);
          
          // If it already has a decision, skip it in pending view
          if (hasDecision || hasDisplayStatus) {
            continue;
          }
        }

        // Fetch user data
        let userData = {};
        let donorProfile = {};
        let lastDonation = null;

        try {
          // Get user basic info
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            userData = userDoc.data();
          }

          // Get donor profile
          const donorDoc = await getDoc(doc(db, 'donor_profiles', userId));
          if (donorDoc.exists()) {
            donorProfile = donorDoc.data();
          }

          // Get last donation
          const donationsQuery = query(
            collection(db, 'donations'),
            where('donor_id', '==', userId),
            orderBy('donation_date', 'desc'),
            limit(1)
          );
          const donationsSnapshot = await getDocs(donationsQuery);
          if (!donationsSnapshot.empty) {
            const latestDonation = donationsSnapshot.docs[0].data();
            if (latestDonation.donation_date) {
              lastDonation = latestDonation.donation_date.toDate();
            }
          }
        } catch (error) {
          console.error(`Error fetching data for user ${userId}:`, error);
        }

        // Determine display status
        let displayStatus = 'Pending Review';
        if (eligibilityData.admin_decision) {
          displayStatus = statusMapping[eligibilityData.admin_decision] || 'Unknown';
        } else if (eligibilityData.display_status) {
          displayStatus = eligibilityData.display_status;
        }

        // Get concerning answers (answers that might affect eligibility)
        const concerningAnswers = [];
        if (eligibilityData.answers) {
          Object.entries(eligibilityData.answers).forEach(([question, answer]) => {
            const isPositive = isPositiveQuestion(question);
            
            // For "Are you feeling well today?": true = GOOD, false = BAD
            // For all other questions: true = BAD, false = GOOD
            if ((!isPositive && answer === true) || (isPositive && answer === false)) {
              // Shorten long questions for display
              const shortQuestion = question.length > 50 
                ? question.substring(0, 47) + '...' 
                : question;
              concerningAnswers.push(shortQuestion);
            }
          });
        }

        donorsData.push({
          id: eligibilityDoc.id,
          userId: userId,
          // From eligibility_requests
          eligibilityId: eligibilityDoc.id,
          answers: eligibilityData.answers || {},
          submittedDate: eligibilityData.submittedDate?.toDate() || new Date(),
          admin_decision: eligibilityData.admin_decision || null,
          admin_notes: eligibilityData.admin_notes || '',
          decision_date: eligibilityData.decision_date?.toDate() || null,
          // From users collection
          userEmail: userData.email || '',
          phone: userData.phone_number || '',
          // From donor_profiles
          fullName: donorProfile.full_name || eligibilityData.userName || 'Unknown',
          ic: donorProfile.id_number || 'Not provided',
          idType: donorProfile.id_type || 'IC Number',
          bloodType: donorProfile.blood_group || 'Unknown',
          weight: donorProfile.weight || 'Not provided',
          medicalConditions: donorProfile.medical_conditions || 'None',
          allergies: donorProfile.allergies || 'None',
          // Calculated
          display_status: displayStatus,
          lastDonation: lastDonation,
          concerningAnswers: concerningAnswers,
          // For compatibility with existing code
          eligibilityStatus: displayStatus,
          eligibilityReason: eligibilityData.admin_notes || 'Pending review',
          deferralEndDate: null,
        });
      }

      console.log(`Loaded ${donorsData.length} donors for ${viewMode} view`);
      setDonors(donorsData);
      setFilteredDonors(donorsData);

    } catch (error) {
      console.error('Error loading donors:', error);
    } finally {
      setLoading(false);
    }
  };

  // Pagination
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentDonors = filteredDonors.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredDonors.length / itemsPerPage);

  const getEligibilityBadgeClass = (status) => {
    switch (status) {
      case 'Eligible':
        return 'eligibility-eligible';
      case 'Temporarily Deferred':
        return 'eligibility-deferred';
      case 'Permanently Ineligible':
        return 'eligibility-ineligible';
      case 'Pending Review':
        return 'eligibility-pending';
      default:
        return 'eligibility-unknown';
    }
  };

  const getEligibilityIcon = (status) => {
    switch (status) {
      case 'Eligible':
        return <UserCheck className="eligibility-icon" />;
      case 'Temporarily Deferred':
        return <Clock className="eligibility-icon" />;
      case 'Permanently Ineligible':
        return <UserX className="eligibility-icon" />;
      case 'Pending Review':
        return <AlertCircle className="eligibility-icon" />;
      default:
        return null;
    }
  };

  const handleEdit = async (donor) => {
    setSelectedDonor(donor);
    setQuestionnaireAnswers(donor.answers || {});
    
    // Set initial admin decision values
    setAdminDecision({
      admin_decision: donor.admin_decision || '',
      display_status: donor.display_status || '',
      admin_notes: donor.admin_notes || '',
      decision_date: donor.decision_date || null,
    });
    
    setShowEditModal(true);
  };

  const handleSaveEligibility = async () => {
    if (!selectedDonor || !adminDecision.admin_decision) {
      alert('Please select an eligibility status');
      return;
    }

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert('Admin not authenticated');
        return;
      }

      // Update eligibility request with admin decision
      const updateData = {
        admin_decision: adminDecision.admin_decision,
        admin_notes: adminDecision.admin_notes.trim(),
        decision_date: serverTimestamp(),
        decided_by: currentUser.uid,
      };

      await updateDoc(doc(db, 'eligibility_requests', selectedDonor.eligibilityId), updateData);

      // Create notification for user
      const notificationMessage = getNotificationMessage(
        statusMapping[adminDecision.admin_decision],
        adminDecision.admin_notes
      );

      await addDoc(collection(db, 'notifications'), {
        userId: selectedDonor.userId,
        title: 'Eligibility Status Updated',
        message: notificationMessage,
        type: 'eligibility_update',
        data: {
          eligibilityId: selectedDonor.eligibilityId,
          status: statusMapping[adminDecision.admin_decision],
          notes: adminDecision.admin_notes,
        },
        read: false,
        created_at: serverTimestamp(),
        created_by: currentUser.uid,
      });

      // Reload donors
      await loadDonors();
      
      setShowEditModal(false);
      setSelectedDonor(null);
      setAdminDecision({
        admin_decision: '',
        display_status: '',
        admin_notes: '',
        decision_date: null,
      });

      alert('Eligibility status updated and notification sent to user.');

    } catch (error) {
      console.error('Error saving eligibility:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const getNotificationMessage = (status, notes) => {
    switch (status) {
      case 'Eligible':
        return `Your eligibility status has been approved. ${notes ? `Reason: ${notes}` : 'You are now eligible to donate blood.'}`;
      case 'Temporarily Deferred':
        return `Your eligibility is temporarily deferred. ${notes ? `Reason: ${notes}` : 'Please contact the blood bank for more information.'}`;
      case 'Permanently Ineligible':
        return `Your eligibility status: Permanently Ineligible. ${notes ? `Reason: ${notes}` : ''}`;
      default:
        return `Your eligibility status has been updated to: ${status}. ${notes ? `Reason: ${notes}` : ''}`;
    }
  };

  const handleDeleteClick = (id) => {
    setDeletingId(id);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;

    try {
      // Archive instead of delete - add a deleted flag
      await updateDoc(doc(db, 'eligibility_requests', deletingId), {
        archived: true,
        archived_at: serverTimestamp(),
      });

      // Reload donors
      await loadDonors();
      
      setShowDeleteConfirm(false);
      setDeletingId(null);
      alert('Eligibility request archived successfully.');

    } catch (error) {
      console.error('Error archiving eligibility:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderQuestionnaireSummary = (answers) => {
    if (!answers || Object.keys(answers).length === 0) {
      return <p className="text-gray-500">No questionnaire data available</p>;
    }

    const trueAnswers = [];
    const falseAnswers = [];
    
    // Separate answers based on whether they're concerning or not
    Object.entries(answers).forEach(([question, answer]) => {
      const isPositive = isPositiveQuestion(question);
      
      if ((!isPositive && answer === true) || (isPositive && answer === false)) {
        // This is a concerning answer
        trueAnswers.push(question);
      } else {
        // This is a safe answer
        falseAnswers.push(question);
      }
    });

    return (
      <div className="questionnaire-summary">
        <div className="mb-4">
          <h4 className="font-semibold text-red-600 mb-2">
            Concerning Answers ({trueAnswers.length})
          </h4>
          {trueAnswers.length > 0 ? (
            <ul className="list-disc pl-5 space-y-1">
              {trueAnswers.slice(0, 3).map((question, index) => (
                <li key={index} className="text-sm text-red-700">
                  {question.length > 80 ? question.substring(0, 77) + '...' : question}
                </li>
              ))}
              {trueAnswers.length > 3 && (
                <li className="text-sm text-gray-600">
                  ...and {trueAnswers.length - 3} more concerning answers
                </li>
              )}
            </ul>
          ) : (
            <p className="text-green-600 text-sm">No concerning answers ✓</p>
          )}
        </div>
        
        <div>
          <h4 className="font-semibold text-green-600 mb-2">
            Safe Answers ({falseAnswers.length})
          </h4>
          <p className="text-gray-600 text-sm">
            All other questions answered safely
          </p>
        </div>
      </div>
    );
  };

  const renderFullQuestionnaire = (answers) => {
    if (!answers || Object.keys(answers).length === 0) {
      return <p className="text-gray-500">No questionnaire data</p>;
    }

    return (
      <div className="full-questionnaire">
        <h4 className="font-semibold mb-3">Full Questionnaire Answers</h4>
        <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
          {Object.entries(answers).map(([question, answer], index) => {
            const isPositive = isPositiveQuestion(question);
            const isConcerning = (!isPositive && answer === true) || (isPositive && answer === false);
            
            return (
              <div key={index} className={`p-3 rounded ${isConcerning ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                <div className="flex justify-between items-start">
                  <p className="text-sm flex-1">{question}</p>
                  <span className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${isConcerning ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                    {answer ? 'TRUE' : 'FALSE'}
                  </span>
                </div>
                {isConcerning && (
                  <p className="text-xs text-red-600 mt-1">
                    ⚠️ This answer may affect eligibility
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Debug function to check database
  const debugCheckDatabase = async () => {
    console.log('=== DEBUG: Checking eligibility_requests collection ===');
    try {
      const querySnapshot = await getDocs(collection(db, 'eligibility_requests'));
      console.log(`Total documents: ${querySnapshot.size}`);
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`Document ${doc.id}:`, {
          userId: data.userId,
          userName: data.userName,
          admin_decision: data.admin_decision,
          display_status: data.display_status,
          status: data.status,
          submittedDate: data.submittedDate?.toDate?.(),
          hasAnswers: !!data.answers,
          answerCount: data.answers ? Object.keys(data.answers).length : 0,
          hasFeelingWellQuestion: data.answers ? 'Are you feeling well today?' in data.answers : false,
          feelingWellAnswer: data.answers ? data.answers['Are you feeling well today?'] : null
        });
      });
      
      alert(`Check console for database details. Found ${querySnapshot.size} eligibility requests.`);
    } catch (error) {
      console.error('Debug error:', error);
      alert('Error checking database. See console.');
    }
  };

  if (loading) {
    return (
      <Layout onNavigate={onNavigate} currentPage="donor-eligibility">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading donor eligibility...</p>
        </div>
      </Layout>
    );
  }

  const stats = {
    total: donors.length,
    eligible: donors.filter((d) => d.display_status === 'Eligible').length,
    deferred: donors.filter((d) => d.display_status === 'Temporarily Deferred').length,
    ineligible: donors.filter((d) => d.display_status === 'Permanently Ineligible').length,
    pending: donors.filter((d) => d.display_status === 'Pending Review').length,
  };

  return (
    <Layout onNavigate={onNavigate} currentPage="donor-eligibility">
      <div className="eligibility-page">
        {/* Debug Button */}
        <button 
          onClick={debugCheckDatabase}
          className="debug-button"
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 1000,
            padding: '8px 12px',
            background: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Debug DB
        </button>

        {/* Header */}
        <div className="eligibility-header-container">
          <h1 className="eligibility-header-title">Donor Eligibility Management</h1>
          <p className="eligibility-header-subtitle">Review and update donor eligibility status</p>
        </div>

        {/* View Mode Tabs */}
        <div className="view-mode-tabs">
          <button
            className={`tab-btn ${viewMode === 'pending' ? 'active' : ''}`}
            onClick={() => setViewMode('pending')}
          >
            <AlertCircle size={18} />
            Pending Review ({stats.pending})
          </button>
          <button
            className={`tab-btn ${viewMode === 'all' ? 'active' : ''}`}
            onClick={() => setViewMode('all')}
          >
            All Decisions ({stats.total})
          </button>
        </div>

        {/* Stats */}
        <div className="eligibility-stats-grid">
          <div className="eligibility-stat-card total">
            <h3 className="stat-number">{stats.total}</h3>
            <p className="stat-label">Total Requests</p>
          </div>
          <div className="eligibility-stat-card pending">
            <h3 className="stat-number">{stats.pending}</h3>
            <p className="stat-label">Pending Review</p>
          </div>
          <div className="eligibility-stat-card eligible">
            <h3 className="stat-number">{stats.eligible}</h3>
            <p className="stat-label">Eligible</p>
          </div>
          <div className="eligibility-stat-card deferred">
            <h3 className="stat-number">{stats.deferred}</h3>
            <p className="stat-label">Temporarily Deferred</p>
          </div>
          <div className="eligibility-stat-card ineligible">
            <h3 className="stat-number">{stats.ineligible}</h3>
            <p className="stat-label">Permanently Ineligible</p>
          </div>
        </div>

        {/* Filters */}
        <div className="eligibility-filters-container">
          <div className="eligibility-filters-grid">
            <div className="eligibility-search-container">
              <label className="eligibility-filter-label">Search Donors</label>
              <div className="eligibility-search-input-container">
                <Search className="eligibility-search-icon" />
                <input
                  type="text"
                  placeholder="Search by name, IC, email, or blood type..."
                  className="eligibility-search-input"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="eligibility-filter-select-container">
              <label className="eligibility-filter-label">Filter by Status</label>
              <select
                className="eligibility-status-filter"
                value={eligibilityFilter}
                onChange={(e) => setEligibilityFilter(e.target.value)}
              >
                <option value="All">All Status</option>
                <option value="Pending Review">Pending Review</option>
                <option value="Eligible">Eligible</option>
                <option value="Temporarily Deferred">Temporarily Deferred</option>
                <option value="Permanently Ineligible">Permanently Ineligible</option>
              </select>
            </div>
          </div>
        </div>

        {/* Donor Cards Grid */}
        <div className="eligibility-grid">
          {currentDonors.length === 0 ? (
            <div className="eligibility-empty-state">
              <Search className="empty-icon" />
              <h3>No {viewMode === 'pending' ? 'pending ' : ''}donors found</h3>
              <p>Try adjusting your search or filters</p>
              <button 
                onClick={debugCheckDatabase}
                className="debug-link"
                style={{
                  marginTop: '10px',
                  background: 'transparent',
                  border: 'none',
                  color: '#dc2626',
                  textDecoration: 'underline',
                  cursor: 'pointer'
                }}
              >
                Check database for requests
              </button>
            </div>
          ) : (
            currentDonors.map((donor) => (
              <div key={donor.id} className="eligibility-card">
                <div className="eligibility-card-header">
                  <div className="donor-avatar">
                    {donor.fullName.split(' ').map((n) => n[0]).join('').substring(0, 2)}
                  </div>
                  <div className="donor-info">
                    <h3 className="donor-name">{donor.fullName}</h3>
                    <p className="donor-ic">
                      {donor.idType}: {donor.ic}
                    </p>
                    <div className="donor-tags">
                      <span className="blood-type-tag">{donor.bloodType}</span>
                      <span className={`eligibility-badge ${getEligibilityBadgeClass(donor.display_status)}`}>
                        {getEligibilityIcon(donor.display_status)}
                        {donor.display_status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="eligibility-card-body">
                  <div className="eligibility-meta">
                    <div className="meta-item">
                      <span className="meta-label">Submitted:</span>
                      <span className="meta-value">{formatDateTime(donor.submittedDate)}</span>
                    </div>
                    {donor.decision_date && (
                      <div className="meta-item">
                        <span className="meta-label">Decided:</span>
                        <span className="meta-value">{formatDateTime(donor.decision_date)}</span>
                      </div>
                    )}
                    {donor.lastDonation && (
                      <div className="meta-item">
                        <span className="meta-label">Last Donation:</span>
                        <span className="meta-value">{formatDate(donor.lastDonation)}</span>
                      </div>
                    )}
                  </div>

                  {/* Questionnaire Summary */}
                  {renderQuestionnaireSummary(donor.answers)}

                  {donor.admin_notes && (
                    <div className="admin-notes">
                      <span className="notes-label">Admin Notes:</span>
                      <span className="notes-value">{donor.admin_notes}</span>
                    </div>
                  )}
                </div>

                <div className="eligibility-card-actions">
                  <button onClick={() => handleEdit(donor)} className="action-btn edit-btn">
                    <Edit2 size={16} /> 
                    {donor.admin_decision ? 'Update Decision' : 'Review Eligibility'}
                  </button>
                  {viewMode === 'pending' && (
                    <button onClick={() => handleDeleteClick(donor.id)} className="action-btn delete-btn">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {filteredDonors.length > 0 && (
          <div className="eligibility-pagination">
            <div className="pagination-info">
              <span>Items per page:</span>
              <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} className="items-select">
                <option value={6}>6</option>
                <option value={8}>8</option>
                <option value={12}>12</option>
                <option value={16}>16</option>
              </select>
              <span className="range">
                {startIndex + 1}-{Math.min(endIndex, filteredDonors.length)} of {filteredDonors.length}
              </span>
            </div>
            <div className="pagination-controls">
              <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && selectedDonor && (
          <div className="eligibility-modal-overlay">
            <div className="eligibility-modal large-modal">
              <div className="modal-header">
                <h2>Review Donor Eligibility</h2>
                <button onClick={() => setShowEditModal(false)} className="close-btn">
                  <X size={20} />
                </button>
              </div>
              
              <div className="modal-body">
                {/* Donor Info */}
                <div className="donor-header">
                  <h3>{selectedDonor.fullName}</h3>
                  <p>{selectedDonor.idType}: {selectedDonor.ic} • {selectedDonor.bloodType}</p>
                  <p className="text-sm text-gray-600">Email: {selectedDonor.userEmail}</p>
                  <p className="text-sm text-gray-600">Submitted: {formatDateTime(selectedDonor.submittedDate)}</p>
                </div>

                {/* Medical Info */}
                <div className="medical-info-section">
                  <h4 className="section-title">Medical Information</h4>
                  <div className="medical-grid">
                    <div className="medical-item">
                      <span className="medical-label">Weight:</span>
                      <span className="medical-value">{selectedDonor.weight} kg</span>
                    </div>
                    <div className="medical-item">
                      <span className="medical-label">Conditions:</span>
                      <span className="medical-value">{selectedDonor.medicalConditions}</span>
                    </div>
                    <div className="medical-item">
                      <span className="medical-label">Allergies:</span>
                      <span className="medical-value">{selectedDonor.allergies}</span>
                    </div>
                    {selectedDonor.lastDonation && (
                      <div className="medical-item">
                        <span className="medical-label">Last Donation:</span>
                        <span className="medical-value">{formatDate(selectedDonor.lastDonation)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Questionnaire Answers */}
                <div className="questionnaire-section">
                  <h4 className="section-title">Questionnaire Answers</h4>
                  {renderFullQuestionnaire(questionnaireAnswers)}
                </div>

                {/* Admin Decision Form */}
                <div className="decision-form">
                  <h4 className="section-title">Make Decision</h4>
                  
                  <div className="form-group">
                    <label>Eligibility Status *</label>
                    <select
                      value={adminDecision.display_status}
                      onChange={(e) => {
                        const displayStatus = e.target.value;
                        const adminDecisionValue = reverseStatusMapping[displayStatus] || '';
                        setAdminDecision({
                          ...adminDecision,
                          display_status: displayStatus,
                          admin_decision: adminDecisionValue,
                        });
                      }}
                      className="form-select"
                      required
                    >
                      <option value="">Select status</option>
                      <option value="Eligible">Eligible</option>
                      <option value="Temporarily Deferred">Temporarily Deferred</option>
                      <option value="Permanently Ineligible">Permanently Ineligible</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Reason / Notes *</label>
                    <textarea
                      value={adminDecision.admin_notes}
                      onChange={(e) => setAdminDecision({
                        ...adminDecision,
                        admin_notes: e.target.value
                      })}
                      rows="3"
                      className="form-textarea"
                      placeholder="Provide reason for your decision. This will be included in the notification sent to the donor."
                      required
                    />
                    <p className="form-hint">This note will be sent to the donor in the notification.</p>
                  </div>

                  <div className="notification-preview">
                    <h5 className="preview-title">Notification Preview:</h5>
                    <div className="preview-content">
                      {adminDecision.display_status ? (
                        <p>{getNotificationMessage(adminDecision.display_status, adminDecision.admin_notes)}</p>
                      ) : (
                        <p className="text-gray-500">Select a status to see preview</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button onClick={() => setShowEditModal(false)} className="cancel-btn">Cancel</button>
                <button 
                  onClick={handleSaveEligibility} 
                  className="save-btn"
                  disabled={!adminDecision.admin_decision || !adminDecision.admin_notes.trim()}
                >
                  Save Decision & Send Notification
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="eligibility-modal-overlay">
            <div className="confirm-modal">
              <AlertCircle className="confirm-icon" />
              <h3>Archive Eligibility Request?</h3>
              <p>This will archive the request. The user will need to submit a new request.</p>
              <div className="confirm-actions">
                <button onClick={() => setShowDeleteConfirm(false)} className="cancel-btn">Cancel</button>
                <button onClick={handleDeleteConfirm} className="delete-confirm-btn">Archive</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default DonorEligibility;