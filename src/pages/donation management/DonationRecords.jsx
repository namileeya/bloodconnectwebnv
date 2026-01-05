import React, { useState, useEffect } from 'react';
import { 
  Search, Edit2, XCircle, User, 
  AlertCircle, X, ChevronLeft, ChevronRight, Award,
  Calendar, MapPin, CheckCircle, Clock, XOctagon,
  Check, Ban, UserX, Loader2, Mail, Phone, FileText,
  Heart
} from 'lucide-react';
import { 
  collection, getDocs, addDoc, updateDoc, deleteDoc, 
  doc, query, where, Timestamp, serverTimestamp,
  orderBy, getDoc, increment, writeBatch, setDoc
} from 'firebase/firestore';
import { db } from '../../firebase';
import Layout from '../../components/Layout';
import './DonationRecords.css';

// Notification helper function
const sendNotification = async (userId, notificationData) => {
  try {
    if (!userId || ['manual_entry', 'walk_in', 'unknown'].includes(userId)) {
      console.log('No valid user for notification');
      return;
    }

    const notificationRecord = {
      userId: userId,
      type: 'donation_status_update',
      title: notificationData.title,
      message: notificationData.message,
      data: notificationData.data || {},
      read: false,
      createdAt: serverTimestamp()
    };
    
    console.log('Creating notification for user:', userId);
    
    await addDoc(collection(db, 'notifications'), notificationRecord);
    
    try {
      const userTokenDoc = await getDoc(doc(db, 'user_tokens', userId));
      if (userTokenDoc.exists()) {
        const tokenData = userTokenDoc.data();
        if (tokenData.fcmToken) {
          console.log('FCM notification would be sent to:', tokenData.fcmToken);
        }
      }
    } catch (tokenError) {
      console.log('No FCM token found, skipping push notification');
    }
    
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.email) {
          console.log('Email notification would be sent to:', userData.email);
        }
      }
    } catch (emailError) {
      console.log('User email not found, skipping email notification');
    }
    
    console.log('Notification sent successfully to user:', userId);
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};

const DonationRecords = ({ onNavigate }) => {
  const [records, setRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(8);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRecord, setNewRecord] = useState({
    name: '',
    address: '',
    date: new Date().toISOString().split('T')[0],
    status: 'Pending',
    bloodType: 'Unknown',
    userId: null,
    userEmail: '',
    userPhone: ''
  });
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completingRecord, setCompletingRecord] = useState(null);
  const [completionData, setCompletionData] = useState({
    serialNumber: '',
    amountDonated: '',
    expiryDate: '',
    bloodType: '',
    donorName: ''
  });
  const [completionErrors, setCompletionErrors] = useState({});
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingRecord, setRejectingRecord] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingRecord, setCancellingRecord] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showNoShowModal, setShowNoShowModal] = useState(false);
  const [noShowRecord, setNoShowRecord] = useState(null);
  const [noShowReason, setNoShowReason] = useState('');
  
  // NEW STATES FOR HOSPITAL FILTERING AND USED FUNCTIONALITY
  const [showUsedModal, setShowUsedModal] = useState(false);
  const [usingRecord, setUsingRecord] = useState(null);
  const [usingHospital, setUsingHospital] = useState(null);
  const [hospitalBloodStock, setHospitalBloodStock] = useState(null);
  
  // User search states
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [userSearchTimeout, setUserSearchTimeout] = useState(null);

  const ALL_STATUSES = ['All', 'Pending', 'Registered', 'Confirmed', 'Completed', 'Rejected', 'Cancelled', 'No-show'];
  const STATUS_OPTIONS = ['Pending', 'Registered', 'Confirmed', 'Completed', 'Rejected', 'Cancelled', 'No-show'];

  const convertToISOString = (dateStr) => {
    try {
      if (!dateStr) return '';
      if (dateStr.includes('-')) return dateStr;
      
      const parts = dateStr.split('/');
      if (parts.length !== 3) return dateStr;
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    } catch {
      return dateStr;
    }
  };

  const formatDateFromFirestore = (timestamp) => {
    try {
      if (!timestamp) return new Date();
      if (timestamp.toDate) {
        return timestamp.toDate();
      } else if (timestamp instanceof Timestamp) {
        return timestamp.toDate();
      } else if (typeof timestamp === 'object' && timestamp.seconds) {
        return new Timestamp(timestamp.seconds, timestamp.nanoseconds).toDate();
      } else {
        return new Date(timestamp);
      }
    } catch {
      return new Date();
    }
  };

  // Check if donation is expired
  const isDonationExpired = (donation) => {
    if (!donation?.expiry_date) return false;
    const expiryDate = formatDateFromFirestore(donation.expiry_date);
    const now = new Date();
    return expiryDate < now;
  };

  // Helper function to check if a donation can be marked as used
  const canMarkAsUsed = (record) => {
    // Must be a completed donation
    if (record.status !== 'Completed') {
      return false;
    }
    
    // Must have donation details
    if (!record.donationDetails) {
      return false;
    }
    
    // Must be in stored status (not already used)
    if (record.donationDetails.status !== 'stored') {
      return false;
    }
    
    // Must not already be used
    if (record.donationDetails.used) {
      return false;
    }
    
    // Check if expired
    if (record.donationDetails.expiryDate) {
      const expiryDate = new Date(record.donationDetails.expiryDate);
      const now = new Date();
      if (expiryDate < now) {
        return false;
      }
    }
    
    // Must have blood type
    if (!record.donationDetails.bloodType || record.donationDetails.bloodType === 'Unknown') {
      return false;
    }
    
    return true;
  };

  const determineStatus = (booking, hasDonation) => {
    // If it's from appointment and has donation, it's completed
    if (!booking.eventId && hasDonation) {
      return 'Completed';
    }
    
    if (booking.entryType === 'walk_in' || booking.createdBy === 'Admin') {
      if (booking.bookingStatus) {
        const status = booking.bookingStatus.toLowerCase();
        switch (status) {
          case 'pending': return 'Pending';
          case 'registered': 
          case 'scheduled': return 'Registered';
          case 'confirmed': return 'Confirmed';
          case 'rejected': return 'Rejected';
          case 'cancelled': return 'Cancelled';
          case 'no-show': return 'No-show';
          case 'completed': return 'Completed';
          default: return 'Pending';
        }
      }
      return 'Pending';
    }
    
    if (booking.bookingStatus) {
      const status = booking.bookingStatus.toLowerCase();
      if (status === 'completed') {
        return 'Completed';
      }
      
      switch (status) {
        case 'pending': return 'Pending';
        case 'registered': 
        case 'scheduled': return 'Registered';
        case 'confirmed': return 'Confirmed';
        case 'rejected': return 'Rejected';
        case 'cancelled': return 'Cancelled';
        case 'no-show': return 'No-show';
        default: return 'Pending';
      }
    }
    
    return 'Pending';
  };

  const isDonationForBooking = (donation, booking) => {
    try {
      if (donation.donor_id !== booking.userId) {
        return false;
      }
      
      const donationDate = formatDateFromFirestore(donation.donation_date);
      if (!donationDate) return false;
      
      let bookingDate;
      if (booking.bookingDate) {
        bookingDate = convertToISOString(booking.bookingDate);
      } else if (booking.bookedAt) {
        bookingDate = formatDateFromFirestore(booking.bookedAt).toISOString().split('T')[0];
      } else {
        return false;
      }
      
      if (!bookingDate) return false;
      
      const donationDateObj = new Date(donationDate);
      const bookingDateObj = new Date(bookingDate);
      
      return donationDateObj.toDateString() === bookingDateObj.toDateString();
    } catch (err) {
      console.error('Error checking donation for booking:', err);
      return false;
    }
  };

  // ------------------------------------------------------------------------------------------------------ //
  const getHospitalForRecord = async (record) => {
    try {
      console.log('Getting hospital for record:', record.id, 'Source:', record.source);
      
      // If record has hospital info directly
      if (record.hospitalId) {
        try {
          const hospitalDoc = await getDoc(doc(db, 'hospitals', record.hospitalId));
          if (hospitalDoc.exists()) {
            const hospital = hospitalDoc.data();
            return {
              id: record.hospitalId,
              name: record.hospitalName || hospital.name || 'Unknown Hospital',
              ...hospital
            };
          }
        } catch (hospitalErr) {
          console.error('Error fetching hospital from record:', hospitalErr);
        }
      }
      
      // Try to get from event (for slot_bookings)
      if (record.source === 'event_booking' && record.bookingData?.eventId) {
        const eventDoc = await getDoc(doc(db, 'blood_drive_events', record.bookingData.eventId));
        if (eventDoc.exists()) {
          const eventData = eventDoc.data();
          
          let hospitalId = eventData.assignedHospitalId || 
                          eventData.hospitalId || 
                          eventData.hospital_id || 
                          eventData.assigned_hospital_id;
                          
          let hospitalName = eventData.assignedHospitalName || 
                            eventData.hospitalName || 
                            eventData.hospital_name || 
                            eventData.assigned_hospital_name;
          
          console.log('Event data:', { hospitalId, hospitalName });
          
          if (hospitalId) {
            try {
              const hospitalDoc = await getDoc(doc(db, 'hospitals', hospitalId));
              if (hospitalDoc.exists()) {
                const hospital = hospitalDoc.data();
                return {
                  id: hospitalId,
                  name: hospitalName || hospital.name || 'Unknown Hospital',
                  ...hospital
                };
              }
            } catch (hospitalErr) {
              console.error('Error fetching hospital from event:', hospitalErr);
            }
          }
        }
      }
      
      // Try to find hospital by name
      if (record.hospitalName) {
        const hospital = hospitals.find(h => 
          h.name.toLowerCase() === record.hospitalName.toLowerCase() ||
          h.name.toLowerCase().includes(record.hospitalName.toLowerCase()) ||
          record.hospitalName.toLowerCase().includes(h.name.toLowerCase())
        );
        
        if (hospital) {
          return {
            id: hospital.id,
            name: hospital.name,
            ...hospital
          };
        }
      }
      
      // Fallback to first hospital
      if (hospitals.length > 0) {
        console.log('Using fallback hospital:', hospitals[0].name);
        return hospitals[0];
      }
      
      return null;
    } catch (err) {
      console.error('Error getting hospital for record:', err);
      return null;
    }
  };

  const getBloodStockForHospital = async (hospitalId, bloodType) => {
    try {
      if (!hospitalId || !bloodType) {
        console.error('Missing hospitalId or bloodType');
        return null;
      }
      
      console.log(`Looking for blood stock: Hospital=${hospitalId}, BloodType=${bloodType}`);
      
      // Try direct document first
      try {
        const bloodStockDoc = await getDoc(doc(db, 'hospitals', hospitalId, 'bloodStock', bloodType));
        if (bloodStockDoc.exists()) {
          console.log(`Found blood stock document: ${bloodType}`);
          return { 
            id: bloodType,
            bloodType: bloodType,
            ...bloodStockDoc.data() 
          };
        }
      } catch (docErr) {
        console.log(`No direct document for ${bloodType}`);
      }
      
      // Search through all blood stock documents
      const bloodStockSnapshot = await getDocs(collection(db, 'hospitals', hospitalId, 'bloodStock'));
      console.log(`Found ${bloodStockSnapshot.docs.length} blood stock documents`);
      
      for (const stockDoc of bloodStockSnapshot.docs) {
        const stockData = stockDoc.data();
        const docBloodType = stockData.bloodType || stockDoc.id;
        
        const normalizedDocType = docBloodType.toLowerCase().replace(/[^a-z0-9+]/g, '');
        const normalizedSearchType = bloodType.toLowerCase().replace(/[^a-z0-9+]/g, '');
        
        if (normalizedDocType === normalizedSearchType) {
          console.log(`Found matching blood type: ${docBloodType}`);
          return {
            id: stockDoc.id,
            bloodType: docBloodType,
            ...stockData
          };
        }
      }
      
      // Return default structure if not found
      console.log(`No existing blood stock for ${bloodType}, will create on submit`);
      return {
        id: bloodType,
        bloodType: bloodType,
        quantity: 0,
        minimumLevel: 10,
        criticalLevel: 5
      };
      
    } catch (err) {
      console.error('Error getting blood stock:', err);
      return null;
    }
  };

  const ensureBloodStockExists = async (hospitalId, bloodType) => {
    try {
      const bloodStockRef = doc(db, 'hospitals', hospitalId, 'bloodStock', bloodType);
      const bloodStockDoc = await getDoc(bloodStockRef);
      
      if (!bloodStockDoc.exists()) {
        await setDoc(bloodStockRef, {
          bloodType: bloodType,
          quantity: 0,
          minimumLevel: 10,
          criticalLevel: 5,
          lastUpdated: serverTimestamp(),
          createdAt: serverTimestamp()
        });
        console.log(`Created blood stock document for ${bloodType} in hospital ${hospitalId}`);
      }
      
      return bloodStockRef;
    } catch (err) {
      console.error('Error ensuring blood stock exists:', err);
      throw err;
    }
  };

  const handleMarkAsUsedClick = async (record) => {
    try {
      console.log('Mark as used clicked for record:', record.id);
      setUsingRecord(record);
      
      const hospital = await getHospitalForRecord(record);
      if (!hospital) {
        setError('Cannot find hospital information for this donation. Please assign a hospital to the event first.');
        return;
      }
      
      console.log('Found hospital:', hospital);
      
      // Get blood type from multiple sources
      let bloodType = 'Unknown';
      
      if (record.donationDetails?.bloodType && record.donationDetails.bloodType !== 'Unknown') {
        bloodType = record.donationDetails.bloodType;
      } else if (record.bookingData?.donorBloodType && record.bookingData.donorBloodType !== 'Unknown') {
        bloodType = record.bookingData.donorBloodType;
      } else if (record.userId && record.userId !== 'walk_in') {
        try {
          const donorQuery = query(
            collection(db, 'donor_profiles'), 
            where('user_id', '==', record.userId)
          );
          const donorSnapshot = await getDocs(donorQuery);
          
          if (!donorSnapshot.empty) {
            const donorData = donorSnapshot.docs[0].data();
            bloodType = donorData.blood_group || 'Unknown';
          }
        } catch (profileErr) {
          console.warn('Could not fetch donor profile:', profileErr);
        }
      }
      
      console.log('Determined blood type:', bloodType);
      
      if (!bloodType || bloodType === 'Unknown') {
        setError('Blood type is unknown. Cannot mark as used without valid blood type.');
        return;
      }
      
      const bloodStock = await getBloodStockForHospital(hospital.id, bloodType);
      if (!bloodStock) {
        setError(`Blood type ${bloodType} not found in ${hospital.name} inventory. Please add this blood type to the hospital inventory first.`);
        return;
      }
      
      setUsingHospital(hospital);
      setHospitalBloodStock(bloodStock);
      setShowUsedModal(true);
      setError('');
      
    } catch (err) {
      console.error('Error preparing to mark as used:', err);
      setError('Error preparing to mark donation as used: ' + err.message);
    }
  };

  const handleSubmitUsed = async () => {
    if (!usingRecord || !usingHospital || !hospitalBloodStock) {
      console.error('Missing required data:', {
        usingRecord: !!usingRecord,
        usingHospital: !!usingHospital,
        hospitalBloodStock: !!hospitalBloodStock
      });
      return;
    }
    
    try {
      setError('');
      setSuccess('');
      
      console.log('Marking blood as used:', {
        donationId: usingRecord.firestoreDonationId,
        hospitalId: usingHospital.id,
        bloodType: hospitalBloodStock.bloodType
      });
      
      // IMPORTANT: Ensure blood stock document exists first
      await ensureBloodStockExists(usingHospital.id, hospitalBloodStock.bloodType);
      
      const batch = writeBatch(db);
      
      // 1. Update donation record
      if (usingRecord.firestoreDonationId) {
        const donationRef = doc(db, 'donations', usingRecord.firestoreDonationId);
        batch.update(donationRef, {
          used: true,
          used_at: serverTimestamp(),
          status: 'used',
          used_hospital_id: usingHospital.id,
          used_hospital_name: usingHospital.name
        });
      }
      
      // 2. Update blood stock - CRITICAL: Use bloodType as document ID
      const bloodStockRef = doc(db, 'hospitals', usingHospital.id, 'bloodStock', hospitalBloodStock.bloodType);
      
      // Get current quantity
      const currentStockDoc = await getDoc(bloodStockRef);
      let currentQuantity = 0;
      
      if (currentStockDoc.exists()) {
        const currentData = currentStockDoc.data();
        currentQuantity = parseInt(currentData.quantity) || 0;
      }
      
      const newQuantity = currentQuantity - 1;
      
      if (newQuantity < 0) {
        setError(`Cannot mark as used: Blood stock for ${hospitalBloodStock.bloodType} would go negative. Current stock: ${currentQuantity}`);
        return;
      }
      
      batch.update(bloodStockRef, {
        quantity: newQuantity,
        lastUpdated: serverTimestamp()
      });
      
      // 3. Update booking if exists
      if (usingRecord.firestoreBookingId) {
        const bookingRef = doc(db, 'slot_bookings', usingRecord.firestoreBookingId);
        batch.update(bookingRef, {
          bloodUsed: true,
          usedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      // Execute batch
      await batch.commit();
      
      console.log('Blood marked as used successfully');
      
      // CRITICAL: Update local state IMMEDIATELY for instant UI feedback
      const updatedRecords = records.map(rec => {
        if (rec.id === usingRecord.id) {
          return {
            ...rec,
            donationDetails: rec.donationDetails ? {
              ...rec.donationDetails,
              used: true,
              status: 'used',
              usedAt: new Date().toISOString().split('T')[0],
              usedHospitalId: usingHospital.id,
              usedHospitalName: usingHospital.name
            } : null
          };
        }
        return rec;
      });
      
      // Update both records and filteredRecords
      setRecords(updatedRecords);
      
      // IMPORTANT: Also update filteredRecords based on current filters
      const updatedFiltered = filteredRecords.map(rec => {
        if (rec.id === usingRecord.id) {
          return {
            ...rec,
            donationDetails: rec.donationDetails ? {
              ...rec.donationDetails,
              used: true,
              status: 'used',
              usedAt: new Date().toISOString().split('T')[0],
              usedHospitalId: usingHospital.id,
              usedHospitalName: usingHospital.name
            } : null
          };
        }
        return rec;
      });
      
      setFilteredRecords(updatedFiltered);
      
      // Send notification
      if (usingRecord.userId && usingRecord.userId !== 'walk_in') {
        await sendNotification(usingRecord.userId, {
          title: 'Your Blood Saved a Life! ❤️',
          message: `Your donated blood (${hospitalBloodStock.bloodType}) has been used to save a life at ${usingHospital.name}. Thank you for your donation!`,
          data: {
            recordId: usingRecord.id,
            status: 'used',
            bloodType: hospitalBloodStock.bloodType,
            hospitalName: usingHospital.name,
            usedDate: new Date().toISOString().split('T')[0],
            donationData: {
              id: usingRecord.firestoreDonationId,
              serialNumber: usingRecord.donationDetails?.serialNumber || '',
              bloodType: hospitalBloodStock.bloodType,
              used: true,
              status: 'used'
            }
          }
        });
      }
      
      setSuccess(`Blood marked as used successfully! Inventory updated for ${usingHospital.name}. New stock: ${newQuantity} units of ${hospitalBloodStock.bloodType}`);
      
      // Close modal and reset states
      setShowUsedModal(false);
      setUsingRecord(null);
      setUsingHospital(null);
      setHospitalBloodStock(null);
      
    } catch (err) {
      console.error('Error marking blood as used:', err);
      console.error('Error details:', {
        hospitalId: usingHospital?.id,
        bloodType: hospitalBloodStock?.bloodType,
        errorCode: err.code,
        errorMessage: err.message,
        errorStack: err.stack
      });
      
      if (err.code === 'not-found') {
        setError(`Hospital or blood stock document not found. Hospital: ${usingHospital?.name}, Blood Type: ${hospitalBloodStock?.bloodType}`);
      } else if (err.code === 'permission-denied') {
        setError('Permission denied. You may not have write access to update blood stock.');
      } else {
        setError(`Failed to mark blood as used: ${err.message}`);
      }
    }
  };

  const searchUsersInDatabase = async (searchTerm) => {
    if (!searchTerm || searchTerm.trim().length < 2) {
      setUserSearchResults([]);
      setShowUserDropdown(false);
      return;
    }

    try {
      setSearchingUsers(true);
      setShowUserDropdown(true);
      const searchLower = searchTerm.toLowerCase().trim();

      const [allUsersSnapshot, allDonorProfilesSnapshot] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'donor_profiles'))
      ]);

      const donorProfilesMap = {};
      allDonorProfilesSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.user_id) {
          donorProfilesMap[data.user_id] = {
            ...data,
            donorProfileId: doc.id
          };
        }
      });

      const results = [];

      allUsersSnapshot.forEach(doc => {
        const userData = doc.data();
        const donorProfile = donorProfilesMap[doc.id] || {};
        
        const userName = donorProfile.full_name || userData.displayName || userData.email?.split('@')[0] || 'User';
        const userEmail = userData.email || 'No email';
        const userPhone = userData.phone || donorProfile.phone || 'No phone';
        const userAddress = userData.address || donorProfile.address || 'No address';
        const bloodType = donorProfile.blood_group || 'Unknown';
        
        const matchesSearch = 
          userName.toLowerCase().includes(searchLower) ||
          userEmail.toLowerCase().includes(searchLower) ||
          userPhone.toLowerCase().includes(searchLower) ||
          (userData.ic && userData.ic.toLowerCase().includes(searchLower)) ||
          (donorProfile.ic_number && donorProfile.ic_number.toLowerCase().includes(searchLower)) ||
          userAddress.toLowerCase().includes(searchLower);
        
        if (matchesSearch) {
          results.push({
            id: doc.id,
            name: userName,
            email: userEmail,
            phone: userPhone,
            address: userAddress,
            bloodType: bloodType,
            icNumber: donorProfile.ic_number || userData.ic || 'No IC',
            source: donorProfile.full_name ? 'donor_profile' : 'user',
            hasDonorProfile: !!donorProfile.full_name,
            userData: userData,
            donorProfile: donorProfile
          });
        }
      });

      allDonorProfilesSnapshot.forEach(doc => {
        const donorData = doc.data();
        const userId = donorData.user_id;
        
        if (results.some(r => r.id === userId)) return;
        
        const donorName = donorData.full_name;
        const donorEmail = donorData.email || 'No email';
        const donorPhone = donorData.phone || 'No phone';
        const donorAddress = donorData.address || 'No address';
        const bloodType = donorData.blood_group || 'Unknown';
        
        const matchesSearch = 
          donorName?.toLowerCase().includes(searchLower) ||
          donorEmail.toLowerCase().includes(searchLower) ||
          donorPhone.toLowerCase().includes(searchLower) ||
          (donorData.ic_number && donorData.ic_number.toLowerCase().includes(searchLower)) ||
          donorAddress.toLowerCase().includes(searchLower);
        
        if (matchesSearch && userId) {
          results.push({
            id: userId,
            name: donorName || 'Unknown Donor',
            email: donorEmail,
            phone: donorPhone,
            address: donorAddress,
            bloodType: bloodType,
            icNumber: donorData.ic_number || 'No IC',
            source: 'donor_profile_only',
            hasDonorProfile: true,
            donorProfile: donorData
          });
        }
      });

      results.sort((a, b) => {
        if (a.hasDonorProfile && !b.hasDonorProfile) return -1;
        if (!a.hasDonorProfile && b.hasDonorProfile) return 1;
        return a.name.localeCompare(b.name);
      });

      setUserSearchResults(results.slice(0, 10));
      setSearchingUsers(false);
    } catch (err) {
      console.error('Error searching users:', err);
      setUserSearchResults([]);
      setSearchingUsers(false);
    }
  };

  const handleUserSearch = (value) => {
    setNewRecord({
      ...newRecord,
      name: value,
      userId: null,
      address: '',
      bloodType: 'Unknown',
      userEmail: '',
      userPhone: ''
    });

    if (userSearchTimeout) {
      clearTimeout(userSearchTimeout);
    }

    const timeout = setTimeout(() => {
      searchUsersInDatabase(value);
    }, 300);

    setUserSearchTimeout(timeout);
  };

  const selectUser = async (user) => {
    try {
      const [userDoc, donorProfileQuery] = await Promise.all([
        getDoc(doc(db, 'users', user.id)),
        getDocs(query(collection(db, 'donor_profiles'), where('user_id', '==', user.id)))
      ]);

      let userData = {};
      let donorProfile = {};
      
      if (userDoc.exists()) {
        userData = userDoc.data();
      }
      
      if (!donorProfileQuery.empty) {
        donorProfile = donorProfileQuery.docs[0].data();
      }

      const selectedName = donorProfile.full_name || userData.displayName || user.name;
      const selectedAddress = userData.address || donorProfile.address || user.address || 'Address not provided';
      const selectedBloodType = donorProfile.blood_group || user.bloodType || 'Unknown';
      const selectedEmail = userData.email || user.email || 'No email';
      const selectedPhone = userData.phone || donorProfile.phone || user.phone || 'No phone';

      setNewRecord({
        ...newRecord,
        name: selectedName,
        userId: user.id,
        address: selectedAddress,
        bloodType: selectedBloodType,
        userEmail: selectedEmail,
        userPhone: selectedPhone
      });
      
      setUserSearchResults([]);
      setShowUserDropdown(false);
    } catch (err) {
      console.error('Error fetching user details:', err);
      setNewRecord({
        ...newRecord,
        name: user.name,
        userId: user.id,
        address: user.address,
        bloodType: user.bloodType,
        userEmail: user.email,
        userPhone: user.phone
      });
      setUserSearchResults([]);
      setShowUserDropdown(false);
    }
  };

  // ------------------------------------------------------------------------------- //
  // Load hospitals and records
  const loadRecords = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      console.log('Fetching hospitals and records from Firebase...');

      // 1. Fetch all hospitals
      const hospitalsSnapshot = await getDocs(collection(db, 'hospitals'));
      const hospitalsList = hospitalsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setHospitals(hospitalsList);
      
      const hospitalIds = hospitalsList.map(h => h.id);
      console.log(`Loaded ${hospitalsList.length} hospitals:`, hospitalIds);

      // 2. Fetch all data sources
      const [bookingsSnapshot, donationsSnapshot, usersSnapshot, donorProfilesSnapshot, eventsSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'slot_bookings'), orderBy('bookedAt', 'desc'))),
        getDocs(query(collection(db, 'donations'), orderBy('created_at', 'desc'))),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'donor_profiles')),
        getDocs(collection(db, 'blood_drive_events'))
      ]);

      console.log(`Found: ${bookingsSnapshot.size} bookings, ${donationsSnapshot.size} donations, ${eventsSnapshot.size} events`);

      const eventsMap = {};
      eventsSnapshot.forEach(doc => {
        eventsMap[doc.id] = {
          id: doc.id,
          ...doc.data()
        };
      });

      const usersMap = {};
      usersSnapshot.forEach(doc => {
        usersMap[doc.id] = doc.data();
      });

      const donorProfilesMap = {};
      donorProfilesSnapshot.forEach(doc => {
        const data = doc.data();
        donorProfilesMap[data.user_id] = data;
      });

      // Create donations maps - by donor AND by ID
      const donationsByDonor = {};
      const donationsById = {};
      donationsSnapshot.forEach(doc => {
        const donation = { id: doc.id, ...doc.data() };
        const donorId = donation.donor_id;
        
        // Map by donor
        if (!donationsByDonor[donorId]) {
          donationsByDonor[donorId] = [];
        }
        donationsByDonor[donorId].push(donation);
        
        // Map by ID
        donationsById[doc.id] = donation;
      });

      const combinedRecords = [];

      for (const bookingDoc of bookingsSnapshot.docs) {
        const booking = { id: bookingDoc.id, ...bookingDoc.data() };
        const userId = booking.userId;
        const userData = usersMap[userId] || {};
        const donorProfile = donorProfilesMap[userId] || {};
        
        // CHANGED: Check if this is from an event or from appointment
        let event = null;
        let hospitalId = null;
        let hospitalName = null;
        
        if (booking.eventId && eventsMap[booking.eventId]) {
          // This is from an event
          event = eventsMap[booking.eventId];
          hospitalId = event.assignedHospitalId;
          hospitalName = event.assignedHospitalName;
          
          // Skip if hospital is not in our list
          if (!hospitalIds.includes(hospitalId)) {
            console.log(`Skipping event booking from untracked hospital: ${hospitalId}`);
            continue;
          }
        } else {
          // This is from an appointment (has eventTitle = 'From appointment')
          hospitalName = booking.eventLocation || 'Hospital Appointment';
          
          // Try to find hospital by name
          const matchingHospital = hospitalsList.find(h => 
            h.name.toLowerCase() === hospitalName.toLowerCase() ||
            h.name.toLowerCase().includes(hospitalName.toLowerCase()) ||
            hospitalName.toLowerCase().includes(h.name.toLowerCase())
          );
          
          if (matchingHospital) {
            hospitalId = matchingHospital.id;
            hospitalName = matchingHospital.name;
          } else {
            // If no matching hospital found, use first hospital as fallback
            console.log(`No matching hospital found for: ${hospitalName}, using fallback`);
            hospitalId = hospitalsList[0]?.id;
            hospitalName = hospitalsList[0]?.name || hospitalName;
          }
        }
        
        if (!hospitalId) {
          console.log(`Skipping booking ${booking.id} - no hospital found`);
          continue;
        }

        // IMPROVED DONATION MATCHING
        let matchingDonation = null;
        
        // First, check if booking has a donationId field (direct link)
        if (booking.donationId && donationsById[booking.donationId]) {
          matchingDonation = donationsById[booking.donationId];
          console.log(`Found donation via donationId: ${booking.donationId}`);
        } else {
          // If no direct link, try to match by user and date
          const userDonations = donationsByDonor[userId] || [];
          
          for (const donation of userDonations) {
            if (isDonationForBooking(donation, booking)) {
              matchingDonation = donation;
              console.log(`Found donation via date matching: ${donation.id}`);
              break;
            }
          }
        }

        const hasDonation = matchingDonation !== null;
        const status = determineStatus(booking, hasDonation);

        const displayId = userId ? `DON-${userId.substring(0, 7).toUpperCase()}` : `DON-WALK-IN-${booking.id.substring(0, 8)}`;

        let displayDate = '';
        let rawDate = '';
        
        if (booking.bookingDate) {
          displayDate = convertToISOString(booking.bookingDate);
          rawDate = displayDate;
        } else if (booking.bookedAt) {
          const bookedDate = formatDateFromFirestore(booking.bookedAt);
          displayDate = bookedDate.toISOString().split('T')[0];
          rawDate = displayDate;
        }

        if (status === 'Completed' && matchingDonation && matchingDonation.donation_date) {
          const donationDate = formatDateFromFirestore(matchingDonation.donation_date);
          displayDate = donationDate.toISOString().split('T')[0];
        }

        const recordName = booking.donorName || donorProfile.full_name || booking.userId || 'Unknown Donor';
        const recordAddress = booking.donorAddress || userData.address || 'Address not available';

        const record = {
          id: displayId,
          firestoreBookingId: booking.id,
          firestoreDonationId: matchingDonation?.id,
          name: recordName,
          address: recordAddress,
          date: displayDate,
          rawDate: rawDate,
          status: status,
          userId: userId,
          bookingData: booking,
          donationDetails: matchingDonation ? {
            serialNumber: matchingDonation.serial_number || '',
            amountDonated: matchingDonation.amount_ml?.toString() || '',
            expiryDate: matchingDonation.expiry_date ? formatDateFromFirestore(matchingDonation.expiry_date).toISOString().split('T')[0] : '',
            completedDate: matchingDonation.donation_date ? formatDateFromFirestore(matchingDonation.donation_date).toISOString().split('T')[0] : '',
            bloodType: matchingDonation.blood_type || donorProfile.blood_group || 'Unknown',
            used: matchingDonation.used || false,
            usedAt: matchingDonation.used_at ? formatDateFromFirestore(matchingDonation.used_at).toISOString().split('T')[0] : '',
            status: matchingDonation.status || 'stored'
          } : null,
          eventInfo: {
            title: booking.eventTitle || 'From Appointment',
            location: booking.eventLocation || 'Hospital Appointment',
            time: booking.selectedTime || 'Scheduled Time',
            confirmationCode: booking.confirmationCode || '',
            eventId: booking.eventId
          },
          hospitalId: hospitalId,
          hospitalName: hospitalName,
          source: event ? 'event_booking' : 'appointment_booking' // Track source
        };

        combinedRecords.push(record);
        
        console.log(`Added record from ${record.source}:`, {
          id: record.id,
          name: record.name,
          hospital: record.hospitalName,
          status: record.status
        });
      }

      // Check for standalone donations (donations without bookings)
      for (const donationDoc of donationsSnapshot.docs) {
        const donation = { id: donationDoc.id, ...donationDoc.data() };
        const alreadyLinked = combinedRecords.some(
          record => record.firestoreDonationId === donation.id
        );
        
        if (!alreadyLinked) {
          console.log('Skipping standalone donation (no booking link):', donation.id);
        }
      }

      // Sort by date (newest first)
      combinedRecords.sort((a, b) => new Date(b.date) - new Date(a.date));

      const statusCounts = combinedRecords.reduce((acc, record) => {
        acc[record.status] = (acc[record.status] || 0) + 1;
        return acc;
      }, {});

      const sourceCounts = combinedRecords.reduce((acc, record) => {
        acc[record.source] = (acc[record.source] || 0) + 1;
        return acc;
      }, {});

      console.log(`Loaded ${combinedRecords.length} records. Status distribution:`, statusCounts);
      console.log(`Source distribution:`, sourceCounts);
      console.log('Hospitals included:', [...new Set(combinedRecords.map(r => r.hospitalName))]);
      console.log('Sample appointments:', 
        combinedRecords
          .filter(r => r.source === 'appointment_booking')
          .map(r => ({ id: r.id, name: r.name, status: r.status, hospital: r.hospitalName }))
      );

      setRecords(combinedRecords);
      setFilteredRecords(combinedRecords);
      setLoading(false);

    } catch (err) {
      console.error('Error loading records:', err);
      setError(`Failed to load donation records: ${err.message}`);
      setLoading(false);
      setRecords([]);
      setFilteredRecords([]);
    }
  };

  // ----------------------------------------------------------------------------------------------------------- //

  useEffect(() => {
    loadRecords();
  }, []);

  // Debug effect to check records
  useEffect(() => {
    if (!loading && filteredRecords.length > 0) {
      console.log('=== DEBUG DONATION RECORDS ===');
      const completedRecords = filteredRecords.filter(r => r.status === 'Completed');
      console.log(`Total records: ${filteredRecords.length}`);
      console.log(`Completed records: ${completedRecords.length}`);
      console.log(`Appointment bookings: ${filteredRecords.filter(r => r.source === 'appointment_booking').length}`);
      
      completedRecords.forEach((record, index) => {
        console.log(`Completed Record ${index}:`, {
          id: record.id,
          name: record.name,
          hasDonationDetails: !!record.donationDetails,
          donationDetails: record.donationDetails,
          canBeUsed: canMarkAsUsed(record),
          source: record.source
        });
      });
    }
  }, [loading, filteredRecords]);

  useEffect(() => {
    let filtered = [...records];

    if (statusFilter !== 'All') {
      filtered = filtered.filter(record =>
        record.status.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    if (monthFilter || yearFilter) {
      filtered = filtered.filter(record => {
        try {
          const dateToUse = record.rawDate || record.date;
          if (!dateToUse) return false;
          
          const recordDate = new Date(dateToUse);
          if (isNaN(recordDate.getTime())) return false;
          
          const recordMonth = recordDate.getMonth() + 1;
          const recordYear = recordDate.getFullYear();
          
          let monthMatch = true;
          let yearMatch = true;
          
          if (monthFilter) {
            monthMatch = recordMonth === parseInt(monthFilter);
          }
          
          if (yearFilter) {
            yearMatch = recordYear === parseInt(yearFilter);
          }
          
          return monthMatch && yearMatch;
        } catch {
          return false;
        }
      });
    }

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(record => {
        return (
          (record.name && record.name.toLowerCase().includes(searchLower)) ||
          (record.id && record.id.toLowerCase().includes(searchLower)) ||
          (record.address && record.address.toLowerCase().includes(searchLower)) ||
          (record.eventInfo?.title && record.eventInfo.title.toLowerCase().includes(searchLower)) ||
          (record.eventInfo?.confirmationCode && record.eventInfo.confirmationCode.toLowerCase().includes(searchLower)) ||
          (record.donationDetails?.serialNumber && record.donationDetails.serialNumber.toLowerCase().includes(searchLower)) ||
          (record.userId && record.userId.toLowerCase().includes(searchLower)) ||
          (record.hospitalName && record.hospitalName.toLowerCase().includes(searchLower))
        );
      });
    }

    setFilteredRecords(filtered);
    setCurrentPage(1);
  }, [statusFilter, searchTerm, monthFilter, yearFilter, records]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);

  const getStatusClasses = (record) => {
    const status = record.status.toLowerCase();
    
    if (record.donationDetails?.used) {
      return 'status-used';
    }
    
    if (record.donationDetails?.status === 'stored') {
      const isExpired = isDonationExpired({ expiry_date: record.donationDetails.expiryDate });
      if (isExpired) {
        return 'status-expired';
      }
    }
    
    switch (status) {
      case 'completed': return 'status-completed';
      case 'registered': return 'status-scheduled';
      case 'confirmed': return 'status-confirmed';
      case 'pending': return 'status-pending';
      case 'rejected': return 'status-rejected';
      case 'cancelled': return 'status-cancelled';
      case 'no-show': return 'status-no-show';
      default: return 'status-default';
    }
  };

  const getStatusIcon = (record) => {
    if (record.donationDetails?.used) {
      return <Heart size={14} />;
    }
    
    if (record.donationDetails?.status === 'stored') {
      const isExpired = isDonationExpired({ expiry_date: record.donationDetails.expiryDate });
      if (isExpired) {
        return <XCircle size={14} />;
      }
    }
    
    const status = record.status.toLowerCase();
    switch (status) {
      case 'completed': return <CheckCircle size={14} />;
      case 'registered': return <Calendar size={14} />;
      case 'confirmed': return <Check size={14} />;
      case 'pending': return <Clock size={14} />;
      case 'rejected': return <XOctagon size={14} />;
      case 'cancelled': return <Ban size={14} />;
      case 'no-show': return <UserX size={14} />;
      default: return <Clock size={14} />;
    }
  };

  const getStatusText = (record) => {
    if (record.donationDetails?.used) {
      return 'Used';
    }
    
    if (record.donationDetails?.status === 'stored') {
      const isExpired = isDonationExpired({ expiry_date: record.donationDetails.expiryDate });
      if (isExpired) {
        return 'Expired';
      }
    }
    
    return record.status;
  };

  const formatDate = (dateString) => {
    try {
      if (!dateString) return 'No date';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString) => {
    try {
      if (!dateString) return 'No date';
      const date = new Date(dateString);
      return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  // FIXED: Calculate stats based on displayed records
  const calculateStats = () => {
    const recordsToCount = filteredRecords;
    
    const stats = {
      total: recordsToCount.length,
      completed: 0,
      registered: 0,
      confirmed: 0,
      pending: 0,
      rejected: 0,
      cancelled: 0,
      noshow: 0
    };

    recordsToCount.forEach(record => {
      const statusText = getStatusText(record);
      
      switch(statusText.toLowerCase()) {
        case 'completed':
        case 'used':
        case 'expired':
          stats.completed++;
          break;
        case 'registered':
          stats.registered++;
          break;
        case 'confirmed':
          stats.confirmed++;
          break;
        case 'pending':
          stats.pending++;
          break;
        case 'rejected':
          stats.rejected++;
          break;
        case 'cancelled':
          stats.cancelled++;
          break;
        case 'no-show':
          stats.noshow++;
          break;
        default:
          stats.pending++;
      }
    });

    return stats;
  };

  const stats = calculateStats();

  const handleViewDetails = (record) => {
    setSelectedRecord(record);
    setShowDetailsModal(true);
  };

  const handleCompleteClick = async (record) => {
    try {
      let bloodType = 'Unknown';
      let donorName = record.name;

      if (record.userId && record.userId !== 'walk_in') {
        const donorQuery = query(
          collection(db, 'donor_profiles'), 
          where('user_id', '==', record.userId)
        );
        const donorSnapshot = await getDocs(donorQuery);
        
        if (!donorSnapshot.empty) {
          const donorData = donorSnapshot.docs[0].data();
          bloodType = donorData.blood_group || 'Unknown';
          donorName = donorData.full_name || record.name;
        }
      }

      setCompletingRecord(record);
      setCompletionData({
        serialNumber: '',
        amountDonated: '',
        expiryDate: '',
        bloodType: bloodType,
        donorName: donorName
      });
      setCompletionErrors({});
      setShowCompletionModal(true);
    } catch (err) {
      console.error('Error fetching donor profile:', err);
      setCompletingRecord(record);
      setCompletionData({
        serialNumber: '',
        amountDonated: '',
        expiryDate: '',
        bloodType: 'Unknown',
        donorName: record.name
      });
      setCompletionErrors({});
      setShowCompletionModal(true);
    }
  };

  const handleRejectClick = (record) => {
    setRejectingRecord(record);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleCancelClick = (record) => {
    setCancellingRecord(record);
    setCancelReason('');
    setShowCancelModal(true);
  };

  const handleNoShowClick = (record) => {
    setNoShowRecord(record);
    setNoShowReason('');
    setShowNoShowModal(true);
  };

  const handleRegisterClick = async (record) => {
    if (!record.firestoreBookingId) return;
    
    try {
      setError('');
      setSuccess('');
      const bookingRef = doc(db, 'slot_bookings', record.firestoreBookingId);
      await updateDoc(bookingRef, {
        bookingStatus: 'registered',
        updatedAt: serverTimestamp()
      });
      
      if (record.userId && record.userId !== 'walk_in') {
        await sendNotification(record.userId, {
          title: 'Donation Registered',
          message: `Your donation has been registered for ${record.eventInfo?.title || 'the event'}`,
          data: {
            recordId: record.id,
            status: 'registered',
            eventTitle: record.eventInfo?.title,
            eventLocation: record.eventInfo?.location,
            eventTime: record.eventInfo?.time
          }
        });
      }
      
      await loadRecords();
      setSuccess('Donation registered successfully!');
    } catch (err) {
      console.error('Error registering donation:', err);
      setError(`Failed to register donation: ${err.message}`);
    }
  };

  const handleConfirmClick = async (record) => {
    if (!record.firestoreBookingId) return;
    
    try {
      setError('');
      setSuccess('');
      const bookingRef = doc(db, 'slot_bookings', record.firestoreBookingId);
      await updateDoc(bookingRef, {
        bookingStatus: 'confirmed',
        updatedAt: serverTimestamp()
      });
      
      if (record.userId && record.userId !== 'walk_in') {
        await sendNotification(record.userId, {
          title: 'Donation Confirmed',
          message: `Your donation has been confirmed for ${record.eventInfo?.title || 'the event'}`,
          data: {
            recordId: record.id,
            status: 'confirmed',
            eventTitle: record.eventInfo?.title,
            eventLocation: record.eventInfo?.location,
            eventTime: record.eventInfo?.time
          }
        });
      }
      
      await loadRecords();
      setSuccess('Donation confirmed successfully!');
    } catch (err) {
      console.error('Error confirming donation:', err);
      setError(`Failed to confirm donation: ${err.message}`);
    }
  };

  const validateCompletionData = () => {
    const errors = {};

    if (!completionData.serialNumber.trim()) {
      errors.serialNumber = 'Serial number is required';
    }

    if (!completionData.amountDonated.trim()) {
      errors.amountDonated = 'Amount donated is required';
    } else if (isNaN(completionData.amountDonated) || Number(completionData.amountDonated) <= 0) {
      errors.amountDonated = 'Please enter a valid amount';
    } else if (Number(completionData.amountDonated) > 1000) {
      errors.amountDonated = 'Amount should not exceed 1000ml';
    }

    if (!completionData.expiryDate) {
      errors.expiryDate = 'Expiry date is required';
    } else {
      const expiryDate = new Date(completionData.expiryDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expiryDate <= today) {
        errors.expiryDate = 'Expiry date must be in the future';
      }
    }

    setCompletionErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitCompletion = async () => {
    if (!validateCompletionData() || !completingRecord) {
      return;
    }

    try {
      setError('');
      setSuccess('');
      
      const donationData = {
        serial_number: completionData.serialNumber.trim(),
        amount_ml: Number(completionData.amountDonated),
        blood_type: completionData.bloodType || 'Unknown',
        created_at: serverTimestamp(),
        created_by: 'Admin',
        donation_date: serverTimestamp(),
        donor_id: completingRecord.userId || 'walk_in',
        donor_name: completionData.donorName || completingRecord.name,
        expiry_date: Timestamp.fromDate(new Date(completionData.expiryDate)),
        status: 'stored', // Make sure this is set to 'stored'
        used: false
      };

      await addDoc(collection(db, 'donations'), donationData);

      if (completingRecord.firestoreBookingId) {
        try {
          const bookingRef = doc(db, 'slot_bookings', completingRecord.firestoreBookingId);
          await updateDoc(bookingRef, {
            bookingStatus: 'completed',
            updatedAt: serverTimestamp()
          });
        } catch (bookingErr) {
          console.warn('Could not update booking status:', bookingErr);
        }
      }

      if (completingRecord.userId && completingRecord.userId !== 'walk_in') {
        await sendNotification(completingRecord.userId, {
          title: 'Donation Completed',
          message: 'Thank you! Your blood donation has been successfully completed and processed.',
          data: {
            recordId: completingRecord.id,
            status: 'completed',
            serialNumber: completionData.serialNumber,
            amountDonated: completionData.amountDonated,
            bloodType: completionData.bloodType
          }
        });
      }

      await loadRecords();
      setShowCompletionModal(false);
      setCompletingRecord(null);
      setCompletionData({
        serialNumber: '',
        amountDonated: '',
        expiryDate: '',
        bloodType: '',
        donorName: ''
      });
      setCompletionErrors({});

      setSuccess('Donation completed successfully!');

    } catch (err) {
      console.error('Error completing donation:', err);
      setError(`Failed to complete donation: ${err.message}`);
    }
  };

  const handleSubmitRejection = async () => {
    if (!rejectingRecord || !rejectingRecord.firestoreBookingId) return;

    try {
      setError('');
      setSuccess('');
      const bookingRef = doc(db, 'slot_bookings', rejectingRecord.firestoreBookingId);
      await updateDoc(bookingRef, {
        bookingStatus: 'rejected',
        rejectReason: rejectReason || 'No reason provided',
        updatedAt: serverTimestamp()
      });
      
      if (rejectingRecord.userId && rejectingRecord.userId !== 'walk_in') {
        await sendNotification(rejectingRecord.userId, {
          title: 'Donation Request Rejected',
          message: `Your donation request has been rejected.${rejectReason ? ` Reason: ${rejectReason}` : ''}`,
          data: {
            recordId: rejectingRecord.id,
            status: 'rejected',
            reason: rejectReason,
            eventTitle: rejectingRecord.eventInfo?.title
          }
        });
      }
      
      await loadRecords();
      setShowRejectModal(false);
      setRejectingRecord(null);
      setRejectReason('');
      setSuccess('Donation rejected successfully!');
    } catch (err) {
      console.error('Error rejecting donation:', err);
      setError(`Failed to reject donation: ${err.message}`);
    }
  };

  const handleSubmitCancellation = async () => {
    if (!cancellingRecord || !cancellingRecord.firestoreBookingId) return;

    try {
      setError('');
      setSuccess('');
      const bookingRef = doc(db, 'slot_bookings', cancellingRecord.firestoreBookingId);
      await updateDoc(bookingRef, {
        bookingStatus: 'cancelled',
        cancelReason: cancelReason || 'No reason provided',
        updatedAt: serverTimestamp()
      });
      
      if (cancellingRecord.userId && cancellingRecord.userId !== 'walk_in') {
        await sendNotification(cancellingRecord.userId, {
          title: 'Donation Cancelled',
          message: `Your donation has been cancelled.${cancelReason ? ` Reason: ${cancelReason}` : ''}`,
          data: {
            recordId: cancellingRecord.id,
            status: 'cancelled',
            reason: cancelReason,
            eventTitle: cancellingRecord.eventInfo?.title
          }
        });
      }
      
      await loadRecords();
      setShowCancelModal(false);
      setCancellingRecord(null);
      setCancelReason('');
      setSuccess('Donation cancelled successfully!');
    } catch (err) {
      console.error('Error cancelling donation:', err);
      setError(`Failed to cancel donation: ${err.message}`);
    }
  };

  const handleSubmitNoShow = async () => {
    if (!noShowRecord || !noShowRecord.firestoreBookingId) return;

    try {
      setError('');
      setSuccess('');
      const bookingRef = doc(db, 'slot_bookings', noShowRecord.firestoreBookingId);
      await updateDoc(bookingRef, {
        bookingStatus: 'no-show',
        noShowReason: noShowReason || 'No reason provided',
        updatedAt: serverTimestamp()
      });
      
      if (noShowRecord.userId && noShowRecord.userId !== 'walk_in') {
        await sendNotification(noShowRecord.userId, {
          title: 'Missed Donation Appointment',
          message: `You were marked as a no-show for your donation appointment.${noShowReason ? ` Reason noted: ${noShowReason}` : ''}`,
          data: {
            recordId: noShowRecord.id,
            status: 'no-show',
            reason: noShowReason,
            eventTitle: noShowRecord.eventInfo?.title
          }
        });
      }
      
      await loadRecords();
      setShowNoShowModal(false);
      setNoShowRecord(null);
      setNoShowReason('');
      setSuccess('Marked as No-show successfully!');
    } catch (err) {
      console.error('Error marking as no-show:', err);
      setError(`Failed to mark as no-show: ${err.message}`);
    }
  };

  const handleAddClick = () => {
    setNewRecord({
      name: '',
      address: '',
      date: new Date().toISOString().split('T')[0],
      status: 'Pending',
      bloodType: 'Unknown',
      userId: null,
      userEmail: '',
      userPhone: ''
    });
    setUserSearchResults([]);
    setShowUserDropdown(false);
    setShowAddModal(true);
  };

  const handleAddSubmit = async () => {
    if (!newRecord.name.trim() || !newRecord.date) {
      setError('Name and date are required');
      return;
    }

    try {
      setError('');
      setSuccess('');
      
      const isRealUser = newRecord.userId && newRecord.userId !== 'walk_in';
      let userData = {};
      let donorProfile = {};
      
      if (isRealUser) {
        try {
          const [userDoc, donorProfileQuery] = await Promise.all([
            getDoc(doc(db, 'users', newRecord.userId)),
            getDocs(query(collection(db, 'donor_profiles'), where('user_id', '==', newRecord.userId)))
          ]);
          
          if (userDoc.exists()) {
            userData = userDoc.data();
          }
          
          if (!donorProfileQuery.empty) {
            donorProfile = donorProfileQuery.docs[0].data();
          }
        } catch (fetchErr) {
          console.warn('Could not fetch user details:', fetchErr);
        }
      }

      const formattedDate = new Date(newRecord.date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      
      const confirmationCode = `WALK-IN-${Date.now().toString().substr(8, 6).toUpperCase()}`;

      if (newRecord.status === 'Completed') {
        const donationData = {
          serial_number: `DON-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
          amount_ml: 450,
          blood_type: donorProfile.blood_group || newRecord.bloodType || 'Unknown',
          created_at: serverTimestamp(),
          created_by: 'Admin',
          donation_date: Timestamp.fromDate(new Date(newRecord.date)),
          donor_id: newRecord.userId || 'walk_in',
          donor_name: donorProfile.full_name || newRecord.name.trim(),
          address: userData.address || newRecord.address.trim() || 'Address not provided',
          expiry_date: Timestamp.fromDate(new Date(new Date(newRecord.date).setDate(new Date(newRecord.date).getDate() + 35))),
          status: 'stored', // Make sure this is set to 'stored'
          used: false,
          collected_by: 'Admin',
          donation_type: 'walk_in',
          notes: 'Added as walk-in donation by administrator'
        };

        const donationRef = await addDoc(collection(db, 'donations'), donationData);
        
        const bookingData = {
          userId: newRecord.userId || 'walk_in',
          bookedAt: serverTimestamp(),
          bookingDate: newRecord.date,
          bookingStatus: 'completed',
          eventTitle: 'Walk-in Donation',
          eventLocation: 'Walk-in Center',
          selectedTime: 'N/A',
          confirmationCode: confirmationCode,
          updatedAt: serverTimestamp(),
          createdBy: 'Admin',
          donationId: donationRef.id,
          donorName: donorProfile.full_name || newRecord.name.trim(),
          donorAddress: userData.address || newRecord.address.trim() || 'Address not provided',
          donorBloodType: donorProfile.blood_group || newRecord.bloodType || 'Unknown',
          entryType: 'walk_in'
        };
        
        const bookingRef = await addDoc(collection(db, 'slot_bookings'), bookingData);
        
        if (isRealUser) {
          await sendNotification(newRecord.userId, {
            title: 'Walk-in Donation Completed',
            message: `Your walk-in blood donation has been completed and recorded. Date: ${formattedDate}`,
            data: {
              recordId: bookingRef.id,
              status: 'completed',
              date: formattedDate,
              eventTitle: 'Walk-in Donation',
              confirmationCode: confirmationCode
            }
          });
        }
      } 
      else {
        let bookingStatus = '';
        switch (newRecord.status.toLowerCase()) {
          case 'pending': bookingStatus = 'pending'; break;
          case 'registered': bookingStatus = 'registered'; break;
          case 'confirmed': bookingStatus = 'confirmed'; break;
          case 'rejected': bookingStatus = 'rejected'; break;
          case 'cancelled': bookingStatus = 'cancelled'; break;
          case 'no-show': bookingStatus = 'no-show'; break;
          default: bookingStatus = 'pending';
        }
        
        const bookingData = {
          userId: isRealUser ? newRecord.userId : 'walk_in',
          bookedAt: serverTimestamp(),
          bookingDate: newRecord.date,
          bookingStatus: bookingStatus,
          eventTitle: 'Walk-in Donation',
          eventLocation: 'Walk-in Center',
          selectedTime: 'N/A',
          confirmationCode: confirmationCode,
          updatedAt: serverTimestamp(),
          createdBy: 'Admin',
          donorName: isRealUser ? (donorProfile.full_name || newRecord.name.trim()) : newRecord.name.trim(),
          donorAddress: userData.address || newRecord.address.trim() || 'Address not provided',
          donorBloodType: donorProfile.blood_group || newRecord.bloodType || 'Unknown',
          notes: 'Added as walk-in appointment by administrator',
          entryType: 'walk_in'
        };

        const bookingRef = await addDoc(collection(db, 'slot_bookings'), bookingData);
        
        if (isRealUser) {
          await sendNotification(newRecord.userId, {
            title: `Walk-in Donation: ${newRecord.status}`,
            message: `A walk-in donation appointment has been created for you with status: ${newRecord.status}. Date: ${formattedDate}`,
            data: {
              recordId: bookingRef.id,
              status: newRecord.status.toLowerCase(),
              date: formattedDate,
              eventTitle: 'Walk-in Donation',
              confirmationCode: confirmationCode
            }
          });
        }
      }

      await loadRecords();
      setShowAddModal(false);
      setNewRecord({
        name: '',
        address: '',
        date: new Date().toISOString().split('T')[0],
        status: 'Pending',
        bloodType: 'Unknown',
        userId: null,
        userEmail: '',
        userPhone: ''
      });
      setUserSearchResults([]);
      setShowUserDropdown(false);
      
      setSuccess(`Walk-in record added successfully with status: ${newRecord.status}`);

    } catch (err) {
      console.error('Error adding record:', err);
      setError(`Failed to add record: ${err.message}`);
    }
  };

  const handleEdit = (record) => {
    setSelectedRecord(record);
    setShowModal(true);
  };

  const handleDeleteClick = (id) => {
    setDeletingId(id);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;

    try {
      setError('');
      setSuccess('');
      const recordToDelete = records.find(r => r.id === deletingId);
      
      if (!recordToDelete) {
        throw new Error('Record not found');
      }

      if (recordToDelete.status === 'Completed') {
        setError('Cannot delete completed donations for safety reasons.');
        setShowDeleteConfirm(false);
        setDeletingId(null);
        return;
      }

      if (recordToDelete.firestoreDonationId) {
        await deleteDoc(doc(db, 'donations', recordToDelete.firestoreDonationId));
      }

      if (recordToDelete.firestoreBookingId) {
        await deleteDoc(doc(db, 'slot_bookings', recordToDelete.firestoreBookingId));
        
        if (recordToDelete.userId && recordToDelete.userId !== 'walk_in') {
          await sendNotification(recordToDelete.userId, {
            title: 'Donation Record Deleted',
            message: 'Your donation record has been deleted by an administrator.',
            data: {
              recordId: recordToDelete.id,
              status: 'deleted'
            }
          });
        }
      }

      await loadRecords();
      setShowDeleteConfirm(false);
      setDeletingId(null);
      setSuccess('Record deleted successfully!');

    } catch (err) {
      console.error('Error deleting record:', err);
      setError(`Failed to delete record: ${err.message}`);
      setShowDeleteConfirm(false);
      setDeletingId(null);
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 8 }, (_, i) => (currentYear + 2 - i).toString());

  const monthOptions = [
    { value: '', label: 'All Months' },
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
  ];

  if (loading) {
    return (
      <Layout onNavigate={onNavigate} currentPage="donation-records">
        <div className="loading-container">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <p className="loading-text">Loading donation records...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout onNavigate={onNavigate} currentPage="donation-records">
      <div className="space-y-6">
        {/* Header */}
        <div className="records-header-container">
          <h1 className="records-header-title">Donation Records</h1>
          <p className="text-sm text-gray-600">
            Showing records from {hospitals.length} hospitals
          </p>
          <div className="records-header-actions">
            <button
              className="add-record-button"
              onClick={handleAddClick}
            >
              Add Record
            </button>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="error-container error-alert">
            <AlertCircle className="error-icon" />
            <p className="error-text">{error}</p>
            <button onClick={() => setError('')} className="error-close">
              <X className="error-close-icon" />
            </button>
          </div>
        )}
        
        {success && (
          <div className="error-container success-alert">
            <CheckCircle className="error-icon" />
            <p className="error-text">{success}</p>
            <button onClick={() => setSuccess('')} className="error-close">
              <X className="error-close-icon" />
            </button>
          </div>
        )}

        {/* Stats Cards - FIXED: Now shows counts for filtered records */}
        <div className="records-stats-grid">
          <div className="records-stat-card stat-card-total">
            <h3 className="stat-number-blue">{stats.total}</h3>
            <p className="stat-label">Total</p>
          </div>
          <div className="records-stat-card stat-card-completed">
            <h3 className="stat-number-green">{stats.completed}</h3>
            <p className="stat-label">Completed</p>
          </div>
          <div className="records-stat-card stat-card-scheduled">
            <h3 className="stat-number-orange">{stats.registered}</h3>
            <p className="stat-label">Registered</p>
          </div>
          <div className="records-stat-card stat-card-confirmed">
            <h3 className="stat-number-teal">{stats.confirmed}</h3>
            <p className="stat-label">Confirmed</p>
          </div>
          <div className="records-stat-card stat-card-pending">
            <h3 className="stat-number-purple">{stats.pending}</h3>
            <p className="stat-label">Pending</p>
          </div>
          <div className="records-stat-card stat-card-rejected">
            <h3 className="stat-number-red">{stats.rejected}</h3>
            <p className="stat-label">Rejected</p>
          </div>
          <div className="records-stat-card stat-card-cancelled">
            <h3 className="stat-number-gray">{stats.cancelled}</h3>
            <p className="stat-label">Cancelled</p>
          </div>
          <div className="records-stat-card stat-card-noshow">
            <h3 className="stat-number-yellow">{stats.noshow}</h3>
            <p className="stat-label">No-show</p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="records-filters-container">
          <div className="records-filters-grid">
            <div className="records-search-container">
              <label className="records-filter-label">Search Records</label>
              <div className="records-search-input-container">
                <Search className="records-search-icon" />
                <input
                  type="text"
                  placeholder="Search by name, ID, hospital, or serial number..."
                  className="records-search-input"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="records-filter-select-container">
              <label className="records-filter-label">Status</label>
              <select
                className="records-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {ALL_STATUSES.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            
            <div className="records-filter-select-container">
              <label className="records-filter-label">Month</label>
              <select
                className="records-month-filter"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
              >
                {monthOptions.map(month => (
                  <option key={month.value} value={month.value}>{month.label}</option>
                ))}
              </select>
            </div>
            
            <div className="records-filter-select-container">
              <label className="records-filter-label">Year</label>
              <select
                className="records-year-filter"
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
              >
                {yearOptions.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Records Table */}
        <div className="records-table-container">
          <div className="records-table-wrapper">
            <table className="records-table">
              <thead className="records-table-header">
                <tr>
                  <th className="records-table-header-cell">ID</th>
                  <th className="records-table-header-cell">DONOR</th>
                  <th className="records-table-header-cell">HOSPITAL</th>
                  <th className="records-table-header-cell">DATE</th>
                  <th className="records-table-header-cell">STATUS</th>
                  <th className="records-table-header-cell">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="records-table-body">
                {paginatedRecords.map((record) => {
                  const isCompleted = record.status === 'Completed';
                  const canBeUsed = canMarkAsUsed(record);
                  
                  return (
                    <tr key={`${record.id}-${record.firestoreBookingId}`} className="records-table-row">
                      <td className="records-table-cell records-id-cell">
                        {record.id}
                      </td>
                      <td className="records-table-cell">
                        <div className="donor-info-cell">
                          <span className="name-text">{record.name}</span>
                          {record.eventInfo?.title && record.eventInfo.title !== 'Unknown Event' && (
                            <div className="event-info-badge">
                              <Calendar size={12} />
                              <span>{record.eventInfo.title}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="records-table-cell">
                        <div className="hospital-cell">
                          <MapPin size={12} />
                          <span className="hospital-text">{record.hospitalName || 'Unknown Hospital'}</span>
                        </div>
                      </td>
                      <td className="records-table-cell">
                        <span className="date-text">{formatDate(record.date)}</span>
                      </td>
                      <td className="records-table-cell">
                        <div className={`records-status-badge ${getStatusClasses(record)}`}>
                          {getStatusIcon(record)}
                          <span>{getStatusText(record)}</span>
                        </div>
                      </td>
                      <td className="records-table-cell">
                        <div className="records-actions-container">
                          <button
                            onClick={() => handleViewDetails(record)}
                            className="records-action-button view-button"
                            title="View Details"
                          >
                            <User className="records-action-icon" />
                          </button>
                          {/* Mark as Used Button - WITH VISUAL FEEDBACK */}
                          {record.status === 'Completed' && (
                            <button
                              onClick={() => handleMarkAsUsedClick(record)}
                              className={`records-action-button ${
                                record.donationDetails?.used ? 'used-completed' : 'used-button'
                              }`}
                              title={
                                record.donationDetails?.used 
                                  ? "Already Used" 
                                  : canMarkAsUsed(record)
                                  ? "Mark as Used"
                                  : "Cannot be used"
                              }
                              disabled={record.donationDetails?.used || !canMarkAsUsed(record)}
                            >
                              {record.donationDetails?.used ? (
                                <Heart className="records-action-icon text-green-600" fill="#10b981" />
                              ) : (
                                <Heart className="records-action-icon" />
                              )}
                            </button>
                          )}

                          {/* Show disabled heart icon for completed donations that can't be marked as used */}
                          {isCompleted && record.donationDetails && !canBeUsed && (
                            <button
                              className="records-action-button disabled-button"
                              title={
                                record.donationDetails.used 
                                  ? 'Already Used' 
                                  : record.donationDetails.status !== 'stored'
                                  ? 'Not in stored status'
                                  : !record.donationDetails.bloodType || record.donationDetails.bloodType === 'Unknown'
                                  ? 'No valid blood type'
                                  : record.donationDetails.expiryDate && new Date(record.donationDetails.expiryDate) < new Date()
                                  ? 'Expired'
                                  : 'Cannot be used'
                              }
                              disabled
                            >
                              <Heart className="records-action-icon text-gray-400" />
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteClick(record.id)}
                            className="records-action-button cancel-button"
                            title="Delete"
                            disabled={record.status === 'Completed'}
                          >
                            <XCircle className="records-action-icon" />
                          </button>

                          {/* Status-specific actions */}
                          {record.status === 'Pending' && (
                            <>
                              <button
                                onClick={() => handleCompleteClick(record)}
                                className="records-action-button approve-button"
                                title="Complete Donation"
                              >
                                <Award className="records-action-icon" />
                              </button>
                              <button
                                onClick={() => handleRegisterClick(record)}
                                className="records-action-button schedule-button"
                                title="Register"
                              >
                                <Calendar className="records-action-icon" />
                              </button>
                              <button
                                onClick={() => handleRejectClick(record)}
                                className="records-action-button reject-button"
                                title="Reject"
                              >
                                <XOctagon className="records-action-icon" />
                              </button>
                              <button
                                onClick={() => handleCancelClick(record)}
                                className="records-action-button cancel-status-button"
                                title="Cancel"
                              >
                                <Ban className="records-action-icon" />
                              </button>
                            </>
                          )}

                          {record.status === 'Registered' && (
                            <>
                              <button
                                onClick={() => handleCompleteClick(record)}
                                className="records-action-button approve-button"
                                title="Complete Donation"
                              >
                                <Award className="records-action-icon" />
                              </button>
                              <button
                                onClick={() => handleConfirmClick(record)}
                                className="records-action-button confirm-button"
                                title="Confirm"
                              >
                                <Check className="records-action-icon" />
                              </button>
                              <button
                                onClick={() => handleNoShowClick(record)}
                                className="records-action-button noshow-button"
                                title="Mark as No-show"
                              >
                                <UserX className="records-action-icon" />
                              </button>
                            </>
                          )}

                          {record.status === 'Confirmed' && (
                            <>
                              <button
                                onClick={() => handleCompleteClick(record)}
                                className="records-action-button approve-button"
                                title="Complete Donation"
                              >
                                <Award className="records-action-icon" />
                              </button>
                              <button
                                onClick={() => handleNoShowClick(record)}
                                className="records-action-button noshow-button"
                                title="Mark as No-show"
                              >
                                <UserX className="records-action-icon" />
                              </button>
                            </>
                          )}

                          {(record.status === 'Rejected' || record.status === 'Cancelled' || record.status === 'No-show') && (
                            <button
                              onClick={() => handleEdit(record)}
                              className="records-action-button reschedule-button"
                              title="Edit"
                            >
                              <Edit2 className="records-action-icon" />
                            </button>
                          )}

                          {record.status === 'Completed' && !canBeUsed && (
                            <button
                              onClick={() => handleEdit(record)}
                              className="records-action-button reschedule-button"
                              title="Edit"
                            >
                              <Edit2 className="records-action-icon" />
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

          {filteredRecords.length === 0 && !loading && (
            <div className="records-empty-state">
              <div className="records-empty-state-icon">
                <Search />
              </div>
              <h3 className="records-empty-state-title">
                {records.length === 0 ? 'No donation records found' : 'No matching records'}
              </h3>
              <p className="records-empty-state-description">
                {records.length === 0 
                  ? 'Start by adding a donation record or wait for bookings'
                  : 'Try adjusting your search filters'}
              </p>
              {records.length === 0 && (
                <button
                  onClick={handleAddClick}
                  className="add-record-button"
                  style={{ marginTop: '1rem' }}
                >
                  Add First Record
                </button>
              )}
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredRecords.length > 0 && (
          <div className="records-pagination">
            <div className="records-pagination-info">
              <span>Items per page:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                className="records-items-per-page-select"
              >
                <option value={6}>6</option>
                <option value={8}>8</option>
                <option value={12}>12</option>
                <option value={16}>16</option>
              </select>
              <span className="records-pagination-range">
                {startIndex + 1}-{Math.min(endIndex, filteredRecords.length)} of {filteredRecords.length}
              </span>
            </div>

            <div className="records-pagination-controls">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="records-pagination-btn"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="records-pagination-btn"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Mark as Used Modal */}
        {showUsedModal && usingRecord && usingHospital && hospitalBloodStock && (
          <div className="records-modal-overlay">
            <div className="records-confirm-modal">
              <div className="records-confirm-icon-container">
                <Heart className="records-confirm-icon text-green-600" />
              </div>
              <h3 className="records-confirm-title">Mark Blood as Used</h3>
              <div className="records-used-details">
                <div className="records-used-detail-row">
                  <span className="records-used-detail-label">Donor:</span>
                  <span className="records-used-detail-value">{usingRecord.name}</span>
                </div>
                <div className="records-used-detail-row">
                  <span className="records-used-detail-label">Blood Type:</span>
                  <span className="records-used-detail-value">{hospitalBloodStock.bloodType}</span>
                </div>
                <div className="records-used-detail-row">
                  <span className="records-used-detail-label">Hospital:</span>
                  <span className="records-used-detail-value">{usingHospital.name}</span>
                </div>
                <div className="records-used-detail-row">
                  <span className="records-used-detail-label">Current Stock:</span>
                  <span className="records-used-detail-value">{hospitalBloodStock.quantity} units</span>
                </div>
                <div className="records-used-detail-row">
                  <span className="records-used-detail-label">New Stock:</span>
                  <span className="records-used-detail-value">{hospitalBloodStock.quantity - 1} units</span>
                </div>
              </div>
              <p className="records-confirm-message">
                This action will mark this blood donation as used and deduct 1 unit from hospital inventory.
              </p>
              <div className="records-confirm-actions">
                <button
                  onClick={() => {
                    setShowUsedModal(false);
                    setUsingRecord(null);
                    setUsingHospital(null);
                    setHospitalBloodStock(null);
                  }}
                  className="records-confirm-button records-confirm-cancel"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitUsed}
                  className="records-confirm-button records-confirm-used"
                >
                  Mark as Used
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showModal && selectedRecord && (
          <div className="records-modal-overlay">
            <div className="records-modal-container">
              <div className="records-modal-header">
                <h2 className="records-modal-title">Edit Donation Record</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="records-modal-close"
                >
                  <X className="records-modal-close-icon" />
                </button>
              </div>
              <div className="records-modal-body">
                <div className="records-modal-form">
                  <div className="records-form-group">
                    <label className="records-form-label">Record ID</label>
                    <input
                      type="text"
                      className="records-form-input"
                      value={selectedRecord.id}
                      disabled
                    />
                  </div>
                  <div className="records-form-group">
                    <label className="records-form-label">Name</label>
                    <input
                      type="text"
                      className="records-form-input"
                      value={selectedRecord.name}
                      onChange={(e) => setSelectedRecord({ ...selectedRecord, name: e.target.value })}
                    />
                  </div>
                  <div className="records-form-group">
                    <label className="records-form-label">Address</label>
                    <input
                      type="text"
                      className="records-form-input"
                      value={selectedRecord.address}
                      onChange={(e) => setSelectedRecord({ ...selectedRecord, address: e.target.value })}
                    />
                  </div>
                  <div className="records-form-group">
                    <label className="records-form-label">Date</label>
                    <input
                      type="date"
                      className="records-form-input"
                      value={selectedRecord.date}
                      onChange={(e) => setSelectedRecord({ ...selectedRecord, date: e.target.value })}
                    />
                  </div>
                  <div className="records-form-group">
                    <label className="records-form-label">Status</label>
                    <select
                      className="records-form-select"
                      value={selectedRecord.status}
                      onChange={(e) => setSelectedRecord({ ...selectedRecord, status: e.target.value })}
                    >
                      {STATUS_OPTIONS.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="records-modal-actions">
                  <button
                    onClick={() => setShowModal(false)}
                    className="records-modal-button records-cancel-button"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        setError('');
                        setSuccess('');
                        
                        if (selectedRecord.firestoreDonationId) {
                          const donationRef = doc(db, 'donations', selectedRecord.firestoreDonationId);
                          await updateDoc(donationRef, {
                            donor_name: selectedRecord.name,
                            status: selectedRecord.status.toLowerCase() === 'completed' ? 'stored' : 
                                    selectedRecord.status.toLowerCase() === 'rejected' ? 'rejected' : 
                                    selectedRecord.status.toLowerCase() === 'cancelled' ? 'cancelled' :
                                    selectedRecord.status.toLowerCase() === 'no-show' ? 'no-show' :
                                    'pending',
                            donation_date: Timestamp.fromDate(new Date(selectedRecord.date))
                          });
                        }

                        if (selectedRecord.firestoreBookingId) {
                          const bookingRef = doc(db, 'slot_bookings', selectedRecord.firestoreBookingId);
                          await updateDoc(bookingRef, {
                            bookingStatus: selectedRecord.status.toLowerCase(),
                            updatedAt: serverTimestamp()
                          });
                          
                          if (selectedRecord.userId && selectedRecord.userId !== 'walk_in' && selectedRecord.status !== 'Pending') {
                            await sendNotification(selectedRecord.userId, {
                              title: `Donation Status Updated to ${selectedRecord.status}`,
                              message: `Your donation status has been updated to ${selectedRecord.status}`,
                              data: {
                                recordId: selectedRecord.id,
                                status: selectedRecord.status.toLowerCase(),
                                previousStatus: selectedRecord.status
                              }
                            });
                          }
                        }

                        await loadRecords();
                        setShowModal(false);
                        setSuccess('Record updated successfully!');

                      } catch (err) {
                        console.error('Error updating record:', err);
                        setError(`Failed to update record: ${err.message}`);
                      }
                    }}
                    className="records-modal-button records-save-button"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Record Modal */}
        {showAddModal && (
          <div className="records-modal-overlay">
            <div className="records-modal-container" style={{ maxWidth: '500px' }}>
              <div className="records-modal-header">
                <h2 className="records-modal-title">Add New Record</h2>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setUserSearchResults([]);
                    setShowUserDropdown(false);
                  }}
                  className="records-modal-close"
                >
                  <X className="records-modal-close-icon" />
                </button>
              </div>
              <div className="records-modal-body">
                <div className="records-modal-form">
                  <div className="records-form-group">
                    <label className="records-form-label">Search User *</label>
                    <div className="relative">
                      <input
                        type="text"
                        className="records-form-input"
                        placeholder="Search by name, email, phone, or IC..."
                        value={newRecord.name}
                        onChange={(e) => handleUserSearch(e.target.value)}
                        required
                        onFocus={() => {
                          if (newRecord.name.length >= 2) {
                            setShowUserDropdown(true);
                          }
                        }}
                      />
                      {searchingUsers && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        </div>
                      )}
                      
                      {showUserDropdown && userSearchResults.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {userSearchResults.map((user) => (
                            <div
                              key={user.id}
                              className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                              onClick={() => selectUser(user)}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium text-gray-900">{user.name}</p>
                                  <div className="flex items-center mt-1 text-sm text-gray-500">
                                    <Mail size={12} className="mr-1" />
                                    <span>{user.email}</span>
                                  </div>
                                  {user.phone && user.phone !== 'No phone' && (
                                    <div className="flex items-center mt-1 text-sm text-gray-500">
                                      <Phone size={12} className="mr-1" />
                                      <span>{user.phone}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col items-end">
                                  <span className={`text-xs px-2 py-1 rounded-full mb-1 ${
                                    user.source === 'donor_profile' 
                                      ? 'bg-green-100 text-green-800' 
                                      : user.source === 'donor_profile_only'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {user.source === 'donor_profile' 
                                      ? 'Donor' 
                                      : user.source === 'donor_profile_only'
                                      ? 'Donor (No User)'
                                      : 'User'}
                                  </span>
                                  {user.hasDonorProfile && (
                                    <span className="text-xs px-2 py-0.5 bg-red-100 text-red-800 rounded-full">
                                      Blood: {user.bloodType}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1">
                                <div className="flex items-center text-xs text-gray-600">
                                  <MapPin size={10} className="mr-1" />
                                  <span className="truncate max-w-[150px]">{user.address}</span>
                                </div>
                                {user.icNumber && user.icNumber !== 'No IC' && (
                                  <div className="flex items-center text-xs text-gray-600">
                                    <FileText size={10} className="mr-1" />
                                    <span>{user.icNumber}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {showUserDropdown && userSearchResults.length === 0 && newRecord.name.length >= 2 && !searchingUsers && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                          <div className="px-4 py-3 text-gray-500 text-center">
                            No users found. Try searching by name, email, or phone number.
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Start typing (min 2 chars) to search for existing users. Selecting a user will auto-fill their details.
                    </p>
                  </div>

                  {newRecord.userId && (
                    <div className="p-3 bg-green-50 rounded-lg mb-4">
                      <div className="flex items-start">
                        <User className="w-5 h-5 text-green-600 mr-2 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium text-green-800">{newRecord.name}</p>
                          <div className="mt-1 space-y-1">
                            <div className="flex items-center text-sm text-green-700">
                              <Mail size={12} className="mr-1" />
                              <span>{newRecord.userEmail || 'No email'}</span>
                            </div>
                            {newRecord.userPhone && newRecord.userPhone !== 'No phone' && (
                              <div className="flex items-center text-sm text-green-700">
                                <Phone size={12} className="mr-1" />
                                <span>{newRecord.userPhone}</span>
                              </div>
                            )}
                            <div className="flex items-center text-sm text-green-700">
                              <MapPin size={12} className="mr-1" />
                              <span>{newRecord.address || 'No address'}</span>
                            </div>
                            <div className="flex items-center text-sm text-green-700">
                              <span className="font-medium mr-1">Blood Type:</span>
                              <span>{newRecord.bloodType}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {!newRecord.userId && (
                    <div className="records-form-group">
                      <label className="records-form-label">Address</label>
                      <input
                        type="text"
                        className="records-form-input"
                        placeholder="Enter address"
                        value={newRecord.address}
                        onChange={(e) => setNewRecord({ ...newRecord, address: e.target.value })}
                      />
                    </div>
                  )}

                  <div className="records-form-group">
                    <label className="records-form-label">Date *</label>
                    <input
                      type="date"
                      className="records-form-input"
                      value={newRecord.date}
                      onChange={(e) => setNewRecord({ ...newRecord, date: e.target.value })}
                      required
                    />
                  </div>

                  {(!newRecord.userId || newRecord.bloodType === 'Unknown') && (
                    <div className="records-form-group">
                      <label className="records-form-label">Blood Type</label>
                      <select
                        className="records-form-select"
                        value={newRecord.bloodType}
                        onChange={(e) => setNewRecord({ ...newRecord, bloodType: e.target.value })}
                      >
                        <option value="Unknown">Unknown</option>
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
                  )}

                  <div className="records-form-group">
                    <label className="records-form-label">Status *</label>
                    <select
                      className="records-form-select"
                      value={newRecord.status}
                      onChange={(e) => setNewRecord({ ...newRecord, status: e.target.value })}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Registered">Registered</option>
                      <option value="Confirmed">Confirmed</option>
                      <option value="Completed">Completed</option>
                      <option value="Rejected">Rejected</option>
                      <option value="Cancelled">Cancelled</option>
                      <option value="No-show">No-show</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      For walk-in entries, selecting "Completed" will create a donation record.
                    </p>
                  </div>
                </div>
                
                <div className="records-modal-actions">
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setUserSearchResults([]);
                      setShowUserDropdown(false);
                    }}
                    className="records-modal-button records-cancel-button"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddSubmit}
                    disabled={!newRecord.name.trim() || !newRecord.date}
                    className="records-modal-button records-save-button"
                  >
                    Add Record
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="records-modal-overlay">
            <div className="records-confirm-modal">
              <div className="records-confirm-icon-container">
                <AlertCircle className="records-confirm-icon" />
              </div>
              <h3 className="records-confirm-title">Delete Record</h3>
              <p className="records-confirm-message">
                Are you sure you want to delete this donation record? This action cannot be undone.
              </p>
              <div className="records-confirm-actions">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="records-confirm-button records-confirm-cancel"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="records-confirm-button records-confirm-delete"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Details Modal */}
        {showDetailsModal && selectedRecord && (
          <div className="records-modal-overlay">
            <div className="records-modal-container">
              <div className="records-modal-header">
                <h2 className="records-modal-title">Donation Record Details</h2>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="records-modal-close"
                >
                  <X className="records-modal-close-icon" />
                </button>
              </div>
              <div className="records-modal-body">
                <div className="records-details-grid">
                  <div className="records-detail-item">
                    <label className="records-detail-label">Record ID</label>
                    <p className="records-detail-value">{selectedRecord.id}</p>
                  </div>
                  <div className="records-detail-item">
                    <label className="records-detail-label">Status</label>
                    <span className={`records-status-badge ${getStatusClasses(selectedRecord)}`}>
                      {getStatusIcon(selectedRecord)}
                      <span>{getStatusText(selectedRecord)}</span>
                    </span>
                  </div>
                  <div className="records-detail-item">
                    <label className="records-detail-label">Name</label>
                    <p className="records-detail-value">{selectedRecord.name}</p>
                  </div>
                  <div className="records-detail-item">
                    <label className="records-detail-label">Address</label>
                    <p className="records-detail-value">{selectedRecord.address}</p>
                  </div>
                  <div className="records-detail-item">
                    <label className="records-detail-label">Hospital</label>
                    <p className="records-detail-value">{selectedRecord.hospitalName || 'Unknown Hospital'}</p>
                  </div>
                  <div className="records-detail-item">
                    <label className="records-detail-label">Date</label>
                    <p className="records-detail-value">{formatDate(selectedRecord.date)}</p>
                  </div>
                  
                  {selectedRecord.eventInfo && (
                    <div className="records-detail-item records-detail-full-width">
                      <label className="records-detail-label">Event Information</label>
                      <div className="records-event-details-grid">
                        <div className="records-event-detail-item">
                          <span className="records-event-detail-label">Event:</span>
                          <span className="records-event-detail-value">{selectedRecord.eventInfo.title}</span>
                        </div>
                        <div className="records-event-detail-item">
                          <span className="records-event-detail-label">Location:</span>
                          <span className="records-event-detail-value">{selectedRecord.eventInfo.location}</span>
                        </div>
                        <div className="records-event-detail-item">
                          <span className="records-event-detail-label">Time:</span>
                          <span className="records-event-detail-value">{selectedRecord.eventInfo.time}</span>
                        </div>
                        <div className="records-event-detail-item">
                          <span className="records-event-detail-label">Confirmation Code:</span>
                          <span className="records-event-detail-value">{selectedRecord.eventInfo.confirmationCode}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedRecord.donationDetails && (
                    <div className="records-detail-item records-detail-full-width">
                      <label className="records-detail-label">Donation Details</label>
                      <div className="records-donation-details-grid">
                        <div className="records-donation-detail-item">
                          <span className="records-donation-detail-label">Serial Number:</span>
                          <span className="records-donation-detail-value">{selectedRecord.donationDetails.serialNumber}</span>
                        </div>
                        <div className="records-donation-detail-item">
                          <span className="records-donation-detail-label">Amount Donated:</span>
                          <span className="records-donation-detail-value">{selectedRecord.donationDetails.amountDonated} ml</span>
                        </div>
                        <div className="records-donation-detail-item">
                          <span className="records-donation-detail-label">Blood Type:</span>
                          <span className="records-donation-detail-value">{selectedRecord.donationDetails.bloodType}</span>
                        </div>
                        <div className="records-donation-detail-item">
                          <span className="records-donation-detail-label">Expiry Date:</span>
                          <span className="records-donation-detail-value">{formatDate(selectedRecord.donationDetails.expiryDate)}</span>
                        </div>
                        {selectedRecord.donationDetails.completedDate && (
                          <div className="records-donation-detail-item">
                            <span className="records-donation-detail-label">Completed Date:</span>
                            <span className="records-donation-detail-value">{formatDateTime(selectedRecord.donationDetails.completedDate)}</span>
                          </div>
                        )}
                        {selectedRecord.donationDetails.used && (
                          <div className="records-donation-detail-item">
                            <span className="records-donation-detail-label">Status:</span>
                            <span className="records-donation-detail-value text-green-600 font-semibold">Used</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="records-modal-actions">
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="records-modal-button records-cancel-button"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Completion Modal */}
        {showCompletionModal && completingRecord && (
          <div className="records-modal-overlay">
            <div className="records-completion-modal">
              <div className="records-modal-header">
                <h2 className="records-modal-title">Complete Donation</h2>
                <button
                  onClick={() => {
                    setShowCompletionModal(false);
                    setCompletionData({
                      serialNumber: '',
                      amountDonated: '',
                      expiryDate: ''
                    });
                    setCompletionErrors({});
                  }}
                  className="records-modal-close"
                >
                  <X className="records-modal-close-icon" />
                </button>
              </div>

              <div className="records-modal-body">
                <div className="records-completion-donor-info">
                  <div className="records-completion-donor-header">
                    <Award className="w-6 h-6 text-green-600" />
                    <div>
                      <h3 className="records-completion-donor-name">{completionData.donorName || completingRecord.name}</h3>
                      <p className="records-completion-donor-meta">
                        ID: {completingRecord.id} • {completingRecord.address}
                      </p>
                      <p className="records-completion-donor-meta">
                        Blood Type: <span className="font-semibold">{completionData.bloodType || 'Unknown'}</span>
                      </p>
                    </div>
                  </div>
                  {completingRecord.eventInfo && (
                    <div className="records-completion-event-info">
                      <p><strong>Event:</strong> {completingRecord.eventInfo.title}</p>
                      <p><strong>Location:</strong> {completingRecord.eventInfo.location}</p>
                      <p><strong>Time:</strong> {completingRecord.eventInfo.time}</p>
                      {completingRecord.eventInfo.confirmationCode && (
                        <p><strong>Confirmation Code:</strong> {completingRecord.eventInfo.confirmationCode}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="records-completion-form">
                  <div className="records-completion-form-group">
                    <label className="records-completion-form-label">
                      Serial Number <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      className={`records-completion-form-input ${completionErrors.serialNumber ? 'input-error' : ''}`}
                      placeholder="e.g., BLD-2025-001234"
                      value={completionData.serialNumber}
                      onChange={(e) => setCompletionData({
                        ...completionData,
                        serialNumber: e.target.value
                      })}
                    />
                    {completionErrors.serialNumber && (
                      <p className="records-completion-form-error">{completionErrors.serialNumber}</p>
                    )}
                  </div>

                  <div className="records-completion-form-group">
                    <label className="records-completion-form-label">
                      Amount Donated (ml) <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="number"
                      className={`records-completion-form-input ${completionErrors.amountDonated ? 'input-error' : ''}`}
                      placeholder="e.g., 450"
                      value={completionData.amountDonated}
                      onChange={(e) => setCompletionData({
                        ...completionData,
                        amountDonated: e.target.value
                      })}
                      min="1"
                      max="1000"
                      step="50"
                    />
                    {completionErrors.amountDonated && (
                      <p className="records-completion-form-error">{completionErrors.amountDonated}</p>
                    )}
                  </div>

                  <div className="records-completion-form-group">
                    <label className="records-completion-form-label">
                      Expiry Date <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="date"
                      className={`records-completion-form-input ${completionErrors.expiryDate ? 'input-error' : ''}`}
                      value={completionData.expiryDate}
                      onChange={(e) => setCompletionData({
                        ...completionData,
                        expiryDate: e.target.value
                      })}
                      min={new Date().toISOString().split('T')[0]}
                    />
                    {completionErrors.expiryDate && (
                      <p className="records-completion-form-error">{completionErrors.expiryDate}</p>
                    )}
                  </div>
                </div>

                <div className="records-completion-modal-actions">
                  <button
                    onClick={() => {
                      setShowCompletionModal(false);
                      setCompletionData({
                        serialNumber: '',
                        amountDonated: '',
                        expiryDate: ''
                      });
                      setCompletionErrors({});
                    }}
                    className="records-modal-button records-cancel-button"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitCompletion}
                    className="records-modal-button records-complete-button"
                  >
                    <Award className="w-4 h-4 mr-2 inline" />
                    Complete Donation
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reject Modal */}
        {showRejectModal && rejectingRecord && (
          <div className="records-modal-overlay">
            <div className="records-confirm-modal">
              <div className="records-confirm-icon-container">
                <XOctagon className="records-confirm-icon text-red-600" />
              </div>
              <h3 className="records-confirm-title">Reject Donation</h3>
              <p className="records-confirm-message">
                Are you sure you want to reject this donation request?
              </p>
              <div className="records-reject-form">
                <label className="records-form-label">Reason for Rejection (Optional)</label>
                <textarea
                  className="records-reject-textarea"
                  placeholder="Enter reason for rejection..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="records-confirm-actions">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="records-confirm-button records-confirm-cancel"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitRejection}
                  className="records-confirm-button records-confirm-reject"
                >
                  Reject Donation
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cancel Modal */}
        {showCancelModal && cancellingRecord && (
          <div className="records-modal-overlay">
            <div className="records-confirm-modal">
              <div className="records-confirm-icon-container">
                <Ban className="records-confirm-icon text-gray-600" />
              </div>
              <h3 className="records-confirm-title">Cancel Donation</h3>
              <p className="records-confirm-message">
                Are you sure you want to cancel this donation?
              </p>
              <div className="records-reject-form">
                <label className="records-form-label">Reason for Cancellation (Optional)</label>
                <textarea
                  className="records-reject-textarea"
                  placeholder="Enter reason for cancellation..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="records-confirm-actions">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="records-confirm-button records-confirm-cancel"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitCancellation}
                  className="records-confirm-button records-confirm-cancel-status"
                >
                  Cancel Donation
                </button>
              </div>
            </div>
          </div>
        )}

        {/* No-show Modal */}
        {showNoShowModal && noShowRecord && (
          <div className="records-modal-overlay">
            <div className="records-confirm-modal">
              <div className="records-confirm-icon-container">
                <UserX className="records-confirm-icon text-yellow-600" />
              </div>
              <h3 className="records-confirm-title">Mark as No-show</h3>
              <p className="records-confirm-message">
                Are you sure you want to mark this donation as no-show?
              </p>
              <div className="records-reject-form">
                <label className="records-form-label">Reason for No-show (Optional)</label>
                <textarea
                  className="records-reject-textarea"
                  placeholder="Enter reason for no-show..."
                  value={noShowReason}
                  onChange={(e) => setNoShowReason(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="records-confirm-actions">
                <button
                  onClick={() => setShowNoShowModal(false)}
                  className="records-confirm-button records-confirm-cancel"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitNoShow}
                  className="records-confirm-button records-confirm-noshow"
                >
                  Mark as No-show
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default DonationRecords;