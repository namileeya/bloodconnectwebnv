import React, { useState, useEffect } from 'react';
import { 
  Search, Calendar, Clock, MapPin, User, CheckCircle, XCircle, AlertCircle, X, 
  Users, Award, Heart
} from 'lucide-react';
import { 
  collection, getDocs, addDoc, updateDoc, 
  doc, query, where, Timestamp, serverTimestamp,
  orderBy, getDoc, increment, writeBatch, setDoc
} from 'firebase/firestore';
import { db } from '../../firebase';
import Layout from '../../components/Layout';
import './EventRegistrations.css';

const sendNotification = async (userId, notificationData) => {
  try {
    if (!userId || ['manual_entry', 'walk_in', 'unknown'].includes(userId)) return;

    const notificationRecord = {
      userId: userId,
      type: 'donation_status_update',
      title: notificationData.title,
      message: notificationData.message,
      data: notificationData.data || {},
      read: false,
      createdAt: serverTimestamp()
    };
    
    await addDoc(collection(db, 'notifications'), notificationRecord);
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};

const EventRegistrations = ({ onNavigate }) => {
    const [registrations, setRegistrations] = useState([]);
    const [events, setEvents] = useState([]);
    const [venues, setVenues] = useState([]);
    const [hospitals, setHospitals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Filters
    const [selectedEventId, setSelectedEventId] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [bloodTypeFilter, setBloodTypeFilter] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');

    // Modals
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [selectedRegistration, setSelectedRegistration] = useState(null);
    const [actionType, setActionType] = useState('');
    const [rejectionReason, setRejectionReason] = useState('');

    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [completionData, setCompletionData] = useState({
        serialNumber: '',
        amountDonated: '',
        expiryDate: ''
    });
    const [completionErrors, setCompletionErrors] = useState({});

    const [showUsedModal, setShowUsedModal] = useState(false);
    const [usingRegistration, setUsingRegistration] = useState(null);
    const [usingHospital, setUsingHospital] = useState(null);
    const [hospitalBloodStock, setHospitalBloodStock] = useState(null);

    const formatDateFromFirestore = (timestamp) => {
        try {
            if (!timestamp) return new Date();
            if (timestamp.toDate) return timestamp.toDate();
            if (timestamp instanceof Timestamp) return timestamp.toDate();
            if (typeof timestamp === 'object' && timestamp.seconds) {
                return new Timestamp(timestamp.seconds, timestamp.nanoseconds).toDate();
            }
            return new Date(timestamp);
        } catch {
            return new Date();
        }
    };

    // Load data
    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                setError('');
                
                // Load hospitals
                const hospitalsSnapshot = await getDocs(collection(db, 'hospitals'));
                const hospitalsList = hospitalsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setHospitals(hospitalsList);
                
                const hospitalNames = hospitalsList.map(h => h.name);
                
                // Load venues
                const venuesSnapshot = await getDocs(collection(db, 'venues'));
                const venuesList = venuesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setVenues(venuesList);
                
                // Load events
                const eventsSnapshot = await getDocs(collection(db, 'blood_drive_events'));
                const allEvents = [];
                const eventMap = {};
                
                eventsSnapshot.forEach(doc => {
                    const event = { id: doc.id, ...doc.data() };
                    if (event.date) {
                        event.date = formatDateFromFirestore(event.date).toISOString();
                    } else {
                        event.date = new Date().toISOString();
                    }
                    allEvents.push(event);
                    eventMap[doc.id] = event;
                });
                
                // Filter out hospital events
                const includedEvents = allEvents.filter(event => {
                    const eventLocation = (event.location || '').toLowerCase();
                    return !hospitalNames.some(hospitalName => 
                        eventLocation.includes(hospitalName.toLowerCase())
                    );
                });
                
                setEvents(includedEvents);
                const includedEventIds = new Set(includedEvents.map(e => e.id));
                
                // Load users and donor profiles
                const [usersSnapshot, donorProfilesSnapshot] = await Promise.all([
                    getDocs(collection(db, 'users')),
                    getDocs(collection(db, 'donor_profiles'))
                ]);
                
                const usersMap = {};
                usersSnapshot.forEach(doc => {
                    const userData = doc.data();
                    usersMap[doc.id] = {
                        id: doc.id,
                        displayName: userData.username || userData.displayName || userData.name || 'User',
                        email: userData.email || '',
                        phone: userData.phone_number || userData.phone || userData.mobile || '',
                        address: userData.address || '',
                        ic: userData.ic || userData.nric || userData.id_number || ''
                    };
                });
                
                const donorProfilesMap = {};
                donorProfilesSnapshot.forEach(doc => {
                    const donorData = doc.data();
                    if (donorData.user_id) {
                        donorProfilesMap[donorData.user_id] = {
                            id: doc.id,
                            full_name: donorData.full_name || donorData.name || '',
                            email: donorData.email || '',
                            phone: donorData.phone || donorData.phone_number || '',
                            address: donorData.address || '',
                            id_number: donorData.id_number || donorData.nric || donorData.ic || '',
                            blood_group: donorData.blood_group || donorData.bloodType || donorData.blood_type || 'Unknown'
                        };
                    }
                });
                
                // Load bookings
                const bookingsSnapshot = await getDocs(query(collection(db, 'slot_bookings'), orderBy('bookedAt', 'desc')));
                const bookingsArray = [];
                bookingsSnapshot.forEach(doc => {
                    bookingsArray.push({ id: doc.id, ...doc.data() });
                });
                
                // Process bookings
                const registrationsList = [];
                
                for (const booking of bookingsArray) {
                    const bookingId = booking.id;
                    
                    if (!booking.eventId || !includedEventIds.has(booking.eventId)) continue;
                    
                    const eventData = eventMap[booking.eventId];
                    if (!eventData) continue;
                    
                    // Get user information
                    let userName = 'Unknown Donor';
                    let userEmail = '';
                    let userPhone = '';
                    let userIC = '';
                    let bloodType = 'Unknown';
                    
                    const userId = booking.userId;
                    
                    if (userId && userId !== 'walk_in') {
                        if (usersMap[userId]) {
                            const user = usersMap[userId];
                            userName = user.displayName || booking.donorName || 'Unknown Donor';
                            userEmail = user.email || booking.donorEmail || '';
                            userPhone = user.phone || booking.donorPhone || '';
                            userIC = user.ic || booking.donorIC || '';
                            
                            if (donorProfilesMap[userId]) {
                                const donor = donorProfilesMap[userId];
                                bloodType = donor.blood_group || booking.donorBloodType || 'Unknown';
                                if (!userIC && donor.id_number) userIC = donor.id_number;
                            }
                        } else if (donorProfilesMap[userId]) {
                            const donor = donorProfilesMap[userId];
                            userName = donor.full_name || booking.donorName || 'Unknown Donor';
                            userEmail = donor.email || booking.donorEmail || '';
                            userPhone = donor.phone || booking.donorPhone || '';
                            userIC = donor.id_number || booking.donorIC || '';
                            bloodType = donor.blood_group || booking.donorBloodType || 'Unknown';
                        } else {
                            userName = booking.donorName || 'Registered Donor';
                            userEmail = booking.donorEmail || '';
                            userPhone = booking.donorPhone || '';
                            userIC = booking.donorIC || '';
                            bloodType = booking.donorBloodType || 'Unknown';
                        }
                    } else {
                        userName = booking.donorName || 'Walk-in Donor';
                        userEmail = booking.donorEmail || '';
                        userPhone = booking.donorPhone || '';
                        userIC = booking.donorIC || '';
                        bloodType = booking.donorBloodType || 'Unknown';
                    }
                    
                    // Try to find by email
                    const userEmailToFind = userEmail || booking.donorEmail;
                    if (userEmailToFind && (!userEmail || !userPhone || !userIC)) {
                        for (const user of Object.values(usersMap)) {
                            if (user.email === userEmailToFind) {
                                userName = user.displayName || userName;
                                userEmail = user.email || userEmail;
                                userPhone = user.phone || userPhone;
                                userIC = user.ic || userIC;
                                break;
                            }
                        }
                        
                        for (const donor of Object.values(donorProfilesMap)) {
                            if (donor.email === userEmailToFind) {
                                userName = donor.full_name || userName;
                                userEmail = donor.email || userEmail;
                                userPhone = donor.phone || userPhone;
                                userIC = donor.id_number || userIC;
                                bloodType = donor.blood_group || bloodType;
                                break;
                            }
                        }
                    }
                    
                    // Get donation details
                    let donationDetails = null;
                    if (booking.donationId) {
                        try {
                            const donationDoc = await getDoc(doc(db, 'donations', booking.donationId));
                            if (donationDoc.exists()) {
                                const donationData = donationDoc.data();
                                donationDetails = {
                                    serialNumber: donationData.serial_number || '',
                                    amountDonated: donationData.amount_ml?.toString() || '',
                                    expiryDate: donationData.expiry_date ? 
                                        formatDateFromFirestore(donationData.expiry_date).toISOString().split('T')[0] : '',
                                    completedDate: donationData.donation_date ? 
                                        formatDateFromFirestore(donationData.donation_date).toISOString().split('T')[0] : '',
                                    bloodType: donationData.blood_type || bloodType,
                                    used: donationData.used || false,
                                    usedAt: donationData.used_at ? 
                                        formatDateFromFirestore(donationData.used_at).toISOString().split('T')[0] : '',
                                    status: donationData.status || 'stored'
                                };
                            }
                        } catch (err) {
                            console.warn(`Error fetching donation:`, err);
                        }
                    }
                    
                    // Determine status
                    let status = 'Pending';
                    if (booking.bookingStatus) {
                        const bookingStatus = booking.bookingStatus.toLowerCase();
                        switch (bookingStatus) {
                            case 'completed': status = 'Completed'; break;
                            case 'registered': status = 'Registered'; break;
                            case 'confirmed': status = 'Approved'; break;
                            case 'checked_in': status = 'Checked-In'; break;
                            case 'pending': status = 'Pending'; break;
                            case 'rejected': status = 'Rejected'; break;
                            case 'cancelled': status = 'Cancelled'; break;
                            default: status = 'Pending';
                        }
                    }
                    
                    // Create registration object
                    const registration = {
                        id: bookingId,
                        eventId: booking.eventId,
                        slotId: booking.slotId || 'slot1',
                        venueId: booking.venueId || 'v1',
                        userId: booking.userId,
                        userName: userName,
                        userEmail: userEmail,
                        userPhone: userPhone,
                        userIC: userIC,
                        bloodType: bloodType,
                        selectedTime: booking.selectedTime || '10:00',
                        registrationDate: booking.bookedAt ? 
                            formatDateFromFirestore(booking.bookedAt).toISOString() : new Date().toISOString(),
                        status: status,
                        specialNotes: booking.specialNotes || '',
                        healthScreening: booking.healthScreening || {
                            feelingHealthy: true,
                            lastDonationDate: null,
                            takingMedications: false,
                            recentIllness: false
                        },
                        donationDetails: donationDetails,
                        firestoreBookingId: bookingId,
                        firestoreDonationId: booking.donationId,
                        hospitalId: eventData.assignedHospitalId,
                        hospitalName: eventData.assignedHospitalName || 'Unknown Hospital'
                    };
                    
                    registrationsList.push(registration);
                }
                
                setRegistrations(registrationsList);
                setLoading(false);
                
            } catch (err) {
                console.error('Failed to load registrations:', err);
                setError(`Failed to load registrations: ${err.message}`);
                setLoading(false);
            }
        };

        loadData();
    }, []);

    // Helper functions
    const getVenueById = (venueId) => venues.find(v => v.id === venueId);
    const getEventById = (eventId) => events.find(e => e.id === eventId);

    const getFilteredRegistrations = () => {
        let filtered = [...registrations];

        if (selectedEventId !== 'All') {
            filtered = filtered.filter(reg => reg.eventId === selectedEventId);
        }

        if (statusFilter !== 'All') {
            filtered = filtered.filter(reg => reg.status === statusFilter);
        }

        if (bloodTypeFilter !== 'All') {
            filtered = filtered.filter(reg => reg.bloodType === bloodTypeFilter);
        }

        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            filtered = filtered.filter(reg =>
                reg.userName.toLowerCase().includes(searchLower) ||
                reg.userPhone.includes(searchTerm) ||
                reg.userEmail.toLowerCase().includes(searchLower) ||
                reg.userIC.includes(searchTerm)
            );
        }

        return filtered;
    };

    const stats = {
        total: registrations.length,
        pending: registrations.filter(r => r.status === 'Pending').length,
        approved: registrations.filter(r => r.status === 'Approved').length,
        checkedIn: registrations.filter(r => r.status === 'Checked-In').length,
        completed: registrations.filter(r => r.status === 'Completed').length
    };

    const getStatusClasses = (status) => {
        switch (status) {
            case 'Registered': return 'status-registered';
            case 'Pending': return 'status-pending';
            case 'Approved': return 'status-approved';
            case 'Checked-In': return 'status-checked-in';
            case 'Completed': return 'status-completed';
            case 'Rejected': return 'status-rejected';
            case 'Cancelled': return 'status-cancelled';
            default: return 'status-default';
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const formatDateTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Action Handlers
    const handleViewDetails = (registration) => {
        setSelectedRegistration(registration);
        setShowDetailModal(true);
    };

    const handleApproveClick = (registration) => {
        setSelectedRegistration(registration);
        setActionType('approve');
        setShowConfirmModal(true);
    };

    const handleRejectClick = (registration) => {
        setSelectedRegistration(registration);
        setActionType('reject');
        setShowConfirmModal(true);
    };

    const handleCheckInClick = (registration) => {
        setSelectedRegistration(registration);
        setActionType('checkin');
        setShowConfirmModal(true);
    };

    const handleCancelClick = (registration) => {
        setSelectedRegistration(registration);
        setActionType('cancel');
        setShowConfirmModal(true);
    };

    const handleCompleteClick = (registration) => {
        setSelectedRegistration(registration);
        setCompletionData({
            serialNumber: '',
            amountDonated: '',
            expiryDate: ''
        });
        setCompletionErrors({});
        setShowCompletionModal(true);
    };

    // ACTUAL ACTION IMPLEMENTATIONS
    const handleApprove = async (registration) => {
        try {
            setError('');
            setSuccess('');
            
            const bookingRef = doc(db, 'slot_bookings', registration.firestoreBookingId);
            await updateDoc(bookingRef, {
                bookingStatus: 'confirmed',
                updatedAt: serverTimestamp()
            });
            
            const updatedRegistrations = registrations.map(reg => 
                reg.id === registration.id ? { ...reg, status: 'Approved' } : reg
            );
            
            setRegistrations(updatedRegistrations);
            setSuccess('Registration approved successfully');
            setShowConfirmModal(false);
            
            // Send notification
            if (registration.userId && registration.userId !== 'walk_in') {
                await sendNotification(registration.userId, {
                    title: 'Registration Approved! 🎉',
                    message: `Your registration for ${getEventById(registration.eventId)?.title} has been approved. Your scheduled time is ${registration.selectedTime}.`,
                    data: {
                        recordId: registration.id,
                        status: 'approved',
                        eventId: registration.eventId,
                        eventTitle: getEventById(registration.eventId)?.title,
                        timeSlot: registration.selectedTime
                    }
                });
            }
            
        } catch (err) {
            console.error('Error approving registration:', err);
            setError(`Failed to approve registration: ${err.message}`);
        }
    };

    const handleReject = async (registration, reason = '') => {
        try {
            setError('');
            setSuccess('');
            
            const bookingRef = doc(db, 'slot_bookings', registration.firestoreBookingId);
            await updateDoc(bookingRef, {
                bookingStatus: 'rejected',
                rejectionReason: reason,
                updatedAt: serverTimestamp()
            });
            
            const updatedRegistrations = registrations.map(reg => 
                reg.id === registration.id ? { ...reg, status: 'Rejected' } : reg
            );
            
            setRegistrations(updatedRegistrations);
            setSuccess('Registration rejected successfully');
            setShowConfirmModal(false);
            setRejectionReason('');
            
            // Send notification
            if (registration.userId && registration.userId !== 'walk_in') {
                await sendNotification(registration.userId, {
                    title: 'Registration Update',
                    message: reason 
                        ? `Your registration for ${getEventById(registration.eventId)?.title} was rejected. Reason: ${reason}`
                        : `Your registration for ${getEventById(registration.eventId)?.title} has been rejected.`,
                    data: {
                        recordId: registration.id,
                        status: 'rejected',
                        eventId: registration.eventId,
                        eventTitle: getEventById(registration.eventId)?.title,
                        reason: reason
                    }
                });
            }
            
        } catch (err) {
            console.error('Error rejecting registration:', err);
            setError(`Failed to reject registration: ${err.message}`);
        }
    };

    const handleCheckIn = async (registration) => {
        try {
            setError('');
            setSuccess('');
            
            const bookingRef = doc(db, 'slot_bookings', registration.firestoreBookingId);
            await updateDoc(bookingRef, {
                bookingStatus: 'checked_in',
                checkedInAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            
            const updatedRegistrations = registrations.map(reg => 
                reg.id === registration.id ? { ...reg, status: 'Checked-In' } : reg
            );
            
            setRegistrations(updatedRegistrations);
            setSuccess('Donor checked in successfully');
            setShowConfirmModal(false);
            
            // Send notification
            if (registration.userId && registration.userId !== 'walk_in') {
                await sendNotification(registration.userId, {
                    title: 'Checked In Successfully! ✅',
                    message: `You have been checked in for your donation at ${getEventById(registration.eventId)?.title}. Thank you for your contribution!`,
                    data: {
                        recordId: registration.id,
                        status: 'checked_in',
                        eventId: registration.eventId,
                        eventTitle: getEventById(registration.eventId)?.title
                    }
                });
            }
            
        } catch (err) {
            console.error('Error checking in:', err);
            setError(`Failed to check in: ${err.message}`);
        }
    };

    const handleCancel = async (registration) => {
        try {
            setError('');
            setSuccess('');
            
            const bookingRef = doc(db, 'slot_bookings', registration.firestoreBookingId);
            await updateDoc(bookingRef, {
                bookingStatus: 'cancelled',
                cancelledAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            
            const updatedRegistrations = registrations.map(reg => 
                reg.id === registration.id ? { ...reg, status: 'Cancelled' } : reg
            );
            
            setRegistrations(updatedRegistrations);
            setSuccess('Registration cancelled successfully');
            setShowConfirmModal(false);
            
            // Send notification
            if (registration.userId && registration.userId !== 'walk_in') {
                await sendNotification(registration.userId, {
                    title: 'Registration Cancelled',
                    message: `Your registration for ${getEventById(registration.eventId)?.title} has been cancelled.`,
                    data: {
                        recordId: registration.id,
                        status: 'cancelled',
                        eventId: registration.eventId,
                        eventTitle: getEventById(registration.eventId)?.title
                    }
                });
            }
            
        } catch (err) {
            console.error('Error cancelling registration:', err);
            setError(`Failed to cancel registration: ${err.message}`);
        }
    };

    const handleCompleteDonation = async (registration, completionData) => {
        try {
            setError('');
            setSuccess('');
            
            // Create donation record
            const donationData = {
                user_id: registration.userId,
                booking_id: registration.firestoreBookingId,
                event_id: registration.eventId,
                donor_name: registration.userName,
                donor_email: registration.userEmail,
                donor_phone: registration.userPhone,
                donor_ic: registration.userIC,
                blood_type: registration.bloodType,
                serial_number: completionData.serialNumber,
                amount_ml: parseInt(completionData.amountDonated) || 450,
                donation_date: serverTimestamp(),
                expiry_date: completionData.expiryDate ? Timestamp.fromDate(new Date(completionData.expiryDate)) : null,
                status: 'stored',
                used: false,
                created_at: serverTimestamp()
            };
            
            const donationRef = await addDoc(collection(db, 'donations'), donationData);
            
            // Update booking
            const bookingRef = doc(db, 'slot_bookings', registration.firestoreBookingId);
            await updateDoc(bookingRef, {
                bookingStatus: 'completed',
                donationId: donationRef.id,
                completedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            
            // Get event details for notification
            const eventDoc = await getDoc(doc(db, 'blood_drive_events', registration.eventId));
            const eventData = eventDoc.exists() ? eventDoc.data() : { title: 'Unknown Event' };
            
            // Update local state
            const updatedRegistrations = registrations.map(reg => {
                if (reg.id === registration.id) {
                    return {
                        ...reg,
                        status: 'Completed',
                        donationDetails: {
                            serialNumber: completionData.serialNumber,
                            amountDonated: completionData.amountDonated,
                            expiryDate: completionData.expiryDate,
                            completedDate: new Date().toISOString().split('T')[0],
                            bloodType: registration.bloodType,
                            used: false,
                            status: 'stored'
                        },
                        firestoreDonationId: donationRef.id
                    };
                }
                return reg;
            });
            
            setRegistrations(updatedRegistrations);
            setSuccess('Donation completed successfully');
            setShowCompletionModal(false);
            setCompletionData({ serialNumber: '', amountDonated: '', expiryDate: '' });
            
            // Send notification - FIXED: Include donationData structure
            if (registration.userId && registration.userId !== 'walk_in') {
                await sendNotification(registration.userId, {
                    title: 'Donation Completed! 🩸',
                    message: `Thank you for your blood donation at ${eventData.title}! Your contribution will save lives.`,
                    data: {
                        recordId: registration.id,
                        status: 'completed',
                        eventId: registration.eventId,
                        eventTitle: eventData.title,
                        donationId: donationRef.id,
                        donationData: {
                            id: donationRef.id,
                            serialNumber: completionData.serialNumber,
                            amountDonated: completionData.amountDonated,
                            bloodType: registration.bloodType,
                            status: 'stored'
                        }
                    }
                });
            }
            
        } catch (err) {
            console.error('Error completing donation:', err);
            setError(`Failed to complete donation: ${err.message}`);
        }
    };

    // Helper function to ensure blood stock exists
    const ensureBloodStockExists = async (hospitalId, bloodType) => {
        try {
            const bloodStockRef = doc(db, 'hospitals', hospitalId, 'bloodStock', bloodType);
            const bloodStockDoc = await getDoc(bloodStockRef);
            
            if (!bloodStockDoc.exists()) {
                // Create the blood stock document if it doesn't exist
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

    // Mark as Used functionality - FIXED: Improved hospital finding
    const getHospitalForRegistration = async (registration) => {
        try {
            if (!registration.eventId) return null;
            
            // First try to get event details
            const eventDoc = await getDoc(doc(db, 'blood_drive_events', registration.eventId));
            if (!eventDoc.exists()) return null;
            
            const eventData = eventDoc.data();
            
            // Look for hospital in different possible fields
            let hospitalId = null;
            let hospitalName = null;
            
            // Check multiple possible field names for hospital ID
            if (eventData.assignedHospitalId) {
                hospitalId = eventData.assignedHospitalId;
            } else if (eventData.hospitalId) {
                hospitalId = eventData.hospitalId;
            } else if (eventData.hospital_id) {
                hospitalId = eventData.hospital_id;
            } else if (eventData.assigned_hospital_id) {
                hospitalId = eventData.assigned_hospital_id;
            }
            
            // Check multiple possible field names for hospital name
            if (eventData.assignedHospitalName) {
                hospitalName = eventData.assignedHospitalName;
            } else if (eventData.hospitalName) {
                hospitalName = eventData.hospitalName;
            } else if (eventData.hospital_name) {
                hospitalName = eventData.hospital_name;
            } else if (eventData.assigned_hospital_name) {
                hospitalName = eventData.assigned_hospital_name;
            }
            
            console.log('Event Data:', eventData);
            console.log('Found hospitalId:', hospitalId);
            console.log('Found hospitalName:', hospitalName);
            
            // If we have a hospital ID, try to get the hospital details
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
                    console.error('Error fetching hospital:', hospitalErr);
                }
            }
            
            // If we have hospital name but no ID, check if it exists in hospitals list
            if (hospitalName) {
                const hospital = hospitals.find(h => 
                    h.name.toLowerCase() === hospitalName.toLowerCase() ||
                    (h.name && hospitalName && h.name.toLowerCase().includes(hospitalName.toLowerCase())) ||
                    (hospitalName && h.name && hospitalName.toLowerCase().includes(h.name.toLowerCase()))
                );
                
                if (hospital) {
                    return {
                        id: hospital.id,
                        name: hospital.name,
                        ...hospital
                    };
                }
            }
            
            // Try to get hospital from registration data
            if (registration.hospitalId) {
                try {
                    const hospitalDoc = await getDoc(doc(db, 'hospitals', registration.hospitalId));
                    if (hospitalDoc.exists()) {
                        const hospital = hospitalDoc.data();
                        return {
                            id: registration.hospitalId,
                            name: registration.hospitalName || hospital.name || 'Unknown Hospital',
                            ...hospital
                        };
                    }
                } catch (hospitalErr) {
                    console.error('Error fetching hospital from registration:', hospitalErr);
                }
            }
            
            // If still no hospital, try the first hospital from the list as fallback
            if (hospitals.length > 0) {
                console.log('Using fallback hospital:', hospitals[0]);
                return {
                    id: hospitals[0].id,
                    name: hospitals[0].name,
                    ...hospitals[0]
                };
            }
            
            return null;
            
        } catch (err) {
            console.error('Error getting hospital:', err);
            return null;
        }
    };

    const getBloodStockForHospital = async (hospitalId, bloodType) => {
        try {
            if (!hospitalId || !bloodType) return null;
            
            console.log(`Looking for blood stock: Hospital=${hospitalId}, BloodType=${bloodType}`);
            
            // First try to get the specific blood type document
            try {
                const bloodStockDoc = await getDoc(doc(db, 'hospitals', hospitalId, 'bloodStock', bloodType));
                if (bloodStockDoc.exists()) {
                    console.log(`Found blood stock document with ID: ${bloodType}`);
                    return { 
                        id: bloodType, 
                        bloodType: bloodType,
                        ...bloodStockDoc.data() 
                    };
                }
            } catch (docErr) {
                console.log(`No direct document found for ${bloodType}, searching...`);
            }
            
            // If not found, search through all blood stock documents
            const bloodStockSnapshot = await getDocs(collection(db, 'hospitals', hospitalId, 'bloodStock'));
            
            console.log(`Found ${bloodStockSnapshot.docs.length} blood stock documents`);
            
            // Try to find matching blood type (case insensitive, with various formats)
            for (const doc of bloodStockSnapshot.docs) {
                const stockData = doc.data();
                const docBloodType = stockData.bloodType || doc.id;
                console.log(`Checking document: ID=${doc.id}, bloodType=${docBloodType}`);
                
                // Try different matching strategies
                const normalizedDocType = docBloodType.toLowerCase().replace(/[^a-z0-9+]/g, '');
                const normalizedSearchType = bloodType.toLowerCase().replace(/[^a-z0-9+]/g, '');
                
                if (normalizedDocType === normalizedSearchType) {
                    console.log(`Found matching blood type: ${docBloodType}`);
                    return {
                        id: doc.id,  // IMPORTANT: Use the actual document ID
                        bloodType: docBloodType,
                        ...stockData
                    };
                }
            }
            
            // If still not found, check if we should create one
            console.log(`No existing blood stock found for ${bloodType}, creating default entry`);
            return {
                id: bloodType,  // Use bloodType as document ID
                bloodType: bloodType,
                quantity: 0,
                minimumLevel: 10,
                criticalLevel: 5,
                lastUpdated: new Date()
            };
            
        } catch (err) {
            console.error('Error getting blood stock:', err);
            return null;
        }
    };

    const canMarkAsUsed = (registration) => {
        if (registration.status !== 'Completed') return false;
        if (!registration.donationDetails) return false;
        if (registration.donationDetails.used) return false;
        if (registration.donationDetails.status !== 'stored') return false;
        if (registration.donationDetails.expiryDate) {
            const expiryDate = new Date(registration.donationDetails.expiryDate);
            if (expiryDate < new Date()) return false;
        }
        if (!registration.donationDetails.bloodType || registration.donationDetails.bloodType === 'Unknown') return false;
        return true;
    };

    const handleMarkAsUsedClick = async (registration) => {
        try {
            setUsingRegistration(registration);
            
            // Debug: Log registration details
            console.log('Registration details:', {
                id: registration.id,
                eventId: registration.eventId,
                hospitalId: registration.hospitalId,
                hospitalName: registration.hospitalName,
                donationDetails: registration.donationDetails
            });
            
            const hospital = await getHospitalForRegistration(registration);
            
            if (!hospital) {
                console.error('No hospital found for registration:', registration);
                setError('Cannot find hospital information for this event. Please assign a hospital to the event first.');
                return;
            }
            
            console.log('Found hospital:', hospital);
            
            let bloodType = 'Unknown';
            if (registration.donationDetails?.bloodType && registration.donationDetails.bloodType !== 'Unknown') {
                bloodType = registration.donationDetails.bloodType;
            } else if (registration.bloodType && registration.bloodType !== 'Unknown') {
                bloodType = registration.bloodType;
            }
            
            if (!bloodType || bloodType === 'Unknown') {
                setError('Blood type is unknown');
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
        if (!usingRegistration || !usingHospital || !hospitalBloodStock) return;
        
        try {
            setError('');
            setSuccess('');
            
            // Ensure blood stock document exists
            await ensureBloodStockExists(usingHospital.id, hospitalBloodStock.bloodType);
            
            const batch = writeBatch(db);
            
            // Get event and donation details
            const eventDoc = await getDoc(doc(db, 'blood_drive_events', usingRegistration.eventId));
            const eventData = eventDoc.exists() ? eventDoc.data() : { title: 'Unknown Event' };
            
            // Update donation record
            if (usingRegistration.firestoreDonationId) {
                const donationRef = doc(db, 'donations', usingRegistration.firestoreDonationId);
                batch.update(donationRef, {
                    used: true,
                    used_at: serverTimestamp(),
                    status: 'used',
                    used_hospital_id: usingHospital.id,
                    used_hospital_name: usingHospital.name
                });
            }
            
            // Update blood stock - use the correct document ID
            const bloodStockRef = doc(db, 'hospitals', usingHospital.id, 'bloodStock', hospitalBloodStock.bloodType);
            
            // Get current document to ensure we have the latest data
            const currentStockDoc = await getDoc(bloodStockRef);
            let currentQuantity = 0;
            
            if (currentStockDoc.exists()) {
                const currentData = currentStockDoc.data();
                currentQuantity = parseInt(currentData.quantity) || 0;
            } else {
                // If document doesn't exist (shouldn't happen after ensureBloodStockExists), create it
                batch.set(bloodStockRef, {
                    bloodType: hospitalBloodStock.bloodType,
                    quantity: 0,
                    minimumLevel: 10,
                    criticalLevel: 5,
                    lastUpdated: serverTimestamp(),
                    createdAt: serverTimestamp()
                });
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
            
            // Also update the booking status if it exists
            if (usingRegistration.firestoreBookingId) {
                const bookingRef = doc(db, 'slot_bookings', usingRegistration.firestoreBookingId);
                batch.update(bookingRef, {
                    bloodUsed: true,
                    usedAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            }
            
            await batch.commit();
            
            // Update local state
            const updatedRegistrations = registrations.map(reg => {
                if (reg.id === usingRegistration.id) {
                    return {
                        ...reg,
                        donationDetails: reg.donationDetails ? {
                            ...reg.donationDetails,
                            used: true,
                            status: 'used',
                            usedAt: new Date().toISOString().split('T')[0],
                            usedHospitalId: usingHospital.id,
                            usedHospitalName: usingHospital.name
                        } : null
                    };
                }
                return reg;
            });
            
            setRegistrations(updatedRegistrations);
            
            // Send notification
            if (usingRegistration.userId && usingRegistration.userId !== 'walk_in') {
                await sendNotification(usingRegistration.userId, {
                    title: 'Your Blood Saved a Life! ❤️',
                    message: `Your donated blood (${hospitalBloodStock.bloodType}) has been used to save a life at ${usingHospital.name}. Thank you for your donation!`,
                    data: {
                        recordId: usingRegistration.id,
                        status: 'used',
                        eventId: usingRegistration.eventId,
                        eventTitle: eventData.title || 'Unknown Event',
                        bloodType: hospitalBloodStock.bloodType,
                        hospitalName: usingHospital.name,
                        usedDate: new Date().toISOString().split('T')[0],
                        donationData: {
                            id: usingRegistration.firestoreDonationId,
                            serialNumber: usingRegistration.donationDetails?.serialNumber || '',
                            bloodType: hospitalBloodStock.bloodType,
                            used: true,
                            status: 'used',
                            usedHospitalId: usingHospital.id,
                            usedHospitalName: usingHospital.name
                        }
                    }
                });
            }
            
            setSuccess(`Blood marked as used successfully! Inventory updated for ${usingHospital.name}. New stock: ${newQuantity} units of ${hospitalBloodStock.bloodType}`);
            setShowUsedModal(false);
            setUsingRegistration(null);
            setUsingHospital(null);
            setHospitalBloodStock(null);
            
        } catch (err) {
            console.error('Error marking blood as used:', err);
            console.error('Error details:', {
                hospitalId: usingHospital?.id,
                bloodType: hospitalBloodStock?.bloodType,
                errorCode: err.code,
                errorMessage: err.message
            });
            
            if (err.code === 'not-found') {
                setError(`Hospital or blood stock document not found. Hospital ID: ${usingHospital?.id}, Blood Type: ${hospitalBloodStock?.bloodType}. Please check if the hospital has blood inventory setup.`);
            } else if (err.code === 'permission-denied') {
                setError('Permission denied. You may not have write access to the blood stock collection.');
            } else {
                setError(`Failed to mark blood as used: ${err.message}`);
            }
        }
    };

    // Handle confirm modal actions
    const handleConfirmAction = () => {
        if (!selectedRegistration) return;
        
        switch (actionType) {
            case 'approve':
                handleApprove(selectedRegistration);
                break;
            case 'reject':
                handleReject(selectedRegistration, rejectionReason);
                break;
            case 'checkin':
                handleCheckIn(selectedRegistration);
                break;
            case 'cancel':
                handleCancel(selectedRegistration);
                break;
        }
    };

    // Handle completion form submit
    const handleCompletionSubmit = () => {
        if (!selectedRegistration) return;
        
        // Validate
        const errors = {};
        if (!completionData.serialNumber.trim()) errors.serialNumber = 'Serial number is required';
        if (!completionData.amountDonated.trim()) errors.amountDonated = 'Amount donated is required';
        if (!completionData.expiryDate.trim()) errors.expiryDate = 'Expiry date is required';
        
        if (Object.keys(errors).length > 0) {
            setCompletionErrors(errors);
            return;
        }
        
        handleCompleteDonation(selectedRegistration, completionData);
    };

    if (loading) {
        return (
            <Layout onNavigate={onNavigate} currentPage="event-registrations">
                <div className="loading-container">
                    <div className="loading-content">
                        <div className="loading-spinner"></div>
                        <p className="loading-text">Loading registrations...</p>
                    </div>
                </div>
            </Layout>
        );
    }

    const filteredRegs = getFilteredRegistrations();

    return (
        <Layout onNavigate={onNavigate} currentPage="event-registrations">
            <div className="space-y-6">
                {/* Header */}
                <div className="registration-header-container">
                    <h1 className="registration-header-title">Event Registrations</h1>
                    <button className="export-button">
                        Export Data
                    </button>
                </div>

                {/* Error/Success Messages */}
                {error && (
                    <div className="error-container">
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

                {/* Stats Cards */}
                <div className="registration-stats-grid">
                    <div className="registration-stat-card stat-card-total">
                        <Users className="stat-icon text-blue-600" />
                        <div>
                            <h3 className="stat-number-blue">{stats.total}</h3>
                            <p className="stat-label">Total Registrations</p>
                        </div>
                    </div>
                    <div className="registration-stat-card stat-card-pending">
                        <Clock className="stat-icon text-purple-600" />
                        <div>
                            <h3 className="stat-number-purple">{stats.pending}</h3>
                            <p className="stat-label">Pending Review</p>
                        </div>
                    </div>
                    <div className="registration-stat-card stat-card-approved">
                        <CheckCircle className="stat-icon text-green-600" />
                        <div>
                            <h3 className="stat-number-green">{stats.approved}</h3>
                            <p className="stat-label">Approved</p>
                        </div>
                    </div>
                    <div className="registration-stat-card stat-card-checkedin">
                        <MapPin className="stat-icon text-orange-600" />
                        <div>
                            <h3 className="stat-number-orange">{stats.checkedIn}</h3>
                            <p className="stat-label">Checked-In</p>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="registration-filters-container">
                    <div className="registration-filters-row">
                        <div className="registration-search-input-container">
                            <Search className="registration-search-icon" />
                            <input
                                type="text"
                                placeholder="Search by name, phone, email, or IC..."
                                className="registration-search-input"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <select
                            className="registration-event-filter"
                            value={selectedEventId}
                            onChange={(e) => setSelectedEventId(e.target.value)}
                        >
                            <option value="All">All Events</option>
                            {events.map(evt => (
                                <option key={evt.id} value={evt.id}>
                                    {evt.title} - {formatDate(evt.date)}
                                </option>
                            ))}
                        </select>
                        <select
                            className="registration-status-filter"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="All">All Status</option>
                            <option value="Registered">Registered</option>
                            <option value="Pending">Pending</option>
                            <option value="Approved">Approved</option>
                            <option value="Checked-In">Checked-In</option>
                            <option value="Completed">Completed</option>
                            <option value="Rejected">Rejected</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                        <select
                            className="registration-bloodtype-filter"
                            value={bloodTypeFilter}
                            onChange={(e) => setBloodTypeFilter(e.target.value)}
                        >
                            <option value="All">All Blood Types</option>
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
                </div>

                {/* List View */}
                <div className="registration-table-container">
                    <div className="registration-table-wrapper">
                        <table className="registration-table">
                            <thead className="registration-table-header">
                                <tr>
                                    <th className="registration-table-header-cell">NAME</th>
                                    <th className="registration-table-header-cell">CONTACT</th>
                                    <th className="registration-table-header-cell">EVENT</th>
                                    <th className="registration-table-header-cell">SLOT</th>
                                    <th className="registration-table-header-cell">BLOOD TYPE</th>
                                    <th className="registration-table-header-cell">STATUS</th>
                                    <th className="registration-table-header-cell">ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody className="registration-table-body">
                                {filteredRegs.map(reg => {
                                    const event = getEventById(reg.eventId);
                                    const venue = getVenueById(reg.venueId);
                                    const canBeUsed = canMarkAsUsed(reg);
                                    const isCompleted = reg.status === 'Completed';
                                    const isUsed = reg.donationDetails?.used;

                                    return (
                                        <tr key={reg.id} className="registration-table-row">
                                            <td className="registration-table-cell">
                                                <div className="donor-info">
                                                    <span className="donor-name">{reg.userName}</span>
                                                    <span className="donor-ic">{reg.userIC || 'N/A'}</span>
                                                </div>
                                            </td>
                                            <td className="registration-table-cell">
                                                <div className="contact-info">
                                                    <span className="contact-phone">{reg.userPhone || 'No phone'}</span>
                                                    <span className="contact-email">{reg.userEmail || 'No email'}</span>
                                                </div>
                                            </td>
                                            <td className="registration-table-cell">
                                                <div className="event-info">
                                                    <span className="event-name">{event?.title || 'Unknown Event'}</span>
                                                    <span className="event-date">{event ? formatDate(event.date) : '-'}</span>
                                                </div>
                                            </td>
                                            <td className="registration-table-cell">
                                                <div className="slot-info">
                                                    <span className="slot-time">{reg.selectedTime}</span>
                                                    <span className="slot-venue">{venue?.name || event?.location || 'Unknown'}</span>
                                                </div>
                                            </td>
                                            <td className="registration-table-cell">
                                                <span className="blood-type-badge">{reg.bloodType}</span>
                                            </td>
                                            <td className="registration-table-cell">
                                                <span className={`registration-status-badge ${getStatusClasses(reg.status)}`}>
                                                    {reg.status}
                                                </span>
                                            </td>
                                            <td className="registration-table-cell">
                                                <div className="registration-actions-container">
                                                    <button
                                                        onClick={() => handleViewDetails(reg)}
                                                        className="registration-action-button view-button"
                                                        title="View Details"
                                                    >
                                                        <User className="registration-action-icon" />
                                                    </button>
                                                    
                                                    {isCompleted && (
                                                        <button
                                                            onClick={() => handleMarkAsUsedClick(reg)}
                                                            className={`registration-action-button ${isUsed ? 'used-completed' : 'used-button'}`}
                                                            title={isUsed ? "Already Used" : "Mark as Used"}
                                                            disabled={isUsed || !canBeUsed}
                                                        >
                                                            {isUsed ? (
                                                                <Heart className="registration-action-icon text-green-600" fill="#10b981" />
                                                            ) : (
                                                                <Heart className="registration-action-icon" />
                                                            )}
                                                        </button>
                                                    )}
                                                    
                                                    {reg.status === 'Pending' && (
                                                        <>
                                                            <button
                                                                onClick={() => handleApproveClick(reg)}
                                                                className="registration-action-button approve-button"
                                                                title="Approve"
                                                            >
                                                                <CheckCircle className="registration-action-icon" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleRejectClick(reg)}
                                                                className="registration-action-button reject-button"
                                                                title="Reject"
                                                            >
                                                                <XCircle className="registration-action-icon" />
                                                            </button>
                                                        </>
                                                    )}
                                                    {reg.status === 'Approved' && (
                                                        <button
                                                            onClick={() => handleCheckInClick(reg)}
                                                            className="registration-action-button checkin-button"
                                                            title="Check-in"
                                                        >
                                                            <MapPin className="registration-action-icon" />
                                                        </button>
                                                    )}
                                                    {reg.status === 'Checked-In' && (
                                                        <button
                                                            onClick={() => handleCompleteClick(reg)}
                                                            className="registration-action-button complete-button"
                                                            title="Complete Donation"
                                                        >
                                                            <Award className="registration-action-icon" />
                                                        </button>
                                                    )}
                                                    {(reg.status === 'Pending' || reg.status === 'Approved') && (
                                                        <button
                                                            onClick={() => handleCancelClick(reg)}
                                                            className="registration-action-button cancel-button"
                                                            title="Cancel"
                                                        >
                                                            <XCircle className="registration-action-icon" />
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

                    {filteredRegs.length === 0 && !loading && (
                        <div className="registration-empty-state">
                            <Calendar className="registration-empty-icon" />
                            <h3 className="registration-empty-title">No registrations found</h3>
                            <p className="registration-empty-description">
                                Try adjusting your search filters
                            </p>
                        </div>
                    )}
                </div>

                {/* Detail Modal */}
                {showDetailModal && selectedRegistration && (
                    <div className="registration-modal-overlay">
                        <div className="registration-modal-container">
                            <div className="registration-modal-header">
                                <h2 className="registration-modal-title">Registration Details</h2>
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="registration-modal-close"
                                >
                                    <X className="registration-modal-close-icon" />
                                </button>
                            </div>
                            
                            <div className="registration-modal-body">
                                <div className="mb-8">
                                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Donor Information</h3>
                                    <div className="detail-grid">
                                        <div className="detail-item">
                                            <span className="detail-label">Full Name:</span>
                                            <span className="detail-value">{selectedRegistration.userName}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="detail-label">IC Number:</span>
                                            <span className="detail-value">{selectedRegistration.userIC || 'N/A'}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="detail-label">Email:</span>
                                            <span className="detail-value">{selectedRegistration.userEmail}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="detail-label">Phone:</span>
                                            <span className="detail-value">{selectedRegistration.userPhone}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="detail-label">Blood Type:</span>
                                            <span className="detail-value">
                                                <span className={`blood-type-badge ${selectedRegistration.bloodType}`}>
                                                    {selectedRegistration.bloodType}
                                                </span>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mb-8">
                                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Event Information</h3>
                                    <div className="detail-grid">
                                        <div className="detail-item">
                                            <span className="detail-label">Event:</span>
                                            <span className="detail-value">
                                                {getEventById(selectedRegistration.eventId)?.title || 'Unknown Event'}
                                            </span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="detail-label">Date:</span>
                                            <span className="detail-value">
                                                {formatDate(getEventById(selectedRegistration.eventId)?.date)}
                                            </span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="detail-label">Time Slot:</span>
                                            <span className="detail-value">{selectedRegistration.selectedTime}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="detail-label">Venue:</span>
                                            <span className="detail-value">
                                                {getVenueById(selectedRegistration.venueId)?.name || 
                                                 getEventById(selectedRegistration.eventId)?.location || 
                                                 'Unknown Venue'}
                                            </span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="detail-label">Registration Date:</span>
                                            <span className="detail-value">
                                                {formatDateTime(selectedRegistration.registrationDate)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mb-8">
                                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Status Information</h3>
                                    <div className="detail-grid">
                                        <div className="detail-item">
                                            <span className="detail-label">Status:</span>
                                            <span className="detail-value">
                                                <span className={`registration-status-badge ${getStatusClasses(selectedRegistration.status)}`}>
                                                    {selectedRegistration.status}
                                                </span>
                                            </span>
                                        </div>
                                        {selectedRegistration.hospitalName && (
                                            <div className="detail-item">
                                                <span className="detail-label">Assigned Hospital:</span>
                                                <span className="detail-value">{selectedRegistration.hospitalName}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {selectedRegistration.donationDetails && (
                                    <div className="mb-8">
                                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Donation Details</h3>
                                        <div className="donation-details-grid">
                                            {selectedRegistration.donationDetails.serialNumber && (
                                                <div className="donation-detail-item">
                                                    <span className="donation-detail-label">Serial Number:</span>
                                                    <span className="donation-detail-value">{selectedRegistration.donationDetails.serialNumber}</span>
                                                </div>
                                            )}
                                            {selectedRegistration.donationDetails.amountDonated && (
                                                <div className="donation-detail-item">
                                                    <span className="donation-detail-label">Amount Donated:</span>
                                                    <span className="donation-detail-value">{selectedRegistration.donationDetails.amountDonated} ml</span>
                                                </div>
                                            )}
                                            {selectedRegistration.donationDetails.completedDate && (
                                                <div className="donation-detail-item">
                                                    <span className="donation-detail-label">Donation Date:</span>
                                                    <span className="donation-detail-value">{selectedRegistration.donationDetails.completedDate}</span>
                                                </div>
                                            )}
                                            {selectedRegistration.donationDetails.expiryDate && (
                                                <div className="donation-detail-item">
                                                    <span className="donation-detail-label">Expiry Date:</span>
                                                    <span className="donation-detail-value">{selectedRegistration.donationDetails.expiryDate}</span>
                                                </div>
                                            )}
                                            <div className="donation-detail-item">
                                                <span className="donation-detail-label">Blood Type:</span>
                                                <span className="donation-detail-value">
                                                    {selectedRegistration.donationDetails.bloodType || selectedRegistration.bloodType}
                                                </span>
                                            </div>
                                            <div className="donation-detail-item">
                                                <span className="donation-detail-label">Used:</span>
                                                <span className="donation-detail-value">
                                                    {selectedRegistration.donationDetails.used ? (
                                                        <span className="inline-flex items-center gap-1 text-green-600 font-semibold">
                                                            <Heart className="w-3 h-3" fill="#10b981" />
                                                            Yes {selectedRegistration.donationDetails.usedAt && `(on ${selectedRegistration.donationDetails.usedAt})`}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-600">No</span>
                                                    )}
                                                </span>
                                            </div>
                                            <div className="donation-detail-item">
                                                <span className="donation-detail-label">Status:</span>
                                                <span className="donation-detail-value">
                                                    {selectedRegistration.donationDetails.status || 'stored'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {selectedRegistration.healthScreening && (
                                    <div className="mb-8">
                                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Health Screening</h3>
                                        <div className="health-screening-grid">
                                            <div className="health-item">
                                                <span className="health-label">Feeling Healthy:</span>
                                                <span className="detail-value">
                                                    {selectedRegistration.healthScreening.feelingHealthy ? 'Yes' : 'No'}
                                                </span>
                                            </div>
                                            <div className="health-item">
                                                <span className="health-label">Taking Medications:</span>
                                                <span className="detail-value">
                                                    {selectedRegistration.healthScreening.takingMedications ? 'Yes' : 'No'}
                                                </span>
                                            </div>
                                            <div className="health-item">
                                                <span className="health-label">Recent Illness:</span>
                                                <span className="detail-value">
                                                    {selectedRegistration.healthScreening.recentIllness ? 'Yes' : 'No'}
                                                </span>
                                            </div>
                                            {selectedRegistration.healthScreening.lastDonationDate && (
                                                <div className="health-item">
                                                    <span className="health-label">Last Donation Date:</span>
                                                    <span className="detail-value">
                                                        {formatDate(selectedRegistration.healthScreening.lastDonationDate)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {selectedRegistration.specialNotes && (
                                    <div className="mb-8">
                                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Special Notes</h3>
                                        <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{selectedRegistration.specialNotes}</p>
                                    </div>
                                )}
                            </div>

                            <div className="registration-modal-actions">
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="registration-modal-button registration-close-button"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Confirm Modal */}
                {showConfirmModal && selectedRegistration && (
                    <div className="registration-modal-overlay">
                        <div className="registration-confirm-modal">
                            <div className="registration-confirm-icon-container">
                                {actionType === 'approve' && <CheckCircle className="registration-confirm-icon approve-icon" />}
                                {actionType === 'reject' && <XCircle className="registration-confirm-icon reject-icon" />}
                                {actionType === 'checkin' && <MapPin className="registration-confirm-icon checkin-icon" />}
                                {actionType === 'cancel' && <XCircle className="registration-confirm-icon cancel-icon" />}
                            </div>
                            <h3 className="registration-confirm-title">
                                {actionType === 'approve' && 'Approve Registration'}
                                {actionType === 'reject' && 'Reject Registration'}
                                {actionType === 'checkin' && 'Check-in Donor'}
                                {actionType === 'cancel' && 'Cancel Registration'}
                            </h3>
                            <div className="registration-confirm-details">
                                <p><strong>Donor:</strong> {selectedRegistration.userName}</p>
                                <p><strong>Event:</strong> {getEventById(selectedRegistration.eventId)?.title}</p>
                                <p><strong>Time Slot:</strong> {selectedRegistration.selectedTime}</p>
                            </div>
                            
                            {actionType === 'reject' && (
                                <div className="rejection-reason-container">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Rejection Reason (Optional)
                                    </label>
                                    <textarea
                                        className="rejection-textarea"
                                        rows="3"
                                        placeholder="Enter reason for rejection..."
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                    />
                                </div>
                            )}
                            
                            <p className="registration-confirm-message">
                                {actionType === 'approve' && 'Are you sure you want to approve this registration?'}
                                {actionType === 'reject' && 'Are you sure you want to reject this registration?'}
                                {actionType === 'checkin' && 'Mark this donor as checked-in for their appointment?'}
                                {actionType === 'cancel' && 'Are you sure you want to cancel this registration?'}
                            </p>
                            <div className="registration-confirm-actions">
                                <button
                                    onClick={() => {
                                        setShowConfirmModal(false);
                                        setRejectionReason('');
                                    }}
                                    className="registration-confirm-button registration-confirm-cancel"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmAction}
                                    className={`registration-confirm-button ${
                                        actionType === 'approve' ? 'registration-confirm-approve' :
                                        actionType === 'reject' ? 'registration-confirm-reject' :
                                        actionType === 'checkin' ? 'registration-confirm-checkin' :
                                        'registration-confirm-delete'
                                    }`}
                                >
                                    {actionType === 'approve' && 'Approve'}
                                    {actionType === 'reject' && 'Reject'}
                                    {actionType === 'checkin' && 'Check-in'}
                                    {actionType === 'cancel' && 'Cancel'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Completion Modal */}
                {showCompletionModal && selectedRegistration && (
                    <div className="registration-modal-overlay">
                        <div className="registration-completion-modal">
                            <div className="registration-modal-header">
                                <h2 className="registration-modal-title">Complete Donation</h2>
                                <button
                                    onClick={() => setShowCompletionModal(false)}
                                    className="registration-modal-close"
                                >
                                    <X className="registration-modal-close-icon" />
                                </button>
                            </div>
                            
                            <div className="registration-modal-body">
                                <div className="completion-donor-info">
                                    <div className="completion-donor-header">
                                        <div>
                                            <h3 className="completion-donor-name">{selectedRegistration.userName}</h3>
                                            <p className="completion-donor-meta">
                                                {selectedRegistration.bloodType} • {selectedRegistration.userIC || 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="completion-event-info">
                                        <p><strong>Event:</strong> {getEventById(selectedRegistration.eventId)?.title}</p>
                                        <p><strong>Time Slot:</strong> {selectedRegistration.selectedTime}</p>
                                    </div>
                                </div>
                                
                                <div className="completion-form">
                                    <div className="completion-form-group">
                                        <label className="completion-form-label">Serial Number *</label>
                                        <input
                                            type="text"
                                            className={`completion-form-input ${completionErrors.serialNumber ? 'input-error' : ''}`}
                                            placeholder="Enter blood bag serial number"
                                            value={completionData.serialNumber}
                                            onChange={(e) => setCompletionData({...completionData, serialNumber: e.target.value})}
                                        />
                                        {completionErrors.serialNumber && (
                                            <span className="completion-form-error">{completionErrors.serialNumber}</span>
                                        )}
                                    </div>
                                    
                                    <div className="completion-form-group">
                                        <label className="completion-form-label">Amount Donated (ml) *</label>
                                        <input
                                            type="number"
                                            className={`completion-form-input ${completionErrors.amountDonated ? 'input-error' : ''}`}
                                            placeholder="Enter amount in ml"
                                            value={completionData.amountDonated}
                                            onChange={(e) => setCompletionData({...completionData, amountDonated: e.target.value})}
                                        />
                                        {completionErrors.amountDonated && (
                                            <span className="completion-form-error">{completionErrors.amountDonated}</span>
                                        )}
                                    </div>
                                    
                                    <div className="completion-form-group">
                                        <label className="completion-form-label">Expiry Date *</label>
                                        <input
                                            type="date"
                                            className={`completion-form-input ${completionErrors.expiryDate ? 'input-error' : ''}`}
                                            value={completionData.expiryDate}
                                            onChange={(e) => setCompletionData({...completionData, expiryDate: e.target.value})}
                                        />
                                        {completionErrors.expiryDate && (
                                            <span className="completion-form-error">{completionErrors.expiryDate}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="completion-modal-actions">
                                <button
                                    onClick={() => setShowCompletionModal(false)}
                                    className="registration-modal-button registration-close-button"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCompletionSubmit}
                                    className="registration-modal-button registration-complete-button"
                                >
                                    Complete Donation
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Mark as Used Modal */}
                {showUsedModal && usingRegistration && usingHospital && hospitalBloodStock && (
                    <div className="registration-modal-overlay">
                        <div className="registration-confirm-modal">
                            <div className="registration-confirm-icon-container">
                                <Heart className="registration-confirm-icon text-green-600" />
                            </div>
                            <h3 className="registration-confirm-title">Mark Blood as Used</h3>
                            <div className="registration-used-details">
                                <div className="registration-used-detail-row">
                                    <span className="registration-used-detail-label">Donor:</span>
                                    <span className="registration-used-detail-value">{usingRegistration.userName}</span>
                                </div>
                                <div className="registration-used-detail-row">
                                    <span className="registration-used-detail-label">Blood Type:</span>
                                    <span className="registration-used-detail-value">{hospitalBloodStock.bloodType}</span>
                                </div>
                                <div className="registration-used-detail-row">
                                    <span className="registration-used-detail-label">Hospital:</span>
                                    <span className="registration-used-detail-value">{usingHospital.name}</span>
                                </div>
                                <div className="registration-used-detail-row">
                                    <span className="registration-used-detail-label">Current Stock:</span>
                                    <span className="registration-used-detail-value">{hospitalBloodStock.quantity} units</span>
                                </div>
                                <div className="registration-used-detail-row">
                                    <span className="registration-used-detail-label">New Stock:</span>
                                    <span className="registration-used-detail-value">{hospitalBloodStock.quantity - 1} units</span>
                                </div>
                            </div>
                            <p className="registration-confirm-message">
                                This action will mark this blood donation as used and deduct 1 unit from hospital inventory.
                            </p>
                            <div className="registration-confirm-actions">
                                <button
                                    onClick={() => {
                                        setShowUsedModal(false);
                                        setUsingRegistration(null);
                                        setUsingHospital(null);
                                        setHospitalBloodStock(null);
                                    }}
                                    className="registration-confirm-button registration-confirm-cancel"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmitUsed}
                                    className="registration-confirm-button registration-confirm-used"
                                >
                                    Mark as Used
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};
export default EventRegistrations;