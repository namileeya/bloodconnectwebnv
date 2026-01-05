import React, { useState, useEffect } from 'react';
import { Search, Calendar, Clock, MapPin, User, Phone, CheckCircle, XCircle, Edit2, AlertCircle, X, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc,
  getDoc,
  getDocs,
  serverTimestamp,
  orderBy,
  where
} from 'firebase/firestore';
import { db } from '../../firebase';
import Layout from '../../components/Layout';
import './DonationAppointment.css';

const DonationAppointment = ({ onNavigate }) => {
  const [appointments, setAppointments] = useState([]);
  const [filteredAppointments, setFilteredAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [actionType, setActionType] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(8);
  const [locations, setLocations] = useState([]);
  const [usersData, setUsersData] = useState({}); // Store user data by userId
  const [donorProfilesData, setDonorProfilesData] = useState({}); // Store donor profiles by userId
  const [rescheduleData, setRescheduleData] = useState({
    date: '',
    time: ''
  });

  const timeSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];

  // Format Firebase timestamp to display date
  const formatFirebaseDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  // Format date for slot_bookings (DD/MM/YYYY)
  const formatDateForSlotBooking = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Format time for display (from "17:30" to "5:30 PM")
  const formatTimeForDisplay = (timeString) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Generate display ID: "APT" + first 5 chars of Firebase document ID
  const generateDisplayId = (firebaseId) => {
    if (!firebaseId) return 'APT000';
    return `APT${firebaseId.substring(0, 5)}`;
  };

  // Capitalize first letter for status display
  const capitalizeStatus = (status) => {
    if (!status) return '';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  // Fetch user data by userId from users collection
  const fetchUserData = async (userId) => {
    if (!userId) return null;
    
    // Check if user data is already cached
    if (usersData[userId]) {
      return usersData[userId];
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        // Cache the user data
        setUsersData(prev => ({
          ...prev,
          [userId]: userData
        }));
        return userData;
      } else {
        console.log(`User document not found for userId: ${userId}`);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
    return null;
  };

  // Fetch donor profile data by userId from donor_profiles collection
  const fetchDonorProfileData = async (userId) => {
    if (!userId) return null;
    
    // Check if donor profile data is already cached
    if (donorProfilesData[userId]) {
      return donorProfilesData[userId];
    }

    try {
      // Query donor_profiles collection where user_id equals userId
      const donorProfilesQuery = query(
        collection(db, 'donor_profiles'),
        where('user_id', '==', userId)
      );
      
      const querySnapshot = await getDocs(donorProfilesQuery);
      if (!querySnapshot.empty) {
        // Get the first matching document (should only be one per user)
        const doc = querySnapshot.docs[0];
        const donorProfileData = doc.data();
        
        // Debug log to see what data we're getting
        console.log(`Fetched donor profile for userId ${userId}:`, donorProfileData);
        
        // Cache the donor profile data
        setDonorProfilesData(prev => ({
          ...prev,
          [userId]: donorProfileData
        }));
        return donorProfileData;
      } else {
        console.log(`No donor profile found for userId: ${userId}`);
      }
    } catch (error) {
      console.error('Error fetching donor profile data:', error);
    }
    return null;
  };

  // Fetch all user-related data for an appointment
  const fetchAllUserData = async (userId) => {
    if (!userId) return { userData: null, donorProfileData: null };
    
    try {
      const [userData, donorProfileData] = await Promise.all([
        fetchUserData(userId),
        fetchDonorProfileData(userId)
      ]);
      
      return { userData, donorProfileData };
    } catch (error) {
      console.error(`Error fetching data for userId ${userId}:`, error);
      return { userData: null, donorProfileData: null };
    }
  };

  // Load appointments with real-time updates
  useEffect(() => {
    setLoading(true);
    
    const q = query(
      collection(db, 'appointments'),
      orderBy('appointmentDate', 'asc')
    );

    const unsubscribe = onSnapshot(q, 
      async (querySnapshot) => {
        const appointmentsData = [];
        const locationSet = new Set();
        const userIds = new Set();
        
        // First, collect all appointments and userIds
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const userId = data.userId;
          
          appointmentsData.push({
            id: doc.id,
            firebaseId: doc.id,
            displayId: generateDisplayId(doc.id),
            userId: userId,
            location: data.hospitalName || 'Unknown Location',
            address: data.hospitalAddress || '',
            date: data.appointmentDate,
            time: data.timeSlot,
            status: data.status || 'pending',
            bloodType: data.bloodType || null, // Keep as null to check later
            bookingDate: data.createdAt,
            notes: data.notes || '',
            hospitalId: data.hospitalId
          });
          
          if (data.hospitalName) {
            locationSet.add(data.hospitalName);
          }
          
          if (userId) {
            userIds.add(userId);
          }
        });
        
        console.log(`Found ${userIds.size} unique users in appointments`);
        
        // Fetch user data for all unique userIds
        const fetchPromises = Array.from(userIds).map(userId => fetchAllUserData(userId));
        await Promise.all(fetchPromises);
        
        setAppointments(appointmentsData);
        setLocations(Array.from(locationSet));
        setLoading(false);
        
        // Debug: Log data we have
        console.log('Users data cache size:', Object.keys(usersData).length);
        console.log('Donor profiles cache size:', Object.keys(donorProfilesData).length);
        
        // Log first few appointments with their data
        appointmentsData.slice(0, 3).forEach((apt, index) => {
          const userData = usersData[apt.userId];
          const donorProfile = donorProfilesData[apt.userId];
          console.log(`Appointment ${index + 1}:`, {
            displayId: apt.displayId,
            userId: apt.userId,
            hasUserData: !!userData,
            hasDonorProfile: !!donorProfile,
            userName: userData?.username || 'No username',
            donorName: donorProfile?.full_name || 'No full_name',
            phone: userData?.phone_number || 'No phone',
            bloodType: apt.bloodType || donorProfile?.blood_group || 'No blood type'
          });
        });
      },
      (error) => {
        console.error('Error loading appointments:', error);
        setError('Failed to load appointments');
        setLoading(false);
      }
    );

    // Cleanup subscription
    return () => unsubscribe();
  }, []);

  // Get user data for an appointment
  const getUserDataForAppointment = (appointment) => {
    if (!appointment || !appointment.userId) return { userData: null, donorProfileData: null };
    
    return {
      userData: usersData[appointment.userId] || null,
      donorProfileData: donorProfilesData[appointment.userId] || null
    };
  };

  // Get appointment with combined user data
  const getAppointmentWithUserData = (appointment) => {
    const { userData, donorProfileData } = getUserDataForAppointment(appointment);
    
    // Determine donor name with fallbacks
    let donorName = 'Unknown Donor';
    if (donorProfileData?.full_name) {
      donorName = donorProfileData.full_name;
    } else if (userData?.username) {
      donorName = userData.username;
    } else if (userData?.email) {
      donorName = userData.email.split('@')[0]; // Use email username as fallback
    }
    
    // Determine phone number
    let phone = 'No phone number';
    if (userData?.phone_number) {
      phone = userData.phone_number;
    }
    
    // Determine blood type with priority: appointment > donor profile > unknown
    let bloodType = 'Unknown';
    if (appointment.bloodType) {
      bloodType = appointment.bloodType;
    } else if (donorProfileData?.blood_group) {
      bloodType = donorProfileData.blood_group;
    }
    
    return {
      ...appointment,
      donorName,
      phone,
      bloodType,
      // Additional fields for detail modal
      email: userData?.email,
      username: userData?.username,
      gender: donorProfileData?.gender,
      age: donorProfileData?.birth_date ? calculateAge(donorProfileData.birth_date) : null
    };
  };

  // Calculate age from birth date string (DD/MM/YYYY)
  const calculateAge = (birthDateString) => {
    if (!birthDateString) return null;
    
    try {
      const [day, month, year] = birthDateString.split('/').map(Number);
      const birthDate = new Date(year, month - 1, day);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      return age;
    } catch (error) {
      console.error('Error calculating age:', error);
      return null;
    }
  };

  // Filter appointments
  useEffect(() => {
    let filtered = [...appointments];

    if (statusFilter !== 'All') {
      filtered = filtered.filter(apt => apt.status === statusFilter.toLowerCase());
    }

    if (locationFilter !== 'All') {
      filtered = filtered.filter(apt => apt.location === locationFilter);
    }

    if (dateFilter !== 'All') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);

      filtered = filtered.filter(apt => {
        if (!apt.date) return false;
        const aptDate = apt.date.toDate();
        aptDate.setHours(0, 0, 0, 0);
        
        if (dateFilter === 'Today') {
          return aptDate.getTime() === today.getTime();
        } else if (dateFilter === 'Tomorrow') {
          return aptDate.getTime() === tomorrow.getTime();
        } else if (dateFilter === 'This Week') {
          return aptDate >= today && aptDate <= nextWeek;
        }
        return true;
      });
    }

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(apt => {
        const appointmentWithUser = getAppointmentWithUserData(apt);
        const donorName = appointmentWithUser.donorName.toLowerCase();
        const phone = appointmentWithUser.phone || '';
        
        return (
          donorName.includes(searchLower) ||
          apt.displayId.toLowerCase().includes(searchLower) ||
          phone.includes(searchTerm) ||
          apt.location.toLowerCase().includes(searchLower)
        );
      });
    }

    setFilteredAppointments(filtered);
    setCurrentPage(1);
  }, [statusFilter, locationFilter, dateFilter, searchTerm, appointments, usersData, donorProfilesData]);

  // Rest of the component (pagination, handlers, UI) remains the same...

  // Pagination
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAppointments = filteredAppointments.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredAppointments.length / itemsPerPage);

  const getStatusClasses = (status) => {
    switch (status) {
      case 'confirmed': return 'status-confirmed';
      case 'pending': return 'status-pending';
      case 'rescheduled': return 'status-rescheduled';
      case 'cancelled': return 'status-cancelled';
      default: return 'status-default';
    }
  };

  const handleViewDetails = (appointment) => {
    setSelectedAppointment(appointment);
    setShowDetailModal(true);
  };

  const handleConfirmClick = (appointment) => {
    setSelectedAppointment(appointment);
    setActionType('confirm');
    setShowConfirmModal(true);
  };

  const handleCancelClick = (appointment) => {
    setSelectedAppointment(appointment);
    setActionType('cancel');
    setShowConfirmModal(true);
  };

  const handleRescheduleClick = (appointment) => {
    setSelectedAppointment(appointment);
    setRescheduleData({
      date: appointment.date ? appointment.date.toDate().toISOString().split('T')[0] : '',
      time: appointment.time || ''
    });
    setShowRescheduleModal(true);
  };

  const handleConfirmAction = async () => {
    try {
      if (!selectedAppointment) return;

      if (actionType === 'confirm') {
        // 1. Update appointment status in Firestore
        const appointmentRef = doc(db, 'appointments', selectedAppointment.firebaseId);
        await updateDoc(appointmentRef, {
          status: 'confirmed',
          updatedAt: serverTimestamp()
        });

        // 2. Create slot_booking document
        await addDoc(collection(db, 'slot_bookings'), {
          bloodUsed: null,
          bookedAt: serverTimestamp(),
          bookingDate: formatDateForSlotBooking(selectedAppointment.date),
          bookingStatus: 'Pending',
          checkedInAt: null,
          completedAt: null,
          confirmationCode: null,
          donationId: null,
          eventId: selectedAppointment.firebaseId,
          eventLocation: selectedAppointment.location,
          eventTitle: 'From appointment',
          selectedTime: selectedAppointment.time,
          updatedAt: serverTimestamp(),
          usedAt: null,
          userId: selectedAppointment.userId
        });

        setError(''); // Clear any previous errors
      } else if (actionType === 'cancel') {
        // Update appointment status to cancelled
        const appointmentRef = doc(db, 'appointments', selectedAppointment.firebaseId);
        await updateDoc(appointmentRef, {
          status: 'cancelled',
          updatedAt: serverTimestamp()
        });
        
        setError(''); // Clear any previous errors
      }
      
      setShowConfirmModal(false);
      setSelectedAppointment(null);
      
    } catch (error) {
      console.error('Error updating appointment:', error);
      setError('Failed to update appointment. Please try again.');
    }
  };

  const handleRescheduleSubmit = async () => {
    try {
      if (!selectedAppointment || !rescheduleData.date || !rescheduleData.time) return;

      // Convert date string to Firestore timestamp
      const newDate = new Date(rescheduleData.date);
      
      // Update appointment in Firestore
      const appointmentRef = doc(db, 'appointments', selectedAppointment.firebaseId);
      await updateDoc(appointmentRef, {
        status: 'rescheduled',
        appointmentDate: newDate,
        timeSlot: rescheduleData.time,
        updatedAt: serverTimestamp()
      });

      setShowRescheduleModal(false);
      setSelectedAppointment(null);
      setError(''); // Clear any previous errors
      
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      setError('Failed to reschedule appointment. Please try again.');
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  // Calculate statistics
  const stats = {
    total: appointments.length,
    pending: appointments.filter(a => a.status === 'pending').length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    rescheduled: appointments.filter(a => a.status === 'rescheduled').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length
  };

  if (loading && appointments.length === 0) {
    return (
      <Layout onNavigate={onNavigate} currentPage="donation-appointments">
        <div className="loading-container">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <p className="loading-text">Loading appointments...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout onNavigate={onNavigate} currentPage="donation-appointments">
      <div className="space-y-6">
        {/* Header */}
        <div className="appointment-header-container">
          <h1 className="appointment-header-title">Donation Appointments</h1>
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-container">
            <AlertCircle className="error-icon" />
            <p className="error-text">{error}</p>
            <button onClick={() => setError('')} className="error-close">
              <X className="error-close-icon" />
            </button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="appointment-stats-grid">
          <div className="appointment-stat-card stat-card-total">
            <Calendar className="stat-icon text-blue-600" />
            <div>
              <h3 className="stat-number-blue">{stats.total}</h3>
              <p className="stat-label">Total Appointments</p>
            </div>
          </div>
          <div className="appointment-stat-card stat-card-pending">
            <Clock className="stat-icon text-purple-600" />
            <div>
              <h3 className="stat-number-purple">{stats.pending}</h3>
              <p className="stat-label">Pending Review</p>
            </div>
          </div>
          <div className="appointment-stat-card stat-card-confirmed">
            <CheckCircle className="stat-icon text-green-600" />
            <div>
              <h3 className="stat-number-green">{stats.confirmed}</h3>
              <p className="stat-label">Confirmed</p>
            </div>
          </div>
          <div className="appointment-stat-card stat-card-rescheduled">
            <Edit2 className="stat-icon text-orange-600" />
            <div>
              <h3 className="stat-number-orange">{stats.rescheduled}</h3>
              <p className="stat-label">Rescheduled</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="appointment-filters-container">
          <div className="appointment-filters-row">
            <div className="appointment-search-input-container">
              <Search className="appointment-search-icon" />
              <input
                type="text"
                placeholder="Search by name, ID, phone, or location..."
                className="appointment-search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="appointment-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="rescheduled">Rescheduled</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              className="appointment-location-filter"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <option value="All">All Locations</option>
              {locations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
            <select
              className="appointment-date-filter"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <option value="All">All Dates</option>
              <option value="Today">Today</option>
              <option value="Tomorrow">Tomorrow</option>
              <option value="This Week">This Week</option>
            </select>
          </div>
        </div>

        {/* Appointments Table */}
        <div className="appointment-table-container">
          <div className="appointment-table-wrapper">
            <table className="appointment-table">
              <thead className="appointment-table-header">
                <tr>
                  <th className="appointment-table-header-cell">ID</th>
                  <th className="appointment-table-header-cell">DONOR</th>
                  <th className="appointment-table-header-cell">LOCATION</th>
                  <th className="appointment-table-header-cell">DATE & TIME</th>
                  <th className="appointment-table-header-cell">BLOOD TYPE</th>
                  <th className="appointment-table-header-cell">STATUS</th>
                  <th className="appointment-table-header-cell">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="appointment-table-body">
                {paginatedAppointments.map((appointment) => {
                  const appointmentWithUser = getAppointmentWithUserData(appointment);
                  return (
                    <tr key={appointment.firebaseId} className="appointment-table-row">
                      <td className="appointment-table-cell appointment-id-cell">
                        {appointment.displayId}
                      </td>
                      <td className="appointment-table-cell">
                        <div className="donor-info">
                          <span className="donor-name">{appointmentWithUser.donorName}</span>
                          <span className="donor-phone">{appointmentWithUser.phone}</span>
                        </div>
                      </td>
                      <td className="appointment-table-cell">
                        <div className="location-info">
                          <span className="location-name">{appointment.location}</span>
                          <span className="location-address">{appointment.address}</span>
                        </div>
                      </td>
                      <td className="appointment-table-cell">
                        <div className="datetime-info">
                          <span className="date-text">
                            {appointment.date ? formatFirebaseDate(appointment.date) : 'N/A'}
                          </span>
                          <span className="time-text">
                            {formatTimeForDisplay(appointment.time)}
                          </span>
                        </div>
                      </td>
                      <td className="appointment-table-cell">
                        <span className="blood-type-badge">{appointmentWithUser.bloodType}</span>
                      </td>
                      <td className="appointment-table-cell">
                        <span className={`appointment-status-badge ${getStatusClasses(appointment.status)}`}>
                          {capitalizeStatus(appointment.status)}
                        </span>
                      </td>
                      <td className="appointment-table-cell">
                        <div className="appointment-actions-container">
                          <button
                            onClick={() => handleViewDetails(appointment)}
                            className="appointment-action-button view-button"
                            title="View Details"
                          >
                            <User className="appointment-action-icon" />
                          </button>
                          {appointment.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleConfirmClick(appointment)}
                                className="appointment-action-button confirm-button"
                                title="Confirm"
                              >
                                <CheckCircle className="appointment-action-icon" />
                              </button>
                              <button
                                onClick={() => handleRescheduleClick(appointment)}
                                className="appointment-action-button reschedule-button"
                                title="Reschedule"
                              >
                                <Edit2 className="appointment-action-icon" />
                              </button>
                            </>
                          )}
                          {(appointment.status === 'pending' || appointment.status === 'confirmed') && (
                            <button
                              onClick={() => handleCancelClick(appointment)}
                              className="appointment-action-button cancel-button"
                              title="Cancel"
                            >
                              <XCircle className="appointment-action-icon" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredAppointments.length === 0 && !loading && (
            <div className="appointment-empty-state">
              <div className="appointment-empty-state-icon">
                <Calendar />
              </div>
              <h3 className="appointment-empty-state-title">No appointments found</h3>
              <p className="appointment-empty-state-description">
                Try adjusting your search filters
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredAppointments.length > 0 && (
          <div className="appointment-pagination">
            <div className="appointment-pagination-info">
              <span>Items per page:</span>
              <select 
                value={itemsPerPage} 
                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                className="appointment-items-per-page-select"
              >
                <option value={6}>6</option>
                <option value={8}>8</option>
                <option value={12}>12</option>
                <option value={16}>16</option>
              </select>
              <span className="appointment-pagination-range">
                {startIndex + 1}-{Math.min(endIndex, filteredAppointments.length)} of {filteredAppointments.length}
              </span>
            </div>
            
            <div className="appointment-pagination-controls">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="appointment-pagination-btn"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="appointment-pagination-btn"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {showDetailModal && selectedAppointment && (
          <div className="appointment-modal-overlay">
            <div className="appointment-modal-container">
              <div className="appointment-modal-header">
                <h2 className="appointment-modal-title">Appointment Details</h2>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="appointment-modal-close"
                >
                  <X className="appointment-modal-close-icon" />
                </button>
              </div>
              <div className="appointment-modal-body">
                <div className="detail-grid">
                  <div className="detail-item">
                    <label className="detail-label">Appointment ID</label>
                    <p className="detail-value">{selectedAppointment.displayId}</p>
                  </div>
                  <div className="detail-item">
                    <label className="detail-label">Status</label>
                    <span className={`appointment-status-badge ${getStatusClasses(selectedAppointment.status)}`}>
                      {capitalizeStatus(selectedAppointment.status)}
                    </span>
                  </div>
                  
                  {/* Donor Information */}
                  <div className="detail-item">
                    <label className="detail-label">Donor Name</label>
                    <p className="detail-value">
                      {getAppointmentWithUserData(selectedAppointment).donorName}
                    </p>
                  </div>
                  <div className="detail-item">
                    <label className="detail-label">Phone Number</label>
                    <p className="detail-value">
                      {getAppointmentWithUserData(selectedAppointment).phone}
                    </p>
                  </div>
                  
                  {/* Blood Information */}
                  <div className="detail-item">
                    <label className="detail-label">Blood Type</label>
                    <p className="detail-value">
                      <span className="blood-type-badge">
                        {getAppointmentWithUserData(selectedAppointment).bloodType}
                      </span>
                    </p>
                  </div>
                  
                  {/* Appointment Information */}
                  <div className="detail-item">
                    <label className="detail-label">Booking Date</label>
                    <p className="detail-value">
                      {selectedAppointment.bookingDate ? formatFirebaseDate(selectedAppointment.bookingDate) : 'N/A'}
                    </p>
                  </div>
                  <div className="detail-item full-width">
                    <label className="detail-label">Location</label>
                    <p className="detail-value">{selectedAppointment.location}</p>
                    <p className="detail-subvalue">{selectedAppointment.address}</p>
                  </div>
                  <div className="detail-item">
                    <label className="detail-label">Appointment Date</label>
                    <p className="detail-value">
                      {selectedAppointment.date ? formatFirebaseDate(selectedAppointment.date) : 'N/A'}
                    </p>
                  </div>
                  <div className="detail-item">
                    <label className="detail-label">Appointment Time</label>
                    <p className="detail-value">{formatTimeForDisplay(selectedAppointment.time)}</p>
                  </div>
                  
                  {selectedAppointment.notes && (
                    <div className="detail-item full-width">
                      <label className="detail-label">Notes</label>
                      <p className="detail-value">{selectedAppointment.notes}</p>
                    </div>
                  )}
                </div>
                <div className="appointment-modal-actions">
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="appointment-modal-button appointment-close-button"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reschedule Modal */}
        {showRescheduleModal && selectedAppointment && (
          <div className="appointment-modal-overlay">
            <div className="appointment-modal-container">
              <div className="appointment-modal-header">
                <h2 className="appointment-modal-title">Reschedule Appointment</h2>
                <button
                  onClick={() => setShowRescheduleModal(false)}
                  className="appointment-modal-close"
                >
                  <X className="appointment-modal-close-icon" />
                </button>
              </div>
              <div className="appointment-modal-body">
                <div className="reschedule-info">
                  <p className="reschedule-donor">Donor: <strong>
                    {getAppointmentWithUserData(selectedAppointment).donorName}
                  </strong></p>
                  <p className="reschedule-current">
                    Current: {selectedAppointment.date ? formatFirebaseDate(selectedAppointment.date) : 'N/A'} at {formatTimeForDisplay(selectedAppointment.time)}
                  </p>
                </div>
                <div className="appointment-modal-form">
                  <div className="appointment-form-group">
                    <label className="appointment-form-label">New Date</label>
                    <input
                      type="date"
                      className="appointment-form-input"
                      value={rescheduleData.date}
                      onChange={(e) => setRescheduleData({...rescheduleData, date: e.target.value})}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div className="appointment-form-group">
                    <label className="appointment-form-label">New Time</label>
                    <select
                      className="appointment-form-select"
                      value={rescheduleData.time}
                      onChange={(e) => setRescheduleData({...rescheduleData, time: e.target.value})}
                    >
                      <option value="">Select time</option>
                      {timeSlots.map(slot => (
                        <option key={slot} value={slot}>{slot}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="appointment-modal-actions">
                  <button
                    onClick={() => setShowRescheduleModal(false)}
                    className="appointment-modal-button appointment-cancel-button"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRescheduleSubmit}
                    disabled={!rescheduleData.date || !rescheduleData.time}
                    className="appointment-modal-button appointment-save-button"
                  >
                    Reschedule
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Action Modal */}
        {showConfirmModal && selectedAppointment && (
          <div className="appointment-modal-overlay">
            <div className="appointment-confirm-modal">
              <div className="appointment-confirm-icon-container">
                {actionType === 'confirm' ? (
                  <CheckCircle className="appointment-confirm-icon confirm-icon" />
                ) : (
                  <XCircle className="appointment-confirm-icon cancel-icon" />
                )}
              </div>
              <h3 className="appointment-confirm-title">
                {actionType === 'confirm' ? 'Confirm Appointment' : 'Cancel Appointment'}
              </h3>
              <p className="appointment-confirm-message">
                {actionType === 'confirm' 
                  ? `Are you sure you want to confirm this appointment for ${getAppointmentWithUserData(selectedAppointment).donorName}?`
                  : `Are you sure you want to cancel this appointment for ${getAppointmentWithUserData(selectedAppointment).donorName}?`
                }
              </p>
              <div className="appointment-confirm-details">
                <p><strong>Date:</strong> {selectedAppointment.date ? formatFirebaseDate(selectedAppointment.date) : 'N/A'}</p>
                <p><strong>Time:</strong> {formatTimeForDisplay(selectedAppointment.time)}</p>
                <p><strong>Location:</strong> {selectedAppointment.location}</p>
              </div>
              <div className="appointment-confirm-actions">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="appointment-confirm-button appointment-confirm-cancel"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirmAction}
                  className={`appointment-confirm-button ${actionType === 'confirm' ? 'appointment-confirm-confirm' : 'appointment-confirm-delete'}`}
                >
                  {actionType === 'confirm' ? 'Confirm' : 'Cancel Appointment'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default DonationAppointment;