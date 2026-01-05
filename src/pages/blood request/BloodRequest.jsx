import React, { useState, useEffect } from 'react';
import { 
  Search, Eye, Check, X, Calendar, MapPin, AlertCircle, 
  ChevronLeft, ChevronRight, Loader2, RefreshCw, Edit2 
} from 'lucide-react';
import Layout from '../../components/Layout';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot,
  doc, 
  updateDoc, 
  serverTimestamp,
  getDocs,
  where,
  addDoc,
  getDoc
} from 'firebase/firestore';
import { db } from '../../firebase';
import './BloodRequest.css';

const BloodRequest = ({ onNavigate }) => {
  // State
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(() => {
    const savedFilters = localStorage.getItem('bloodRequestFilters');
    return savedFilters ? JSON.parse(savedFilters) : {
      status: 'All',
      bloodType: 'All',
      urgency: 'All',
      search: ''
    };
  });
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showUrgencyModal, setShowUrgencyModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedUrgency, setSelectedUrgency] = useState('Medium');
  const [updatingId, setUpdatingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);
  const [showToast, setShowToast] = useState({ show: false, message: '', type: '' });

  // Custom Toast Notification
  const displayToast = (message, type = 'success') => {
    setShowToast({ show: true, message, type });
    setTimeout(() => {
      setShowToast({ show: false, message: '', type: '' });
    }, 3000);
  };

  // Format Firebase timestamp
  const formatFirebaseTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    try {
      if (timestamp.toDate) {
        const date = timestamp.toDate();
        return date.toLocaleString('en-MY', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }).replace(',', '');
      }
      
      if (typeof timestamp === 'string') {
        return timestamp;
      }
      
      return 'Invalid date';
    } catch (err) {
      console.error('Error formatting timestamp:', err);
      return 'Invalid date';
    }
  };

  // Get user contact info from users collection
  const getUserContactInfo = async (userId) => {
    try {
      if (!userId) return { email: 'N/A', phone: 'N/A' };
      
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          email: userData.email || 'N/A',
          phone: userData.phone_number || userData.contact_number || 'N/A'
        };
      }
      
      // Try donor_profiles as fallback
      const donorRef = doc(db, 'donor_profiles', userId);
      const donorDoc = await getDoc(donorRef);
      
      if (donorDoc.exists()) {
        const donorData = donorDoc.data();
        return {
          email: donorData.email || 'N/A',
          phone: donorData.emergency_contact_phone || 'N/A'
        };
      }
      
      return { email: 'N/A', phone: 'N/A' };
    } catch (err) {
      console.error('Error fetching user info:', err);
      return { email: 'N/A', phone: 'N/A' };
    }
  };

  // Initialize real-time listener with user contact info
  useEffect(() => {
    console.log('Setting up Firebase listener for blood_requests...');
    setLoading(true);
    
    try {
      const q = query(
        collection(db, 'blood_requests'),
        orderBy('created_at', 'desc')
      );

      const unsubscribe = onSnapshot(q, 
        async (snapshot) => {
          console.log('Firebase snapshot received for blood_requests:', {
            size: snapshot.size,
            empty: snapshot.empty
          });
          
          const requestsData = [];
          
          // Process all documents and fetch contact info
          for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            
            // Get user contact info
            const contactInfo = await getUserContactInfo(data.user_id);
            
            requestsData.push({
              id: docSnap.id,
              requestId: `BR-${docSnap.id.slice(0, 4).toUpperCase()}-${new Date(data.created_at?.toDate?.() || Date.now()).getFullYear()}`,
              patientName: data.patient_name || 'N/A',
              bloodType: data.blood_group || 'N/A',
              urgency: data.urgency || 'Medium',
              status: data.status?.toLowerCase() || 'pending',
              location: data.patient_location || 'N/A',
              requesterName: data.requester_name || 'N/A',
              userEmail: contactInfo.email, // From users collection
              contactNumber: contactInfo.phone, // From users collection
              requestDate: formatFirebaseTimestamp(data.created_at),
              reason: data.reasons || 'No reason provided',
              userId: data.user_id,
              rejectionReason: data.rejection_reason || '',
              adminNotes: data.admin_notes || ''
            });
          }

          console.log('Processed requests:', requestsData);
          
          setRequests(requestsData);
          setLoading(false);
          
          if (requestsData.length > 0) {
            displayToast(`Loaded ${requestsData.length} blood request(s)`, 'success');
          } else {
            displayToast('No blood requests found in database', 'info');
          }
        },
        (error) => {
          console.error('Firebase listener error:', error);
          setError(`Failed to load requests: ${error.message}`);
          setLoading(false);
          displayToast('Connection error. Please check Firebase configuration.', 'error');
        }
      );

      return () => {
        console.log('Cleaning up Firebase listener');
        unsubscribe();
      };
    } catch (err) {
      console.error('Setup error:', err);
      setError(`Setup failed: ${err.message}`);
      setLoading(false);
      displayToast('Failed to initialize. Please refresh.', 'error');
    }
  }, []);

  // Save filters to localStorage
  useEffect(() => {
    localStorage.setItem('bloodRequestFilters', JSON.stringify(filters));
  }, [filters]);

  // Apply filters
  useEffect(() => {
    if (loading) return;

    let filtered = [...requests];

    if (filters.status !== 'All') {
      filtered = filtered.filter(req => 
        req.status.toLowerCase() === filters.status.toLowerCase()
      );
    }

    if (filters.bloodType !== 'All') {
      filtered = filtered.filter(req => req.bloodType === filters.bloodType);
    }

    if (filters.urgency !== 'All') {
      filtered = filtered.filter(req => 
        req.urgency.toLowerCase() === filters.urgency.toLowerCase()
      );
    }

    if (filters.search.trim()) {
      const searchTerm = filters.search.toLowerCase().trim();
      filtered = filtered.filter(req =>
        req.patientName.toLowerCase().includes(searchTerm) ||
        req.requestId.toLowerCase().includes(searchTerm) ||
        req.requesterName.toLowerCase().includes(searchTerm) ||
        req.userEmail.toLowerCase().includes(searchTerm)
      );
    }

    setFilteredRequests(filtered);
    setCurrentPage(1);
  }, [filters, requests, loading]);

  // Get matching donors for a blood type
  const getMatchingDonors = async (bloodType) => {
    try {
      const donorsQuery = query(
        collection(db, 'donor_profiles'),
        where('blood_group', '==', bloodType)
      );
      
      const snapshot = await getDocs(donorsQuery);
      const donors = [];
      snapshot.forEach(doc => {
        donors.push({
          id: doc.id,
          ...doc.data(),
          userId: doc.data().user_id
        });
      });
      console.log(`Found ${donors.length} donors with blood type ${bloodType}`);
      return donors;
    } catch (error) {
      console.error('Error fetching donors:', error);
      displayToast('Failed to fetch matching donors', 'error');
      return [];
    }
  };

  // Create notification in Firebase
  const createNotification = async (notificationData) => {
    try {
      console.log('Creating notification in Firebase:', notificationData);
      
      // Add the notification to Firebase
      const notificationRef = await addDoc(collection(db, 'notifications'), {
        ...notificationData,
        created_at: serverTimestamp(),
        read: false
      });
      
      console.log('Notification created successfully with ID:', notificationRef.id);
      return true;
    } catch (error) {
      console.error('Error creating notification in Firebase:', error);
      displayToast('Failed to create notification', 'error');
      return false;
    }
  };

  // Update request urgency
  const updateRequestUrgency = async (requestId, newUrgency) => {
    try {
      setUpdatingId(requestId);
      setError('');

      const requestRef = doc(db, 'blood_requests', requestId);
      
      await updateDoc(requestRef, {
        urgency: newUrgency,
        updated_at: serverTimestamp()
      });

      // Update local state immediately
      setRequests(prevRequests => 
        prevRequests.map(req => 
          req.id === requestId 
            ? { ...req, urgency: newUrgency }
            : req
        )
      );

      // Also update selectedRequest if it's open in modal
      if (selectedRequest && selectedRequest.id === requestId) {
        setSelectedRequest(prev => ({ ...prev, urgency: newUrgency }));
      }

      displayToast(`Urgency updated to ${newUrgency}`, 'success');
      return true;

    } catch (err) {
      console.error('Error updating urgency:', err);
      setError(`Failed to update urgency: ${err.message}`);
      displayToast('Failed to update urgency', 'error');
      return false;
    } finally {
      setUpdatingId(null);
      setShowUrgencyModal(false);
    }
  };

  // Handle urgency change click
  const handleUrgencyChange = (request) => {
    setSelectedRequest(request);
    setSelectedUrgency(request.urgency || 'Medium');
    setShowUrgencyModal(true);
  };

  // Update request status with notifications - FIXED STATUS UPDATE
  const updateRequestStatus = async (requestId, newStatus, reason = '') => {
    try {
      setUpdatingId(requestId);
      setError('');

      const requestRef = doc(db, 'blood_requests', requestId);
      const updateData = {
        status: newStatus.toLowerCase(),
        updated_at: serverTimestamp()
      };

      if (newStatus.toLowerCase() === 'rejected' && reason) {
        updateData.rejection_reason = reason;
      }

      console.log('Updating request:', { requestId, newStatus, reason });
      
      // 1. First update the request status
      await updateDoc(requestRef, updateData);
      console.log('Request status updated successfully');

      // 2. Get request data for notifications
      const request = requests.find(req => req.id === requestId);
      if (!request) {
        console.error('Request not found in local state:', requestId);
        displayToast('Request updated but notification failed', 'warning');
        return true;
      }

      // 3. Create notification for requester
      const requesterNotification = {
        userId: request.userId,
        type: 'eligibility_update',
        title: `Blood Request ${newStatus}`,
        message: `Your blood request has been ${newStatus.toLowerCase()}.${reason ? ` Reason: ${reason}` : ''}`,
        // TOP LEVEL FIELDS for easy filtering
        isBloodRequest: true,
        notificationCategory: 'blood_request',
        notificationType: 'blood_request_status',
        data: {
          requestId: request.id,
          status: newStatus.toLowerCase(),
          reason: reason || '',
          bloodType: request.bloodType,
          location: request.location,
          patientName: request.patientName,
          eligibilityId: request.id,
          notes: reason || (newStatus.toLowerCase() === 'approved' ? 'Your blood request has been approved.' : 'Blood request has been processed.'),
        },
        created_by: 'system'
      };

      const requesterNotifSuccess = await createNotification(requesterNotification);
      console.log('Requester notification created:', requesterNotifSuccess);

      // 4. If approved, notify matching donors
      if (newStatus.toLowerCase() === 'approved') {
        console.log('Looking for matching donors for blood type:', request.bloodType);
        const matchingDonors = await getMatchingDonors(request.bloodType);
        
        let donorNotificationsCount = 0;
        
        for (const donor of matchingDonors) {
          // Don't notify the requester again
          if (donor.userId !== request.userId) {
            const donorNotification = {
              userId: donor.userId,
              type: 'donation',
              title: 'Urgent Blood Request',
              message: `Urgent: ${request.bloodType} blood needed at ${request.location}. Patient: ${request.patientName}.`,
              // TOP LEVEL FIELDS for easy filtering
              isBloodRequest: true,
              notificationCategory: 'blood_request',
              notificationType: 'blood_request_alert',
              data: {
                requestId: request.id,
                bloodType: request.bloodType,
                location: request.location,
                patientName: request.patientName,
                urgency: request.urgency || 'High',
                patientBloodType: request.bloodType,
                hospitalLocation: request.location,
                requestDate: request.requestDate
              },
              created_by: 'system'
            };
            
            await createNotification(donorNotification);
            donorNotificationsCount++;
          }
        }
        
        console.log(`Created ${donorNotificationsCount} donor notifications`);
      }

      // 5. Update local state immediately for UI responsiveness
      setRequests(prevRequests => 
        prevRequests.map(req => 
          req.id === requestId 
            ? { ...req, status: newStatus.toLowerCase(), rejectionReason: reason || req.rejectionReason }
            : req
        )
      );

      displayToast(`Request ${newStatus.toLowerCase()} successfully! Notifications sent.`, 'success');
      return true;

    } catch (err) {
      console.error('Update error:', err);
      setError(`Failed to update: ${err.message}`);
      displayToast('Failed to update. Please try again.', 'error');
      return false;
    } finally {
      setUpdatingId(null);
    }
  };

  // Handle status change
  const handleStatusChange = async (requestId, newStatus) => {
    if (newStatus.toLowerCase() === 'rejected') {
      setSelectedRequest(requests.find(req => req.id === requestId));
      setShowRejectModal(true);
    } else {
      const success = await updateRequestStatus(requestId, newStatus);
      if (success && showModal) {
        setShowModal(false);
      }
    }
  };

  // Handle reject with reason
  const handleRejectWithReason = async () => {
    if (!rejectReason.trim() || rejectReason.trim().length < 10) {
      displayToast('Please provide a valid reason (min 10 chars)', 'error');
      return;
    }

    if (selectedRequest) {
      const success = await updateRequestStatus(selectedRequest.id, 'rejected', rejectReason.trim());
      if (success) {
        setShowRejectModal(false);
        setShowModal(false);
        setRejectReason('');
      }
    }
  };

  // Handle view details
  const handleViewDetails = (request) => {
    setSelectedRequest(request);
    setShowModal(true);
  };

  // Pagination
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRequests = filteredRequests.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  // Status and urgency styling
  const getStatusClasses = (status) => {
    const statusLower = status.toLowerCase();
    switch (statusLower) {
      case 'pending': return 'status-pending';
      case 'approved': return 'status-approved';
      case 'rejected': return 'status-rejected';
      default: return 'status-default';
    }
  };

  const getUrgencyClasses = (urgency) => {
    const urgencyLower = urgency.toLowerCase();
    switch (urgencyLower) {
      case 'critical': return 'urgency-critical';
      case 'high': return 'urgency-high';
      case 'medium': return 'urgency-medium';
      case 'low': return 'urgency-low';
      default: return 'urgency-default';
    }
  };

  // Stats calculation
  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status.toLowerCase() === 'pending').length,
    approved: requests.filter(r => r.status.toLowerCase() === 'approved').length,
    critical: requests.filter(r => r.urgency.toLowerCase() === 'critical').length
  };

  // Refresh data
  const handleRefresh = () => {
    setLoading(true);
    window.location.reload();
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      status: 'All',
      bloodType: 'All',
      urgency: 'All',
      search: ''
    });
    displayToast('Filters cleared', 'success');
  };

  if (loading && requests.length === 0) {
    return (
      <Layout onNavigate={onNavigate} currentPage="blood-request">
        <div className="loading-container">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <p className="loading-text">Loading blood requests...</p>
            <p className="text-sm text-gray-500 mt-2">Connecting to Firebase collection: blood_requests</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout onNavigate={onNavigate} currentPage="blood-request">
      {/* Toast Notification */}
      {showToast.show && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transition-all duration-300 ${
          showToast.type === 'success' 
            ? 'bg-green-500 text-white' 
            : showToast.type === 'error'
            ? 'bg-red-500 text-white'
            : 'bg-blue-500 text-white'
        }`}>
          <div className="flex items-center gap-2">
            {showToast.type === 'success' ? (
              <Check className="w-5 h-5" />
            ) : showToast.type === 'error' ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span>{showToast.message}</span>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="header-container">
          <div>
            <h1 className="header-title">Blood Request Management</h1>
            <p className="text-sm text-gray-600 mt-1">
              Collection: <span className="font-mono bg-gray-100 px-2 py-1 rounded">blood_requests</span>
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="refresh-button flex items-center gap-2"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <RefreshCw size={16} />
            )}
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-container">
            <AlertCircle className="error-icon" />
            <p className="error-text">{error}</p>
            <button
              onClick={() => setError('')}
              className="error-close"
            >
              <X className="error-close-icon" />
            </button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card stat-card-total">
            <h3 className="stat-number-blue">{stats.total}</h3>
            <p className="stat-label">Total Requests</p>
          </div>
          <div className="stat-card stat-card-pending">
            <h3 className="stat-number-yellow">{stats.pending}</h3>
            <p className="stat-label">Pending Approval</p>
          </div>
          <div className="stat-card stat-card-approved">
            <h3 className="stat-number-green">{stats.approved}</h3>
            <p className="stat-label">Approved Requests</p>
          </div>
          <div className="stat-card stat-card-critical">
            <h3 className="stat-number-red">{stats.critical}</h3>
            <p className="stat-label">Critical Cases</p>
          </div>
        </div>

        {/* Filters */}
        <div className="filters-container">
          <div className="filters-grid">
            <div className="search-container">
              <label className="filter-label">Search Requests</label>
              <div className="search-input-container">
                <Search className="search-icon" />
                <input
                  type="text"
                  placeholder="Search by patient name, request ID, requester, or email..."
                  className="search-input"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
              </div>
            </div>
            <div className="filter-select-container">
              <label className="filter-label">Status</label>
              <select
                className="filter-select"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="All">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            <div className="filter-select-container">
              <label className="filter-label">Blood Type</label>
              <select
                className="filter-select"
                value={filters.bloodType}
                onChange={(e) => setFilters({ ...filters, bloodType: e.target.value })}
              >
                <option value="All">All Types</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>
            <div className="filter-select-container">
              <label className="filter-label">Urgency</label>
              <select
                className="filter-select"
                value={filters.urgency}
                onChange={(e) => setFilters({ ...filters, urgency: e.target.value })}
              >
                <option value="All">All Urgency</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-between items-center">
            <span className="text-sm text-gray-600">
              Showing {filteredRequests.length} of {requests.length} request(s)
            </span>
            <button
              onClick={clearFilters}
              className="text-sm text-red-600 hover:text-red-800 font-medium"
            >
              Clear all filters
            </button>
          </div>
        </div>

        {/* Requests Table */}
        <div className="table-container">
          <div className="table-wrapper">
            {loading && (
              <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-10">
                <Loader2 className="animate-spin text-red-600" size={32} />
                <span className="ml-3 text-gray-600">Loading data...</span>
              </div>
            )}
            
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-header-cell">REQUEST INFO</th>
                  <th className="table-header-cell">PATIENT DETAILS</th>
                  <th className="table-header-cell">REQUESTER INFO</th>
                  <th className="table-header-cell">BLOOD TYPE</th>
                  <th className="table-header-cell">URGENCY</th>
                  <th className="table-header-cell">STATUS</th>
                  <th className="table-header-cell">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {paginatedRequests.length > 0 ? (
                  paginatedRequests.map((request) => (
                    <tr key={request.id} className="table-row">
                      <td className="table-cell">
                        <div className="table-cell-content">
                          <div className="request-id">{request.requestId}</div>
                          <div className="request-date">
                            <Calendar className="date-icon" />
                            {request.requestDate}
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="table-cell-content">
                          <div className="patient-name">{request.patientName}</div>
                          <div className="patient-location">
                            <MapPin className="location-icon" />
                            {request.location}
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="table-cell-content">
                          <div className="requester-name">{request.requesterName}</div>
                          <div className="requester-email">{request.userEmail}</div>
                          <div className="requester-phone text-xs text-gray-600">
                            {request.contactNumber}
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className="blood-type-badge">
                          {request.bloodType}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`urgency-badge ${getUrgencyClasses(request.urgency)}`}>
                            {request.urgency}
                          </span>
                          <button
                            onClick={() => handleUrgencyChange(request)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline flex items-center gap-1"
                            disabled={updatingId === request.id}
                          >
                            <Edit2 size={12} />
                            Change
                          </button>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className={`status-badge ${getStatusClasses(request.status)}`}>
                          {request.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="actions-container">
                          <button
                            onClick={() => handleViewDetails(request)}
                            className="action-button view-button"
                            title="View Details"
                          >
                            <Eye className="action-icon" />
                          </button>
                          {request.status.toLowerCase() === 'pending' && (
                            <>
                              <button
                                onClick={() => handleStatusChange(request.id, 'Approved')}
                                className="action-button approve-button"
                                title="Approve Request"
                                disabled={updatingId === request.id}
                              >
                                {updatingId === request.id ? (
                                  <Loader2 className="action-icon animate-spin" />
                                ) : (
                                  <Check className="action-icon" />
                                )}
                              </button>
                              <button
                                onClick={() => handleStatusChange(request.id, 'Rejected')}
                                className="action-button reject-button"
                                title="Reject Request"
                                disabled={updatingId === request.id}
                              >
                                {updatingId === request.id ? (
                                  <Loader2 className="action-icon animate-spin" />
                                ) : (
                                  <X className="action-icon" />
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="text-center py-8">
                      <div className="empty-state">
                        <div className="empty-state-icon">
                          <Search />
                        </div>
                        <h3 className="empty-state-title">
                          {requests.length === 0 
                            ? "No blood requests found" 
                            : "No matching requests"}
                        </h3>
                        <p className="empty-state-description">
                          {requests.length === 0 
                            ? "There are no blood requests in the database yet."
                            : "Try adjusting your search or filter criteria."}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredRequests.length > 0 && (
            <div className="blood-request-pagination">
              <div className="blood-request-pagination-info">
                <span>Items per page:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                  className="blood-request-items-per-page-select"
                >
                  <option value={6}>6</option>
                  <option value={8}>8</option>
                  <option value={12}>12</option>
                  <option value={16}>16</option>
                </select>
                <span className="blood-request-pagination-range">
                  {startIndex + 1}-{Math.min(endIndex, filteredRequests.length)} of {filteredRequests.length}
                </span>
              </div>

              <div className="blood-request-pagination-controls">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="blood-request-pagination-btn"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm text-gray-600 mx-4">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="blood-request-pagination-btn"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal for Request Details */}
        {showModal && selectedRequest && (
          <div className="modal-overlay">
            <div className="modal-container">
              <div className="modal-header">
                <div className="modal-header-content">
                  <h2 className="modal-title">Blood Request Details</h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="modal-close"
                  >
                    <X className="modal-close-icon" />
                  </button>
                </div>
              </div>

              <div className="modal-body">
                <div className="modal-grid">
                  <div className="modal-section">
                    <div className="modal-field modal-field-highlighted">
                      <label className="modal-field-label">Request ID</label>
                      <p className="modal-field-value-large">{selectedRequest.requestId}</p>
                    </div>
                    <div className="modal-field">
                      <label className="modal-field-label">Patient Name</label>
                      <p className="modal-field-value">{selectedRequest.patientName}</p>
                    </div>
                    <div className="modal-field">
                      <label className="modal-field-label">Blood Type</label>
                      <span className="blood-type-badge" style={{ fontSize: '16px', padding: '6px 14px' }}>
                        {selectedRequest.bloodType}
                      </span>
                    </div>
                    <div className="modal-field">
                      <label className="modal-field-label">Urgency Level</label>
                      <div className="flex items-center gap-2">
                        <span className={`urgency-badge ${getUrgencyClasses(selectedRequest.urgency)}`} style={{ padding: '6px 14px' }}>
                          {selectedRequest.urgency}
                        </span>
                        <button
                          onClick={() => {
                            setShowModal(false);
                            handleUrgencyChange(selectedRequest);
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                        >
                          <Edit2 size={14} />
                          Change
                        </button>
                      </div>
                    </div>
                    <div className="modal-field">
                      <label className="modal-field-label">Current Status</label>
                      <span className={`status-badge ${getStatusClasses(selectedRequest.status)}`} style={{ padding: '6px 14px' }}>
                        {selectedRequest.status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="modal-section">
                    <div className="modal-field">
                      <label className="modal-field-label">Requester Name</label>
                      <p className="modal-field-value">{selectedRequest.requesterName}</p>
                    </div>
                    <div className="modal-field">
                      <label className="modal-field-label">Contact Email</label>
                      <p className="modal-field-value">{selectedRequest.userEmail}</p>
                    </div>
                    <div className="modal-field">
                      <label className="modal-field-label">Contact Number</label>
                      <p className="modal-field-value">{selectedRequest.contactNumber}</p>
                    </div>
                    <div className="modal-field">
                      <label className="modal-field-label">Patient Location</label>
                      <p className="modal-field-value-location">
                        <MapPin className="modal-location-icon" />
                        <span style={{ fontWeight: 500 }}>{selectedRequest.location}</span>
                      </p>
                    </div>
                    <div className="modal-field">
                      <label className="modal-field-label">Request Date</label>
                      <p className="modal-field-value-date">
                        <Calendar className="modal-clock-icon" />
                        <span style={{ fontWeight: 600 }}>{selectedRequest.requestDate}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="modal-reason-section">
                  <label className="modal-reason-label">Reason for Blood Request</label>
                  <div className="modal-reason-content">
                    <p className="modal-reason-text">{selectedRequest.reason}</p>
                  </div>
                </div>

                {selectedRequest.rejectionReason && (
                  <div className="modal-reason-section" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                    <label className="modal-reason-label" style={{ color: '#DC2626' }}>Rejection Reason</label>
                    <div className="modal-reason-content">
                      <p className="modal-reason-text" style={{ color: '#991B1B' }}>{selectedRequest.rejectionReason}</p>
                    </div>
                  </div>
                )}

                {selectedRequest.status.toLowerCase() === 'pending' && (
                  <div className="modal-actions">
                    <button
                      onClick={() => handleStatusChange(selectedRequest.id, 'Rejected')}
                      className="modal-button modal-button-reject"
                      disabled={updatingId === selectedRequest.id}
                    >
                      {updatingId === selectedRequest.id ? (
                        <>
                          <Loader2 className="animate-spin mr-2" size={16} />
                          Updating...
                        </>
                      ) : 'Reject Request'}
                    </button>
                    <button
                      onClick={() => handleStatusChange(selectedRequest.id, 'Approved')}
                      className="modal-button modal-button-approve"
                      disabled={updatingId === selectedRequest.id}
                    >
                      {updatingId === selectedRequest.id ? (
                        <>
                          <Loader2 className="animate-spin mr-2" size={16} />
                          Updating...
                        </>
                      ) : 'Approve Request'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Reject Reason Modal */}
        {showRejectModal && selectedRequest && (
          <div className="modal-overlay">
            <div className="modal-container" style={{ maxWidth: '28rem' }}>
              <div className="modal-header">
                <div className="modal-header-content">
                  <h2 className="modal-title">Reject Request</h2>
                  <button
                    onClick={() => {
                      setShowRejectModal(false);
                      setRejectReason('');
                    }}
                    className="modal-close"
                  >
                    <X className="modal-close-icon" />
                  </button>
                </div>
              </div>

              <div className="modal-body">
                <div className="mb-4">
                  <p className="text-gray-600 mb-2">
                    You are about to reject request <strong>{selectedRequest.requestId}</strong>.
                  </p>
                  <p className="text-gray-600">
                    Please provide a reason for rejection. This will be sent to the requester.
                  </p>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rejection Reason *
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Enter reason for rejection (minimum 10 characters)..."
                    className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    required
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    {rejectReason.length}/10 characters (minimum 10 required)
                  </p>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowRejectModal(false);
                      setRejectReason('');
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                    disabled={updatingId === selectedRequest.id}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRejectWithReason}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={updatingId === selectedRequest.id || rejectReason.trim().length < 10}
                  >
                    {updatingId === selectedRequest.id ? (
                      <>
                        <Loader2 className="animate-spin mr-2 inline" size={16} />
                        Rejecting...
                      </>
                    ) : 'Confirm Reject'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Urgency Update Modal */}
        {showUrgencyModal && selectedRequest && (
          <div className="modal-overlay">
            <div className="modal-container" style={{ maxWidth: '28rem' }}>
              <div className="modal-header">
                <div className="modal-header-content">
                  <h2 className="modal-title">Update Urgency Level</h2>
                  <button
                    onClick={() => setShowUrgencyModal(false)}
                    className="modal-close"
                  >
                    <X className="modal-close-icon" />
                  </button>
                </div>
              </div>

              <div className="modal-body">
                <div className="mb-4">
                  <p className="text-gray-600 mb-2">
                    Update urgency level for request <strong>{selectedRequest.requestId}</strong>.
                  </p>
                  <p className="text-gray-600">
                    Patient: <strong>{selectedRequest.patientName}</strong> ({selectedRequest.bloodType})
                  </p>
                  <p className="text-gray-600">
                    Current urgency: <span className={`font-semibold ${getUrgencyClasses(selectedRequest.urgency)}`}>
                      {selectedRequest.urgency}
                    </span>
                  </p>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Select New Urgency Level *
                  </label>
                  <div className="space-y-2">
                    {['Critical', 'High', 'Medium', 'Low'].map((level) => (
                      <label
                        key={level}
                        className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedUrgency === level
                            ? `border-2 ${level === 'Critical' ? 'border-red-500 bg-red-50' : level === 'High' ? 'border-orange-500 bg-orange-50' : level === 'Medium' ? 'border-yellow-500 bg-yellow-50' : 'border-green-500 bg-green-50'}`
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="urgency"
                          value={level}
                          checked={selectedUrgency === level}
                          onChange={(e) => setSelectedUrgency(e.target.value)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="ml-3 flex items-center gap-2">
                          <span className={`urgency-badge ${getUrgencyClasses(level)}`}>
                            {level}
                          </span>
                          <span className="text-sm text-gray-600">
                            {level === 'Critical' && 'Immediate life-threatening situation'}
                            {level === 'High' && 'Serious condition requiring urgent attention'}
                            {level === 'Medium' && 'Needs attention within 24-48 hours'}
                            {level === 'Low' && 'Non-urgent, can wait several days'}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowUrgencyModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                    disabled={updatingId === selectedRequest.id}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => updateRequestUrgency(selectedRequest.id, selectedUrgency)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    disabled={updatingId === selectedRequest.id || selectedUrgency === selectedRequest.urgency}
                  >
                    {updatingId === selectedRequest.id ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        Update to {selectedUrgency}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default BloodRequest;