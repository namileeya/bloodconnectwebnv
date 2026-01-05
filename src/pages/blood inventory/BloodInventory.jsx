import React, { useState, useEffect } from 'react';
import { Search, Package, TrendingUp, MapPin, Calendar, AlertCircle, X, Plus, ChevronLeft, ChevronRight, AlertTriangle, Clock, User, Hash, Droplets, ExternalLink, CheckCircle } from 'lucide-react';
import Layout from '../../components/Layout';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  orderBy,
  Timestamp,
  onSnapshot,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { db } from '../../firebase';
import './BloodInventory.css';

const BloodInventory = ({ onNavigate }) => {
  // State for data
  const [hospitals, setHospitals] = useState([]);
  const [donations, setDonations] = useState([]);
  const [bloodStockData, setBloodStockData] = useState({});
  const [users, setUsers] = useState([]);
  const [donorProfiles, setDonorProfiles] = useState([]);
  const [bloodDriveEvents, setBloodDriveEvents] = useState([]);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('All');
  const [bloodTypeFilter, setBloodTypeFilter] = useState('All');
  const [expiryFilter, setExpiryFilter] = useState('All');
  const [sortBy, setSortBy] = useState('expiry');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedDonation, setSelectedDonation] = useState(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);
  
  // Add form state
  const [donorSearchTerm, setDonorSearchTerm] = useState('');
  const [selectedDonor, setSelectedDonor] = useState(null);
  const [filteredDonors, setFilteredDonors] = useState([]);
  const [newHospitalId, setNewHospitalId] = useState('');
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [newAmountML, setNewAmountML] = useState('450');
  const [newSerialNumber, setNewSerialNumber] = useState('');
  const [showDonorDropdown, setShowDonorDropdown] = useState(false);

  // Calculate expiry status with current date
  const getExpiryStatus = (expiryDate) => {
    if (!expiryDate) return { status: 'Unknown', days: 0, color: 'bg-gray-100 text-gray-800 border-gray-200' };
    
    const today = new Date();
    const expiry = expiryDate.toDate ? expiryDate.toDate() : new Date(expiryDate);
    
    if (isNaN(expiry.getTime())) {
      return { status: 'Unknown', days: 0, color: 'bg-gray-100 text-gray-800 border-gray-200' };
    }
    
    const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) return { status: 'Expired', days: Math.abs(daysUntilExpiry), color: 'bg-red-100 text-red-800 border-red-200' };
    if (daysUntilExpiry <= 3) return { status: 'Critical', days: daysUntilExpiry, color: 'bg-red-100 text-red-800 border-red-200' };
    if (daysUntilExpiry <= 7) return { status: 'Urgent', days: daysUntilExpiry, color: 'bg-orange-100 text-orange-800 border-orange-200' };
    if (daysUntilExpiry <= 14) return { status: 'Warning', days: daysUntilExpiry, color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    return { status: 'Good', days: daysUntilExpiry, color: 'bg-green-100 text-green-800 border-green-200' };
  };

  // Format date for display
  const formatDate = (date) => {
    if (!date) return 'N/A';
    
    try {
      const d = date.toDate ? date.toDate() : new Date(date);
      if (isNaN(d.getTime())) return 'Invalid Date';
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (err) {
      return 'Invalid Date';
    }
  };

  // Format timestamp for date input
  const formatDateForInput = (date) => {
    if (!date) return '';
    
    try {
      const d = date.toDate ? date.toDate() : new Date(date);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch (err) {
      return '';
    }
  };

  // Calculate default expiry date (42 days from today)
  const getDefaultExpiryDate = () => {
    const today = new Date();
    today.setDate(today.getDate() + 42);
    return today.toISOString().split('T')[0];
  };

  // FIXED: Get location from donation - PRIORITIZE hospitalId
  const getLocationFromDonation = (donation) => {
    // 1. Check if donation has hospitalId and find hospital name
    if (donation.hospitalId) {
      const hospital = hospitals.find(h => h.id === donation.hospitalId);
      if (hospital) return hospital.name;
    }
    
    // 2. Check if donation has hospital_id (alternative field name)
    if (donation.hospital_id) {
      const hospital = hospitals.find(h => h.id === donation.hospital_id);
      if (hospital) return hospital.name;
    }
    
    // 3. Check direct location fields
    if (donation.hospital) return donation.hospital;
    if (donation.location) return donation.location;
    
    // 4. Check if donation has event_id
    if (donation.event_id) {
      const event = bloodDriveEvents.find(e => e.id === donation.event_id);
      if (event) {
        return event.locationHospitalName || event.assignedHospitalName || event.location || 'Unknown Location';
      }
    }
    
    // 5. Check if donation has created_by
    if (donation.created_by) {
      return 'Admin Added';
    }
    
    return 'Unknown Location';
  };

  // Get donor profile by user ID
  const getDonorProfile = (userId) => {
    if (!userId) return null;
    
    let profile = donorProfiles.find(profile => profile.user_id === userId);
    
    if (!profile) {
      const user = users.find(u => u.id === userId);
      if (user && user.email) {
        profile = donorProfiles.find(p => 
          p.email === user.email || 
          (p.user && p.user.email === user.email)
        );
      }
    }
    
    return profile;
  };

  // Get user by ID
  const getUser = (userId) => {
    if (!userId) return null;
    return users.find(user => user.id === userId);
  };

  // Get event by ID
  const getEvent = (eventId) => {
    if (!eventId) return null;
    return bloodDriveEvents.find(event => event.id === eventId);
  };

  // Fetch all data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch hospitals
        const hospitalsSnapshot = await getDocs(collection(db, 'hospitals'));
        const hospitalsData = hospitalsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setHospitals(hospitalsData);
        
        // Fetch blood drive events
        const eventsSnapshot = await getDocs(collection(db, 'blood_drive_events'));
        const eventsData = eventsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setBloodDriveEvents(eventsData);
        
        // Fetch donations where used: false
        const donationsQuery = query(
          collection(db, 'donations'),
          where('used', '==', false)
        );
        
        const donationsSnapshot = await getDocs(donationsQuery);
        const donationsData = donationsSnapshot.docs.map(doc => {
          const data = doc.data();
          
          // Store ALL data from Firestore
          return {
            id: doc.id,
            ...data,
          };
        });
        
        console.log('Fetched donations with hospitalIds:', donationsData.map(d => ({
          id: d.id,
          hospitalId: d.hospitalId,
          hospital: d.hospital,
          location: d.location,
          donor_name: d.donor_name
        }))); // Debug log
        
        setDonations(donationsData);
        
        // Fetch blood stock data from all hospitals
        const bloodStockPromises = hospitalsData.map(async (hospital) => {
          try {
            const bloodStockSnapshot = await getDocs(collection(db, 'hospitals', hospital.id, 'bloodStock'));
            const bloodStock = {};
            bloodStockSnapshot.forEach(doc => {
              bloodStock[doc.id] = doc.data();
            });
            return { hospitalId: hospital.id, bloodStock };
          } catch (err) {
            console.warn(`Error fetching bloodStock for hospital ${hospital.id}:`, err);
            return { hospitalId: hospital.id, bloodStock: {} };
          }
        });
        
        const bloodStockResults = await Promise.all(bloodStockPromises);
        const bloodStockMap = {};
        bloodStockResults.forEach(result => {
          bloodStockMap[result.hospitalId] = result.bloodStock;
        });
        setBloodStockData(bloodStockMap);
        
        // Fetch users with role 'blood_donor'
        const usersQuery = query(collection(db, 'users'), where('role', '==', 'blood_donor'));
        const usersSnapshot = await getDocs(usersQuery);
        const usersData = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setUsers(usersData);
        
        // Fetch donor profiles
        const profilesSnapshot = await getDocs(collection(db, 'donor_profiles'));
        const profilesData = profilesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setDonorProfiles(profilesData);
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load blood inventory data');
        setLoading(false);
      }
    };
    
    fetchData();
    
    // Set up real-time listener for donations
    const donationsQuery = query(
      collection(db, 'donations'),
      where('used', '==', false)
    );
    
    const unsubscribe = onSnapshot(donationsQuery, (snapshot) => {
      const donationsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDonations(donationsData);
    });
    
    return () => unsubscribe();
  }, []);

  // Filter donors based on search
  useEffect(() => {
    if (donorSearchTerm.trim() === '') {
      setFilteredDonors([]);
      return;
    }
    
    const searchTermLower = donorSearchTerm.toLowerCase();
    const filtered = donorProfiles.filter(profile => {
      const user = users.find(u => u.id === profile.user_id);
      if (!user) return false;
      
      return (
        profile.full_name?.toLowerCase().includes(searchTermLower) ||
        profile.id_number?.toLowerCase().includes(searchTermLower) ||
        user.email?.toLowerCase().includes(searchTermLower) ||
        user.phone_number?.toLowerCase().includes(searchTermLower)
      );
    }).slice(0, 10);
    
    setFilteredDonors(filtered);
    setShowDonorDropdown(filtered.length > 0);
  }, [donorSearchTerm, donorProfiles, users]);

  // Calculate stats
  const stats = {
    total: donations.length,
    critical: donations.filter(d => getExpiryStatus(d.expiry_date).status === 'Critical').length,
    urgent: donations.filter(d => getExpiryStatus(d.expiry_date).status === 'Urgent').length,
    upFromLastWeek: 0.5
  };

  // Get blood type from donation
  const getBloodType = (donation) => {
    return donation.blood_type || donation.bloodType || donation.blood_group || 'Unknown';
  };

  // Get serial number from donation
  const getSerialNumber = (donation) => {
    return donation.serial_number || donation.serialNumber || donation.serial_no || donation.id || 'N/A';
  };

  // Get donor name from donation
  const getDonorName = (donation) => {
    return donation.donor_name || donation.donorName || donation.name || donation.donor || 'Unknown Donor';
  };

  // Get donor IC from donation
  const getDonorIC = (donation) => {
    return donation.donor_ic || donation.donorIc || donation.ic_number || donation.ic || donation.id_number || '';
  };

  // Filter donations based on filters
  const filteredDonations = donations.filter(donation => {
    // Location filter
    if (locationFilter !== 'All') {
      const location = getLocationFromDonation(donation);
      if (location !== locationFilter) return false;
    }
    
    // Blood type filter
    if (bloodTypeFilter !== 'All') {
      const bloodType = getBloodType(donation);
      if (bloodType !== bloodTypeFilter) return false;
    }
    
    // Expiry filter
    if (expiryFilter !== 'All') {
      const status = getExpiryStatus(donation.expiry_date).status;
      if (status !== expiryFilter) return false;
    }
    
    // Search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const location = getLocationFromDonation(donation);
      const bloodType = getBloodType(donation);
      const serialNumber = getSerialNumber(donation);
      const donorName = getDonorName(donation);
      const donorIC = getDonorIC(donation);
      const event = getEvent(donation.event_id);
      const eventTitle = event?.title || '';
      
      return (
        serialNumber.toLowerCase().includes(searchLower) ||
        bloodType.toLowerCase().includes(searchLower) ||
        location.toLowerCase().includes(searchLower) ||
        donorName.toLowerCase().includes(searchLower) ||
        donorIC.toLowerCase().includes(searchLower) ||
        eventTitle.toLowerCase().includes(searchLower)
      );
    }
    
    return true;
  });

  // Sort filtered donations
  const sortedDonations = [...filteredDonations].sort((a, b) => {
    if (sortBy === 'expiry') {
      const dateA = a.expiry_date ? (a.expiry_date.toDate ? a.expiry_date.toDate() : new Date(a.expiry_date)) : new Date(0);
      const dateB = b.expiry_date ? (b.expiry_date.toDate ? b.expiry_date.toDate() : new Date(b.expiry_date)) : new Date(0);
      return dateA - dateB;
    }
    return 0;
  });

  // Pagination
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedDonations = sortedDonations.slice(startIndex, endIndex);
  const totalPages = Math.ceil(sortedDonations.length / itemsPerPage);

  // Calculate blood type summary for a specific hospital
  const getBloodTypeSummaryForHospital = (hospitalId) => {
    if (!bloodStockData[hospitalId]) return {};
    
    const summary = {};
    const bloodTypes = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
    
    bloodTypes.forEach(type => {
      if (bloodStockData[hospitalId][type]) {
        summary[type] = bloodStockData[hospitalId][type].quantity || 0;
      } else {
        summary[type] = 0;
      }
    });
    
    return summary;
  };

  // Get unique locations for filter (from both hospitals and events)
  const uniqueLocations = ['All', ...new Set([
    ...hospitals.map(h => h.name),
    ...bloodDriveEvents
      .map(e => e.locationHospitalName || e.assignedHospitalName)
      .filter(name => name && name !== 'Unknown Location')
  ])];

  // Handle donor selection
  const handleDonorSelect = (donorProfile) => {
    setSelectedDonor(donorProfile);
    setDonorSearchTerm(donorProfile.full_name || '');
    setShowDonorDropdown(false);
  };

  // Handle add blood stock - UPDATED WITH ALL FIELDS
  const handleAddBloodStock = async () => {
    try {
      if (!selectedDonor || !newHospitalId || !newExpiryDate || !newSerialNumber) {
        setError('Please fill in all required fields');
        return;
      }
      
      const user = users.find(u => u.id === selectedDonor.user_id);
      if (!user) {
        setError('Selected donor not found in users');
        return;
      }
      
      // Find hospital to get its name
      const selectedHospital = hospitals.find(h => h.id === newHospitalId);
      if (!selectedHospital) {
        setError('Selected hospital not found');
        return;
      }
      
      // Get blood type from donor profile
      const bloodType = selectedDonor.blood_group || 'Unknown';
      
      // Create timestamp for now
      const now = Timestamp.now();
      
      const donationData = {
        // Required fields
        amount_ml: parseInt(newAmountML) || 450,
        blood_type: bloodType,
        donor_email: user.email || '',
        donor_ic: selectedDonor.id_number || '',
        donor_name: selectedDonor.full_name || '',
        donor_phone: user.phone_number || '',
        expiry_date: Timestamp.fromDate(new Date(newExpiryDate)),
        hospitalId: newHospitalId,
        hospital: selectedHospital.name,
        serial_number: newSerialNumber,
        user_id: selectedDonor.user_id,
        
        // Default fields as per your structure
        created_at: now,
        created_by: "admin",
        donation_date: now,
        donation_type: "ABS",
        status: "completed",
        used: false,
      };
      
      console.log('Adding donation with data:', donationData);
      
      const donationRef = await addDoc(collection(db, 'donations'), donationData);
      
      // Update blood stock quantity
      const bloodStockRef = doc(db, 'hospitals', newHospitalId, 'bloodStock', bloodType);
      const bloodStockSnap = await getDoc(bloodStockRef);
      
      if (bloodStockSnap.exists()) {
        const currentData = bloodStockSnap.data();
        await updateDoc(bloodStockRef, {
          quantity: (currentData.quantity || 0) + 1,
          lastUpdated: Timestamp.now()
        });
      } else {
        await setDoc(bloodStockRef, {
          bloodType: bloodType,
          hospitalId: newHospitalId,
          quantity: 1,
          status: 'low',
          lastUpdated: Timestamp.now(),
          thresholds: {
            high: 50,
            low: 10,
            medium: 30
          }
        });
      }
      
      // Check if stock is low for notifications
      const hospitalStock = bloodStockData[newHospitalId] || {};
      const stockInfo = hospitalStock[bloodType];
      if (stockInfo && stockInfo.quantity <= stockInfo.thresholds?.low) {
        console.log(`Low stock alert for ${bloodType} at ${selectedHospital.name}`);
      }
      
      // Reset form
      setShowAddModal(false);
      setSelectedDonor(null);
      setDonorSearchTerm('');
      setNewHospitalId('');
      setNewExpiryDate(getDefaultExpiryDate());
      setNewAmountML('450');
      setNewSerialNumber('');
      setError('');
      
    } catch (err) {
      console.error('Error adding blood stock:', err);
      setError('Failed to add blood stock: ' + err.message);
    }
  };

  // Handle update blood stock
  const handleUpdateBloodStock = async () => {
    try {
      if (!selectedDonation) {
        setError('Please select a blood stock to update');
        return;
      }
      
      const oldBloodType = getBloodType(selectedDonation);
      const newBloodType = selectedDonation.blood_type;
      
      // Find hospital ID from the donation
      let hospitalId = selectedDonation.hospitalId || selectedDonation.hospital_id;
      if (!hospitalId && selectedDonation.hospital) {
        // Try to find hospital by name
        const hospital = hospitals.find(h => h.name === selectedDonation.hospital);
        if (hospital) hospitalId = hospital.id;
      }
      
      if (!hospitalId) {
        setError('Cannot update: Hospital information missing');
        return;
      }
      
      const donationRef = doc(db, 'donations', selectedDonation.id);
      await updateDoc(donationRef, {
        blood_type: newBloodType,
        expiry_date: Timestamp.fromDate(new Date(selectedDonation.expiry_date)),
        serial_number: selectedDonation.serial_number
      });
      
      if (oldBloodType !== newBloodType) {
        const oldBloodStockRef = doc(db, 'hospitals', hospitalId, 'bloodStock', oldBloodType);
        const oldBloodStockSnap = await getDoc(oldBloodStockRef);
        if (oldBloodStockSnap.exists()) {
          const oldData = oldBloodStockSnap.data();
          await updateDoc(oldBloodStockRef, {
            quantity: Math.max(0, (oldData.quantity || 0) - 1),
            lastUpdated: Timestamp.now()
          });
        }
        
        const newBloodStockRef = doc(db, 'hospitals', hospitalId, 'bloodStock', newBloodType);
        const newBloodStockSnap = await getDoc(newBloodStockRef);
        if (newBloodStockSnap.exists()) {
          const newData = newBloodStockSnap.data();
          await updateDoc(newBloodStockRef, {
            quantity: (newData.quantity || 0) + 1,
            lastUpdated: Timestamp.now()
          });
        } else {
          await setDoc(newBloodStockRef, {
            bloodType: newBloodType,
            hospitalId: hospitalId,
            quantity: 1,
            status: 'low',
            lastUpdated: Timestamp.now(),
            thresholds: {
              high: 50,
              low: 10,
              medium: 30
            }
          });
        }
      }
      
      setShowUpdateModal(false);
      setSelectedDonation(null);
      setError('');
      
    } catch (err) {
      console.error('Error updating blood stock:', err);
      setError('Failed to update blood stock: ' + err.message);
    }
  };

  // Handle mark as used
  const handleMarkAsUsed = async () => {
    try {
      if (!selectedDonation) {
        setError('Please select a blood stock to mark as used');
        return;
      }
      
      // Get blood type from donation
      const bloodType = getBloodType(selectedDonation);
      const hospitalId = selectedDonation.hospitalId;
      
      if (!hospitalId) {
        setError('Cannot mark as used: Hospital information missing');
        return;
      }
      
      // Update donation document
      const donationRef = doc(db, 'donations', selectedDonation.id);
      await updateDoc(donationRef, {
        used: true,
        status: "used"
      });
      
      // Deduct from blood stock quantity
      const bloodStockRef = doc(db, 'hospitals', hospitalId, 'bloodStock', bloodType);
      const bloodStockSnap = await getDoc(bloodStockRef);
      
      if (bloodStockSnap.exists()) {
        const currentData = bloodStockSnap.data();
        const newQuantity = Math.max(0, (currentData.quantity || 0) - 1);
        await updateDoc(bloodStockRef, {
          quantity: newQuantity,
          lastUpdated: Timestamp.now()
        });
      }
      
      setShowUpdateModal(false);
      setSelectedDonation(null);
      setError('');
      
    } catch (err) {
      console.error('Error marking as used:', err);
      setError('Failed to mark as used: ' + err.message);
    }
  };

  // Pagination handlers
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  // Reset add form when modal opens
  useEffect(() => {
    if (showAddModal) {
      setSelectedDonor(null);
      setDonorSearchTerm('');
      setNewHospitalId('');
      setNewExpiryDate(getDefaultExpiryDate());
      setNewAmountML('450');
      setNewSerialNumber('');
    }
  }, [showAddModal]);

  if (loading) {
    return (
      <Layout onNavigate={onNavigate} currentPage="blood-inventory">
        <div className="loading-container">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <p className="loading-text">Loading blood inventory...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout onNavigate={onNavigate} currentPage="blood-inventory">
      <div className="space-y-6">
        {/* Header */}
        <div className="inventory-header-container">
          <h1 className="inventory-header-title">Blood Inventory</h1>
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

        {/* FIXED: Debug Info - Shows donation-hospital mapping */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-bold mb-2 text-blue-800">Donation-Hospital Mapping</h3>
          <p className="text-sm text-blue-700 mb-2">
            Total Donations: {donations.length} | Total Hospitals: {hospitals.length}
          </p>
          {donations.slice(0, 3).map((d, i) => {
            const location = getLocationFromDonation(d);
            const hospital = hospitals.find(h => h.id === d.hospitalId);
            return (
              <div key={i} className="mb-2 p-2 bg-white rounded border border-blue-100">
                <p className="text-sm"><strong>Donation ID:</strong> {d.id}</p>
                <p className="text-sm"><strong>Hospital ID in DB:</strong> {d.hospitalId || 'No hospitalId'}</p>
                <p className="text-sm"><strong>Hospital Found:</strong> {hospital ? 'Yes' : 'No'}</p>
                <p className="text-sm"><strong>Hospital Name:</strong> {hospital ? hospital.name : 'Not found'}</p>
                <p className="text-sm"><strong>Location Display:</strong> {location}</p>
              </div>
            );
          })}
        </div>

        {/* Stats Cards */}
        <div className="stats-cards-grid">
          {/* Total Blood */}
          <div className="stat-card stat-card-blue">
            <div className="stat-card-content">
              <div className="stat-card-info">
                <p className="stat-card-label">Total Blood Stock</p>
                <h2 className="stat-card-number">{stats.total}</h2>
                <div className="stat-card-trend">
                  <TrendingUp className="trend-icon" />
                  <span className="trend-text">{stats.upFromLastWeek}% Up from past week</span>
                </div>
              </div>
              <div className="stat-card-icon stat-card-icon-blue">
                <Package className="package-icon" />
              </div>
            </div>
          </div>

          {/* Critical Stock */}
          <div className="stat-card stat-card-red">
            <div className="stat-card-content">
              <div className="stat-card-info">
                <p className="stat-card-label">Critical (≤3 days)</p>
                <h2 className="stat-card-number stat-card-number-red">{stats.critical}</h2>
                <div className="stat-card-trend">
                  <AlertTriangle className="trend-icon-red" />
                  <span className="trend-text-red">Immediate action needed</span>
                </div>
              </div>
              <div className="stat-card-icon stat-card-icon-red">
                <AlertTriangle className="package-icon" />
              </div>
            </div>
          </div>

          {/* Urgent Stock */}
          <div className="stat-card stat-card-orange">
            <div className="stat-card-content">
              <div className="stat-card-info">
                <p className="stat-card-label">Urgent (≤7 days)</p>
                <h2 className="stat-card-number stat-card-number-orange">{stats.urgent}</h2>
                <div className="stat-card-trend">
                  <Clock className="trend-icon-orange" />
                  <span className="trend-text-orange">Priority usage</span>
                </div>
              </div>
              <div className="stat-card-icon stat-card-icon-orange">
                <Clock className="package-icon" />
              </div>
            </div>
          </div>
        </div>

        {/* Blood Stock by Location */}
        <div className="location-stock-section">
          <div className="location-selector-header">
            <h3 className="location-stock-title">Blood Stock by Location</h3>
            <select
              className="location-selector-dropdown"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              {uniqueLocations.map((location, index) => (
                <option key={index} value={location}>{location}</option>
              ))}
            </select>
          </div>

          {(() => {
            const selectedLocationName = locationFilter === 'All' 
              ? (hospitals[0]?.name || 'Select Location') 
              : locationFilter;
            
            // Find hospital by name
            const selectedHospital = hospitals.find(h => h.name === selectedLocationName);
            
            if (!selectedHospital) {
              return (
                <div className="location-card">
                  <div className="location-header">
                    <div className="location-title-section">
                      <MapPin className="location-icon" />
                      <h4 className="location-name">{selectedLocationName}</h4>
                    </div>
                  </div>
                  <div className="p-4 text-center text-gray-500">
                    No hospital data found for this location
                  </div>
                </div>
              );
            }
            
            const locationSummary = getBloodTypeSummaryForHospital(selectedHospital.id);
            const totalStock = Object.values(locationSummary).reduce((sum, count) => sum + count, 0);

            return (
              <div className="location-card">
                <div className="location-header">
                  <div className="location-title-section">
                    <MapPin className="location-icon" />
                    <h4 className="location-name">{selectedHospital.name}</h4>
                  </div>
                  <div className="location-stats">
                    <div className="location-stat-item">
                      <span className="location-stat-value">{totalStock}</span>
                      <span className="location-stat-label">Total Units</span>
                    </div>
                  </div>
                </div>
                <div className="location-blood-types">
                  {Object.entries(locationSummary).map(([type, count]) => {
                    const stockInfo = bloodStockData[selectedHospital.id]?.[type];
                    let stockLevel = 'HIGH';
                    let stockLevelClass = 'high';
                    
                    if (stockInfo) {
                      if (count <= stockInfo.thresholds?.low) {
                        stockLevel = 'LOW';
                        stockLevelClass = 'low';
                      } else if (count <= stockInfo.thresholds?.medium) {
                        stockLevel = 'MEDIUM';
                        stockLevelClass = 'medium';
                      }
                    }

                    return (
                      <div key={type} className={`location-blood-type-card stock-level-${stockLevelClass}`}>
                        <div className="blood-type-header-compact">
                          <span className={`blood-type-badge ${type.includes('-') ? 'blood-type-badge-negative' : 'blood-type-badge-positive'}`}>
                            {type}
                          </span>
                          {type === 'O-' && (
                            <span className="universal-badge-small">Universal</span>
                          )}
                        </div>
                        <div className="blood-type-count-large">{count}</div>
                        <div className={`stock-level-text stock-level-${stockLevelClass}`}>
                          {stockLevel}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Search and Filters */}
        <div className="inventory-filters-container">
          <div className="inventory-filters-grid">
            <div className="inventory-search-container">
              <label className="inventory-filter-label">Search Inventory</label>
              <div className="inventory-search-input-container">
                <Search className="inventory-search-icon" />
                <input
                  type="text"
                  placeholder="Search by serial number, blood type, donor, or location..."
                  className="inventory-search-input"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="inventory-filter-select-container">
              <label className="inventory-filter-label">Location</label>
              <select
                className="inventory-filter-select"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
              >
                {uniqueLocations.map((location, index) => (
                  <option key={index} value={location}>{location}</option>
                ))}
              </select>
            </div>
            <div className="inventory-filter-select-container">
              <label className="inventory-filter-label">Blood Type</label>
              <select
                className="inventory-filter-select"
                value={bloodTypeFilter}
                onChange={(e) => setBloodTypeFilter(e.target.value)}
              >
                <option value="All">All Types</option>
                <option value="O-">O- (Universal)</option>
                <option value="O+">O+</option>
                <option value="A-">A-</option>
                <option value="A+">A+</option>
                <option value="B-">B-</option>
                <option value="B+">B+</option>
                <option value="AB-">AB-</option>
                <option value="AB+">AB+</option>
              </select>
            </div>
            <div className="inventory-filter-select-container">
              <label className="inventory-filter-label">Expiry Status</label>
              <select
                className="inventory-filter-select"
                value={expiryFilter}
                onChange={(e) => setExpiryFilter(e.target.value)}
              >
                <option value="All">All Status</option>
                <option value="Critical">Critical (≤3 days)</option>
                <option value="Urgent">Urgent (≤7 days)</option>
                <option value="Warning">Warning (≤14 days)</option>
                <option value="Good">Good (&gt;14 days)</option>
                <option value="Expired">Expired</option>
              </select>
            </div>
          </div>
        </div>

        {/* Add Blood Stock Button */}
        <div className="add-stock-container">
          <button
            className="add-stock-button"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={20} className="mr-2" />
            Add Blood Stock
          </button>
        </div>

        {/* Blood Inventory Table */}
        <div className="inventory-table-container">
          <div className="inventory-table-wrapper">
            <table className="inventory-table">
              <thead className="inventory-table-header">
                <tr>
                  <th className="inventory-table-header-cell">SERIAL NO.</th>
                  <th className="inventory-table-header-cell">DONOR</th>
                  <th className="inventory-table-header-cell">TYPE</th>
                  <th className="inventory-table-header-cell">LOCATION</th>
                  <th className="inventory-table-header-cell">EXPIRY DATE</th>
                  <th className="inventory-table-header-cell">DAYS LEFT</th>
                  <th className="inventory-table-header-cell">STATUS</th>
                </tr>
              </thead>
              <tbody className="inventory-table-body">
                {paginatedDonations.map((donation) => {
                  const expiryInfo = getExpiryStatus(donation.expiry_date);
                  const location = getLocationFromDonation(donation);
                  const bloodType = getBloodType(donation);
                  const serialNumber = getSerialNumber(donation);
                  const donorName = getDonorName(donation);
                  const donorIC = getDonorIC(donation);
                  
                  return (
                    <tr key={donation.id} className="inventory-table-row">
                      <td className="inventory-table-cell inventory-id-cell">
                        <div className="flex items-center gap-2">
                          <Hash size={14} className="text-gray-400" />
                          {serialNumber}
                        </div>
                      </td>
                      <td className="inventory-table-cell">
                        <div className="flex flex-col">
                          <span className="font-medium">{donorName}</span>
                          <span className="text-sm text-gray-500">{donorIC}</span>
                        </div>
                      </td>
                      <td className="inventory-table-cell inventory-type-cell">
                        <span className={`blood-type-badge ${bloodType.includes('-') ? 'blood-type-badge-negative' : 'blood-type-badge-positive'}`}>
                          {bloodType}
                        </span>
                        {bloodType === 'O-' && (
                          <span className="universal-badge">Universal</span>
                        )}
                      </td>
                      <td className="inventory-table-cell inventory-location-cell">
                        {location}
                      </td>
                      <td className="inventory-table-cell inventory-date-cell">
                        {formatDate(donation.expiry_date)}
                      </td>
                      <td className="inventory-table-cell">
                        <span className={`days-left ${expiryInfo.days < 0 ? 'days-left-expired' :
                          expiryInfo.days <= 3 ? 'days-left-critical' :
                            expiryInfo.days <= 7 ? 'days-left-urgent' :
                              expiryInfo.days <= 14 ? 'days-left-warning' :
                                'days-left-good'
                          }`}>
                          {expiryInfo.days < 0 ? `${Math.abs(expiryInfo.days)} days ago` : `${expiryInfo.days} days`}
                        </span>
                      </td>
                      <td className="inventory-table-cell">
                        <span className={`status-badge ${expiryInfo.color}`}>
                          {expiryInfo.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredDonations.length === 0 && !loading && (
            <div className="inventory-empty-state">
              <div className="inventory-empty-state-icon">
                <Search />
              </div>
              <h3 className="inventory-empty-state-title">No blood stock found</h3>
              <p className="inventory-empty-state-description">
                Try adjusting your search filters
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredDonations.length > 0 && (
          <div className="inventory-pagination">
            <div className="inventory-pagination-info">
              <span>Items per page:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                className="inventory-items-per-page-select"
              >
                <option value={6}>6</option>
                <option value={8}>8</option>
                <option value={12}>12</option>
                <option value={16}>16</option>
              </select>
              <span className="inventory-pagination-range">
                {startIndex + 1}-{Math.min(endIndex, filteredDonations.length)} of {filteredDonations.length}
              </span>
            </div>

            <div className="inventory-pagination-controls">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="inventory-pagination-btn"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="inventory-pagination-btn"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Update Blood Stock Button */}
        <div className="update-stock-container">
          <button
            className="update-stock-button"
            onClick={() => setShowUpdateModal(true)}
          >
            Update Blood Stock
          </button>
        </div>

        {/* Add Blood Stock Modal */}
        {showAddModal && (
          <div className="inventory-modal-overlay">
            <div className="inventory-modal-container">
              <div className="inventory-modal-header">
                <h2 className="inventory-modal-title">Add Blood Stock</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="inventory-modal-close"
                >
                  <X className="inventory-modal-close-icon" />
                </button>
              </div>
              <div className="inventory-modal-body">
                <div className="inventory-modal-form">
                  {/* Donor Search */}
                  <div className="inventory-form-group">
                    <label className="inventory-form-label">Donor Search *</label>
                    <div className="relative">
                      <div className="inventory-search-input-container">
                        <User className="inventory-search-icon" />
                        <input
                          type="text"
                          placeholder="Search donor by name or IC number..."
                          className="inventory-search-input"
                          value={donorSearchTerm}
                          onChange={(e) => setDonorSearchTerm(e.target.value)}
                          onFocus={() => filteredDonors.length > 0 && setShowDonorDropdown(true)}
                        />
                      </div>
                      {showDonorDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {filteredDonors.map((donor) => (
                            <div
                              key={donor.id}
                              className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                              onClick={() => handleDonorSelect(donor)}
                            >
                              <div className="font-medium">{donor.full_name}</div>
                              <div className="text-sm text-gray-500">
                                IC: {donor.id_number} | Blood: {donor.blood_group}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {selectedDonor && (
                      <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{selectedDonor.full_name}</p>
                            <p className="text-sm text-gray-600">
                              IC: {selectedDonor.id_number} | Blood Type: {selectedDonor.blood_group}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDonor(null);
                              setDonorSearchTerm('');
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Serial Number */}
                  <div className="inventory-form-group">
                    <label className="inventory-form-label">Serial Number *</label>
                    <input
                      type="text"
                      className="inventory-form-input"
                      placeholder="Enter serial number"
                      value={newSerialNumber}
                      onChange={(e) => setNewSerialNumber(e.target.value)}
                    />
                  </div>

                  {/* Hospital/Location */}
                  <div className="inventory-form-group">
                    <label className="inventory-form-label">Location *</label>
                    <select
                      className="inventory-form-select"
                      value={newHospitalId}
                      onChange={(e) => setNewHospitalId(e.target.value)}
                    >
                      <option value="">Select location</option>
                      {hospitals.map((hospital) => (
                        <option key={hospital.id} value={hospital.id}>
                          {hospital.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Expiry Date */}
                  <div className="inventory-form-group">
                    <label className="inventory-form-label">Expiry Date *</label>
                    <input
                      type="date"
                      className="inventory-form-input"
                      value={newExpiryDate}
                      onChange={(e) => setNewExpiryDate(e.target.value)}
                    />
                  </div>

                  {/* Amount (ml) */}
                  <div className="inventory-form-group">
                    <label className="inventory-form-label">Amount (ml)</label>
                    <input
                      type="number"
                      className="inventory-form-input"
                      placeholder="Enter amount in ml"
                      value={newAmountML}
                      onChange={(e) => setNewAmountML(e.target.value)}
                      min="1"
                      max="1000"
                    />
                  </div>

                  {/* Display selected donor's blood type */}
                  {selectedDonor && (
                    <div className="inventory-form-group">
                      <label className="inventory-form-label">Blood Type (from donor)</label>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <span className={`blood-type-badge ${selectedDonor.blood_group?.includes('-') ? 'blood-type-badge-negative' : 'blood-type-badge-positive'}`}>
                          {selectedDonor.blood_group}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="inventory-modal-actions">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="inventory-modal-button inventory-cancel-button"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddBloodStock}
                    className="inventory-modal-button inventory-save-button"
                    disabled={!selectedDonor || !newHospitalId || !newExpiryDate || !newSerialNumber}
                  >
                    Add Stock
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Update Blood Stock Modal - WITH ADDED MARK AS USED BUTTON */}
        {showUpdateModal && (
          <div className="inventory-modal-overlay">
            <div className="inventory-modal-container">
              <div className="inventory-modal-header">
                <h2 className="inventory-modal-title">Update Blood Stock</h2>
                <button
                  onClick={() => setShowUpdateModal(false)}
                  className="inventory-modal-close"
                >
                  <X className="inventory-modal-close-icon" />
                </button>
              </div>
              <div className="inventory-modal-body">
                <div className="inventory-modal-form">
                  <div className="inventory-form-group">
                    <label className="inventory-form-label">Select Blood Stock</label>
                    <select
                      className="inventory-form-select"
                      onChange={(e) => {
                        const selected = donations.find(d => d.id === e.target.value);
                        setSelectedDonation(selected);
                      }}
                    >
                      <option value="">Select blood stock to update</option>
                      {donations.map(donation => {
                        const location = getLocationFromDonation(donation);
                        const bloodType = getBloodType(donation);
                        const serialNumber = getSerialNumber(donation);
                        const donorName = getDonorName(donation);
                        
                        return (
                          <option key={donation.id} value={donation.id}>
                            {serialNumber} - {bloodType} ({location})
                            {donorName && donorName !== 'Unknown Donor' ? ` - ${donorName}` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  {selectedDonation && (
                    <>
                      <div className="inventory-form-group">
                        <label className="inventory-form-label">Serial Number</label>
                        <input
                          type="text"
                          className="inventory-form-input"
                          value={getSerialNumber(selectedDonation)}
                          onChange={(e) => setSelectedDonation({ 
                            ...selectedDonation, 
                            serial_number: e.target.value 
                          })}
                        />
                      </div>
                      <div className="inventory-form-group">
                        <label className="inventory-form-label">Blood Type</label>
                        <select
                          className="inventory-form-select"
                          value={getBloodType(selectedDonation)}
                          onChange={(e) => setSelectedDonation({ 
                            ...selectedDonation, 
                            blood_type: e.target.value 
                          })}
                        >
                          <option value="O-">O- (Universal Donor)</option>
                          <option value="O+">O+</option>
                          <option value="A-">A-</option>
                          <option value="A+">A+</option>
                          <option value="B-">B-</option>
                          <option value="B+">B+</option>
                          <option value="AB-">AB-</option>
                          <option value="AB+">AB+</option>
                        </select>
                      </div>
                      <div className="inventory-form-group">
                        <label className="inventory-form-label">Expiry Date</label>
                        <input
                          type="date"
                          className="inventory-form-input"
                          value={formatDateForInput(selectedDonation.expiry_date)}
                          onChange={(e) => setSelectedDonation({ 
                            ...selectedDonation, 
                            expiry_date: e.target.value 
                          })}
                        />
                      </div>
                    </>
                  )}
                </div>
                <div className="inventory-modal-actions">
                  <button
                    onClick={() => {
                      setShowUpdateModal(false);
                      setSelectedDonation(null);
                    }}
                    className="inventory-modal-button inventory-cancel-button"
                  >
                    Cancel
                  </button>
                  
                  {/* MARK AS USED BUTTON - ADDED HERE */}
                  <button
                    onClick={handleMarkAsUsed}
                    className="inventory-modal-button bg-red-600 hover:bg-red-700 text-white ml-2"
                    disabled={!selectedDonation}
                  >
                    <CheckCircle size={18} className="inline mr-2" />
                    Mark as Used
                  </button>
                  
                  <button
                    onClick={handleUpdateBloodStock}
                    className="inventory-modal-button inventory-save-button ml-2"
                    disabled={!selectedDonation}
                  >
                    Update Stock
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

export default BloodInventory;