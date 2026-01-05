import React, { useState, useEffect } from 'react';
import { QrCode, X, Plus, Edit2, Download, Camera, Check, AlertCircle, Search, Trash2, User, Phone, Mail, FileText } from 'lucide-react';
import Layout from '../../components/Layout';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import './DigitalDonorCards.css';

// Firebase imports
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import app from '../../firebase';

const auth = getAuth(app);
const db = getFirestore(app);

// QR Code Generator Component using qrcode library
const QRCodeGenerator = ({ value, size = 160 }) => {
  const canvasRef = React.useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;

    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    }, (error) => {
      if (error) console.error('QR Code generation error:', error);
    });
  }, [value, size]);

  return <canvas ref={canvasRef} className="rounded-lg" />;
};

const DigitalDonorCards = ({ onNavigate }) => {
  const [donors, setDonors] = useState([]);
  const [filteredDonors, setFilteredDonors] = useState([]);
  const [selectedDonor, setSelectedDonor] = useState(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingDonor, setEditingDonor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [bloodTypeFilter, setBloodTypeFilter] = useState('All');
  const [verificationResult, setVerificationResult] = useState(null);
  const [verificationInput, setVerificationInput] = useState('');
  const [error, setError] = useState('');

  // New form data matching your database structure
  const [formData, setFormData] = useState({
    // User collection fields
    email: '',
    phone_number: '',
    
    // Donor profiles collection fields
    full_name: '',
    blood_group: 'A+',
    gender: 'Male',
    id_type: 'IC Number',
    id_number: '',
    birth_date: '',
    height: '',
    weight: '',
    medical_conditions: 'None',
    allergies: 'None',
    blood_bank_id: '',
    
    // New fields for donor cards
    emergency_contact_name: '',
    emergency_contact_phone: '',
  });

  const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  useEffect(() => {
    loadDonors();
  }, []);

  useEffect(() => {
    let filtered = [...donors];

    if (bloodTypeFilter !== 'All') {
      filtered = filtered.filter(d => d.bloodGroup === bloodTypeFilter);
    }

    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter(d =>
        (d.fullName || '').toLowerCase().includes(searchLower) ||
        (d.displayId || '').toLowerCase().includes(searchLower) ||
        (d.bloodGroup || '').toLowerCase().includes(searchLower) ||
        (d.email || '').toLowerCase().includes(searchLower)
      );
    }

    setFilteredDonors(filtered);
  }, [searchQuery, bloodTypeFilter, donors]);

  const loadDonors = async () => {
    setLoading(true);
    try {
      // 1. Fetch all users from users collection
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const donorsData = [];
      
      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();
        
        // 2. Fetch donor profile
        let donorProfile = {};
        try {
          const donorDoc = await getDoc(doc(db, 'donor_profiles', userId));
          if (donorDoc.exists()) {
            donorProfile = donorDoc.data();
          }
        } catch (error) {
          console.error(`Error fetching donor profile for ${userId}:`, error);
        }
        
        // 3. Fetch latest eligibility request - IMPROVED QUERY
        let eligibilityStatus = 'Not Submitted';
        try {
          const eligibilityQuery = query(
            collection(db, 'eligibility_requests'),
            where('userId', '==', userId)
          );
          const eligibilitySnapshot = await getDocs(eligibilityQuery);
          
          if (!eligibilitySnapshot.empty) {
            // Get all requests and find the most recent
            let latestDate = null;
            let latestRequest = null;
            
            eligibilitySnapshot.forEach(doc => {
              const requestData = doc.data();
              
              if (requestData.submittedDate) {
                const requestDate = requestData.submittedDate.toDate();
                if (!latestDate || requestDate > latestDate) {
                  latestDate = requestDate;
                  latestRequest = requestData;
                }
              }
            });
            
            if (latestRequest) {
              eligibilityStatus = latestRequest.status || 'pending';
            }
          }
        } catch (error) {
          console.error(`Error fetching eligibility for ${userId}:`, error);
        }
        
        // 4. Fetch last donation date - IMPROVED QUERY
        let lastDonation = '';
        try {
          const donationsQuery = query(
            collection(db, 'donations'),
            where('donor_id', '==', userId)
          );
          const donationsSnapshot = await getDocs(donationsQuery);
          
          if (!donationsSnapshot.empty) {
            // Get all donations and find the most recent
            let latestDate = null;
            let latestDonationData = null;
            
            donationsSnapshot.forEach(doc => {
              const donationData = doc.data();
              
              if (donationData.donation_date) {
                const donationDate = donationData.donation_date.toDate();
                if (!latestDate || donationDate > latestDate) {
                  latestDate = donationDate;
                  latestDonationData = donationData;
                }
              }
            });
            
            if (latestDonationData && latestDonationData.donation_date) {
              lastDonation = latestDonationData.donation_date.toDate().toISOString().split('T')[0];
            }
          }
        } catch (error) {
          console.error(`Error fetching donations for ${userId}:`, error);
        }
        
        // 5. Combine all data for donor card display
        donorsData.push({
          id: userId,
          // From users collection
          email: userData.email || '',
          phone: userData.phone_number || '',
          qrCodeData: userData.qr_code_data || `BLOODCONNECT:USER:${userId}`,
          // From donor_profiles collection
          fullName: donorProfile.full_name || '',
          displayId: donorProfile.display_id || `DON-${userId.substring(0, 7)}`,
          bloodGroup: donorProfile.blood_group || '',
          gender: donorProfile.gender || '',
          medicalConditions: donorProfile.medical_conditions || 'None',
          allergies: donorProfile.allergies || 'None',
          // New fields for donor cards
          emergencyContactName: donorProfile.emergency_contact_name || '',
          emergencyContactPhone: donorProfile.emergency_contact_phone || '',
          // Calculated fields
          eligibilityStatus,
          lastDonation,
          // For backward compatibility with existing code
          name: donorProfile.full_name || '',
          bloodType: donorProfile.blood_group || '',
          emergencyContact: donorProfile.emergency_contact_name || '',
          emergencyPhone: donorProfile.emergency_contact_phone || '',
          medicalNotes: `${donorProfile.medical_conditions || 'None'}${donorProfile.allergies ? `, Allergies: ${donorProfile.allergies}` : ''}`,
          isEligible: eligibilityStatus === 'approved',
          createdAt: donorProfile.created_at?.toDate?.() || new Date(),
        });
      }
      
      setDonors(donorsData);
      setFilteredDonors(donorsData);
      
    } catch (err) {
      console.error('Error loading donors:', err);
      setError('Failed to load donor cards');
    } finally {
      setLoading(false);
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const formatDateToDDMMYYYY = (dateString) => {
    if (!dateString) return '';
    if (dateString.includes('/')) return dateString;
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (error) {
      return dateString;
    }
  };

  const handleCreateUserWithCard = () => {
    setEditingDonor(null);
    setFormData({
      email: '',
      phone_number: '',
      full_name: '',
      blood_group: 'A+',
      gender: 'Male',
      id_type: 'IC Number',
      id_number: '',
      birth_date: '',
      height: '',
      weight: '',
      medical_conditions: 'None',
      allergies: 'None',
      blood_bank_id: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
    });
    setShowAddEditModal(true);
  };

  const handleEditDonor = (donor, e) => {
    e.stopPropagation();
    setEditingDonor(donor);
    setFormData({
      email: donor.email || '',
      phone_number: donor.phone || '',
      full_name: donor.fullName || '',
      blood_group: donor.bloodGroup || 'A+',
      gender: donor.gender || 'Male',
      id_type: 'IC Number',
      id_number: '',
      birth_date: '',
      height: '',
      weight: '',
      medical_conditions: donor.medicalConditions || 'None',
      allergies: donor.allergies || 'None',
      blood_bank_id: '',
      emergency_contact_name: donor.emergencyContactName || '',
      emergency_contact_phone: donor.emergencyContactPhone || '',
    });
    setShowAddEditModal(true);
  };

  const handleDeleteClick = (donor, e) => {
    e.stopPropagation();
    setSelectedDonor(donor);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedDonor) return;
    
    try {
      // Note: Deleting auth user requires backend function
      // For now, just delete from Firestore collections
      await deleteDoc(doc(db, 'users', selectedDonor.id));
      await deleteDoc(doc(db, 'donor_profiles', selectedDonor.id));
      
      // Update local state
      const updatedDonors = donors.filter(d => d.id !== selectedDonor.id);
      setDonors(updatedDonors);
      
      setShowDeleteConfirm(false);
      setSelectedDonor(null);
      
    } catch (err) {
      console.error('Error deleting donor:', err);
      setError('Failed to delete donor card');
    }
  };

  const handleSubmit = async () => {
    if (!formData.email.trim()) {
      setError('Please enter email');
      return;
    }

    if (!formData.full_name.trim()) {
      setError('Please enter full name');
      return;
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      if (editingDonor) {
        // Update existing donor - only update donor_profiles (emergency contact, etc.)
        await updateDoc(doc(db, 'donor_profiles', editingDonor.id), {
          emergency_contact_name: formData.emergency_contact_name,
          emergency_contact_phone: formData.emergency_contact_phone,
          medical_conditions: formData.medical_conditions,
          allergies: formData.allergies,
          updated_at: serverTimestamp(),
        });
        
        // Reload donors
        await loadDonors();
        
        setShowAddEditModal(false);
        setEditingDonor(null);
        
      } else {
        // Create new user (same as User Management)
        const password = generateRandomPassword();
        
        // 1. Create Firebase Auth user
        const userCredential = await createUserWithEmailAndPassword(
          auth, 
          formData.email, 
          password
        );
        const userId = userCredential.user.uid;
        
        // Generate display ID and QR code
        const displayId = `DON-${userId.substring(0, 7)}`;
        const qrCodeData = `BLOODCONNECT:USER:${userId}`;
        
        // 2. Create users document
        await setDoc(doc(db, 'users', userId), {
          email: formData.email,
          username: formData.email.split('@')[0],
          phone_number: formData.phone_number,
          role: 'blood_donor',
          qr_code_data: qrCodeData,
          created_at: serverTimestamp(),
        });
        
        // 3. Create donor_profiles document
        await setDoc(doc(db, 'donor_profiles', userId), {
          user_id: userId,
          full_name: formData.full_name,
          blood_group: formData.blood_group,
          gender: formData.gender,
          id_type: formData.id_type,
          id_number: formData.id_number,
          birth_date: formData.birth_date ? formatDateToDDMMYYYY(formData.birth_date) : '',
          height: formData.height,
          weight: formData.weight,
          medical_conditions: formData.medical_conditions,
          allergies: formData.allergies,
          blood_bank_id: formData.blood_bank_id || 'Not provided',
          emergency_contact_name: formData.emergency_contact_name,
          emergency_contact_phone: formData.emergency_contact_phone,
          display_id: displayId,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
        
        // Show success message with password
        alert(`User created successfully! Temporary password: ${password}\nShare this with the user.`);
        
        // Reload donors
        await loadDonors();
        
        setShowAddEditModal(false);
        setFormData({
          email: '',
          phone_number: '',
          full_name: '',
          blood_group: 'A+',
          gender: 'Male',
          id_type: 'IC Number',
          id_number: '',
          birth_date: '',
          height: '',
          weight: '',
          medical_conditions: 'None',
          allergies: 'None',
          blood_bank_id: '',
          emergency_contact_name: '',
          emergency_contact_phone: '',
        });
      }
      
    } catch (error) {
      console.error('Error saving donor:', error);
      if (error.code === 'auth/email-already-in-use') {
        setError('Email already in use');
      } else {
        setError(`Error: ${error.message}`);
      }
    }
  };

  const handleViewCard = (donor) => {
    setSelectedDonor(donor);
    setShowCardModal(true);
  };

  const handleDownloadCard = async () => {
    if (!selectedDonor) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 380;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 600, 380);

      ctx.fillStyle = '#dc2626';
      ctx.fillRect(0, 0, 600, 80);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px Arial';
      ctx.fillText('DIGITAL DONOR CARD', 30, 50);

      const qrCanvas = document.createElement('canvas');
      await QRCode.toCanvas(qrCanvas, selectedDonor.qrCodeData, {
        width: 140,
        margin: 1,
      });

      ctx.drawImage(qrCanvas, 430, 110, 140, 140);

      ctx.fillStyle = '#1f2937';
      ctx.font = 'bold 18px Arial';
      ctx.fillText('Name:', 30, 130);
      ctx.font = '18px Arial';
      ctx.fillText(selectedDonor.fullName, 30, 155);

      ctx.font = 'bold 16px Arial';
      ctx.fillText('Donor ID:', 30, 190);
      ctx.font = '16px Arial';
      ctx.fillText(selectedDonor.displayId, 30, 210);

      ctx.font = 'bold 16px Arial';
      ctx.fillText('Blood Type:', 30, 245);
      ctx.font = 'bold 28px Arial';
      ctx.fillStyle = '#dc2626';
      ctx.fillText(selectedDonor.bloodGroup, 30, 275);

      ctx.fillStyle = '#1f2937';
      ctx.font = 'bold 14px Arial';
      ctx.fillText('Last Donation:', 30, 310);
      ctx.font = '14px Arial';
      ctx.fillText(formatLastDonation(selectedDonor.lastDonation), 30, 330);

      ctx.fillStyle = '#6b7280';
      ctx.font = '12px Arial';
      ctx.fillText(`Generated: ${new Date().toLocaleDateString()}`, 30, 360);

      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `donor-card-${selectedDonor.displayId}.png`;
        a.click();
        URL.revokeObjectURL(url);
      });
    } catch (error) {
      console.error('Error generating card:', error);
      setError('Failed to download card');
    }
  };

  const handleVerifyCard = () => {
    setVerificationInput('');
    setVerificationResult(null);
    setShowVerifyModal(true);
  };

  const verifyDonorCard = async (input) => {
    const trimmedInput = input.trim();
    if (!trimmedInput) {
      setVerificationResult({
        valid: false,
        message: 'Please enter a donor ID or scan QR code.',
      });
      return;
    }

    try {
      let userId;
      
      // Check if input is QR code format
      if (trimmedInput.startsWith('BLOODCONNECT:USER:')) {
        userId = trimmedInput.split(':')[2];
      } else {
        // Assume it's a display ID, need to find user
        const donorsQuery = query(
          collection(db, 'donor_profiles'),
          where('display_id', '==', trimmedInput)
        );
        const donorSnapshot = await getDocs(donorsQuery);
        
        if (donorSnapshot.empty) {
          setVerificationResult({
            valid: false,
            message: 'Invalid donor ID. Card not found in system.',
          });
          return;
        }
        
        userId = donorSnapshot.docs[0].data().user_id;
      }

      // Fetch user data
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        setVerificationResult({
          valid: false,
          message: 'User not found in system.',
        });
        return;
      }
      const userData = userDoc.data();

      // Fetch donor profile
      const donorDoc = await getDoc(doc(db, 'donor_profiles', userId));
      if (!donorDoc.exists()) {
        setVerificationResult({
          valid: false,
          message: 'Donor profile not found.',
        });
        return;
      }
      const donorProfile = donorDoc.data();

      // Fetch latest eligibility request
      let eligibilityStatus = 'Not Submitted';
      try {
        const eligibilityQuery = query(
          collection(db, 'eligibility_requests'),
          where('userId', '==', userId)
        );
        const eligibilitySnapshot = await getDocs(eligibilityQuery);
        
        if (!eligibilitySnapshot.empty) {
          // Get most recent request
          let latestDate = null;
          let latestRequest = null;
          
          eligibilitySnapshot.forEach(doc => {
            const requestData = doc.data();
            if (requestData.submittedDate) {
              const requestDate = requestData.submittedDate.toDate();
              if (!latestDate || requestDate > latestDate) {
                latestDate = requestDate;
                latestRequest = requestData;
              }
            }
          });
          
          if (latestRequest) {
            eligibilityStatus = latestRequest.status || 'pending';
          }
        }
      } catch (error) {
        console.error('Error fetching eligibility:', error);
      }

      // Fetch last donation
      let lastDonation = '';
      try {
        const donationsQuery = query(
          collection(db, 'donations'),
          where('donor_id', '==', userId)
        );
        const donationsSnapshot = await getDocs(donationsQuery);
        
        if (!donationsSnapshot.empty) {
          // Get most recent donation
          let latestDate = null;
          let latestDonationData = null;
          
          donationsSnapshot.forEach(doc => {
            const donationData = doc.data();
            if (donationData.donation_date) {
              const donationDate = donationData.donation_date.toDate();
              if (!latestDate || donationDate > latestDate) {
                latestDate = donationDate;
                latestDonationData = donationData;
              }
            }
          });
          
          if (latestDonationData && latestDonationData.donation_date) {
            lastDonation = latestDonationData.donation_date.toDate().toISOString().split('T')[0];
          }
        }
      } catch (error) {
        console.error('Error fetching donations:', error);
      }

      setVerificationResult({
        valid: true,
        donor: {
          id: userId,
          fullName: donorProfile.full_name || '',
          displayId: donorProfile.display_id || `DON-${userId.substring(0, 7)}`,
          bloodGroup: donorProfile.blood_group || '',
          email: userData.email || '',
          phone: userData.phone_number || '',
          emergencyContactName: donorProfile.emergency_contact_name || '',
          emergencyContactPhone: donorProfile.emergency_contact_phone || '',
          eligibilityStatus,
          lastDonation,
          isEligible: eligibilityStatus === 'approved',
        },
      });

    } catch (error) {
      console.error('Verification error:', error);
      setVerificationResult({
        valid: false,
        message: 'Error verifying card. Please try again.',
      });
    }
  };

  const handleQRImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const img = document.createElement('img');
      const reader = new FileReader();

      reader.onload = (event) => {
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);

            if (code && code.data) {
              setVerificationInput(code.data);
              await verifyDonorCard(code.data);
            } else {
              setError('Could not detect QR code in image. Please try a clearer photo or enter the ID manually.');
            }
          } catch (err) {
            setError('Error processing QR code. Please enter the ID manually.');
          }
        };
        img.src = event.target.result;
      };

      reader.readAsDataURL(file);
    } catch (err) {
      setError('Error uploading image. Please try again.');
    }
  };

  const formatLastDonation = (date) => {
    if (!date) return 'No donations yet';
    try {
      const d = new Date(date);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const stats = {
    total: donors.length,
    aPositive: donors.filter(d => d.bloodGroup === 'A+').length,
    oPositive: donors.filter(d => d.bloodGroup === 'O+').length,
    rare: donors.filter(d => ['AB-', 'B-', 'A-', 'O-'].includes(d.bloodGroup)).length,
    eligible: donors.filter(d => d.isEligible).length,
  };

  if (loading) {
    return (
      <Layout onNavigate={onNavigate} currentPage="digital-donor-cards">
        <div className="loading-container">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <p className="loading-text">Loading donor cards...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout onNavigate={onNavigate} currentPage="digital-donor-cards">
      <div className="space-y-6">
        {/* Header */}
        <div className="donor-cards-header-container">
          <h1 className="donor-cards-header-title">Digital Donor Cards</h1>
          <p className="donor-cards-header-subtitle">Generate, view, and verify digital donor identity cards</p>
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
        <div className="donor-cards-stats-grid">
          <div className="donor-stat-card stat-card-total">
            <QrCode className="stat-icon text-blue-600" />
            <div>
              <h3 className="stat-number-blue">{stats.total}</h3>
              <p className="stat-label">Total Donor Cards</p>
            </div>
          </div>
          <div className="donor-stat-card stat-card-rare">
            <AlertCircle className="stat-icon text-purple-600" />
            <div>
              <h3 className="stat-number-purple">{stats.rare}</h3>
              <p className="stat-label">Rare Blood Types</p>
            </div>
          </div>
          <div className="donor-stat-card stat-card-eligible">
            <Check className="stat-icon text-green-600" />
            <div>
              <h3 className="stat-number-green">{stats.eligible}</h3>
              <p className="stat-label">Eligible Donors</p>
            </div>
          </div>
        </div>

        {/* Action Buttons & Filters */}
        <div className="donor-cards-actions-container">
          <div className="donor-cards-button-group">
            <button onClick={handleCreateUserWithCard} className="donor-action-btn add-btn">
              <Plus size={20} />
              Create User with Card
            </button>
            <button onClick={handleVerifyCard} className="donor-action-btn verify-btn">
              <Camera size={20} />
              Verify Card
            </button>
          </div>

          <div className="donor-cards-filters-row">
            <div className="donor-search-input-container">
              <Search className="donor-search-icon" />
              <input
                type="text"
                placeholder="Search by name, ID, email, or blood type..."
                className="donor-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="donor-bloodtype-filter"
              value={bloodTypeFilter}
              onChange={(e) => setBloodTypeFilter(e.target.value)}
            >
              <option value="All">All Blood Types</option>
              {bloodTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Donor Cards Grid */}
        <div className="donor-list-section">
          <div className="donor-list-header">
            <h2 className="donor-list-title">Registered Donors</h2>
            <div className="donor-count-badge">{filteredDonors.length} donors</div>
          </div>

          <div className="donor-cards-grid">
            {filteredDonors.map((donor) => (
              <div key={donor.id} className="donor-card-wrapper" onClick={() => handleViewCard(donor)}>
                <div className="donor-card-actions">
                  <button
                    onClick={(e) => handleEditDonor(donor, e)}
                    className="donor-action-button donor-edit-button"
                    title="Edit"
                  >
                    <Edit2 className="donor-action-icon" />
                  </button>
                  <button
                    onClick={(e) => handleDeleteClick(donor, e)}
                    className="donor-action-button donor-delete-button"
                    title="Delete"
                  >
                    <Trash2 className="donor-action-icon" />
                  </button>
                </div>

                <div className="donor-card-content">
                  <div className="donor-qr-container">
                    <div className="donor-qr-badge">
                      <QrCode size={64} strokeWidth={2} />
                    </div>
                  </div>

                  <div className="donor-info">
                    <h3 className="donor-name">{donor.fullName}</h3>
                    <div className="donor-status">
                      <span className="blood-type">{donor.bloodGroup}</span>
                      <span className="separator">•</span>
                      <span className="donor-id">ID: {donor.displayId}</span>
                    </div>
                    <div className="donor-meta">
                      <p className="donor-last-donation">
                        Last Donation: {formatLastDonation(donor.lastDonation)}
                      </p>
                      <p className="donor-eligibility">
                        Eligibility: <span className={`eligibility-badge ${donor.isEligible ? 'eligible' : 'not-eligible'}`}>
                          {donor.eligibilityStatus}
                        </span>
                      </p>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewCard(donor);
                      }}
                      className="view-details-btn"
                    >
                      View Full Card
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredDonors.length === 0 && (
            <div className="donor-empty-state">
              <div className="donor-empty-state-icon">
                <QrCode />
              </div>
              <h3 className="donor-empty-state-title">No donor cards found</h3>
              <p className="donor-empty-state-description">
                Try adjusting your search or add a new donor card
              </p>
            </div>
          )}
        </div>

        {/* Full Card Modal */}
        {showCardModal && selectedDonor && (
          <div className="card-modal-overlay" onClick={() => setShowCardModal(false)}>
            <div className="card-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-card">
                <div className="modal-card-header">
                  <h2>Digital Donor Card</h2>
                  <button onClick={() => setShowCardModal(false)} className="modal-close-btn">
                    <X size={24} />
                  </button>
                </div>

                <div className="modal-qr-section">
                  <div className="modal-qr-code">
                    <QRCodeGenerator value={selectedDonor.qrCodeData} size={160} />
                  </div>
                </div>

                <div className="modal-card-details">
                  <div className="modal-detail-row">
                    <span className="detail-label">Name:</span>
                    <span className="detail-value">{selectedDonor.fullName}</span>
                  </div>
                  <div className="modal-detail-row">
                    <span className="detail-label">Display ID:</span>
                    <span className="detail-value">{selectedDonor.displayId}</span>
                  </div>
                  <div className="modal-detail-row">
                    <span className="detail-label">User ID:</span>
                    <span className="detail-value small-text">{selectedDonor.id}</span>
                  </div>
                  <div className="modal-detail-row">
                    <span className="detail-label">Blood Type:</span>
                    <span className="blood-type-large">{selectedDonor.bloodGroup}</span>
                  </div>
                  <div className="modal-detail-row">
                    <span className="detail-label">Email:</span>
                    <span className="detail-value">{selectedDonor.email || 'Not provided'}</span>
                  </div>
                  <div className="modal-detail-row">
                    <span className="detail-label">Phone:</span>
                    <span className="detail-value">{selectedDonor.phone || 'Not provided'}</span>
                  </div>
                  <div className="modal-detail-row">
                    <span className="detail-label">Last Donation:</span>
                    <span className="detail-value">{formatLastDonation(selectedDonor.lastDonation)}</span>
                  </div>
                  <div className="modal-detail-row">
                    <span className="detail-label">Eligibility Status:</span>
                    <span className={`detail-badge ${selectedDonor.isEligible ? 'badge-eligible' : 'badge-ineligible'}`}>
                      {selectedDonor.eligibilityStatus}
                    </span>
                  </div>
                  {selectedDonor.emergencyContactName && (
                    <div className="modal-detail-row">
                      <span className="detail-label">Emergency Contact:</span>
                      <span className="detail-value">{selectedDonor.emergencyContactName}</span>
                    </div>
                  )}
                  {selectedDonor.emergencyContactPhone && (
                    <div className="modal-detail-row">
                      <span className="detail-label">Emergency Phone:</span>
                      <span className="detail-value">{selectedDonor.emergencyContactPhone}</span>
                    </div>
                  )}
                  <div className="modal-detail-row">
                    <span className="detail-label">Medical Conditions:</span>
                    <span className="detail-value">{selectedDonor.medicalConditions}</span>
                  </div>
                  {selectedDonor.allergies && selectedDonor.allergies !== 'None' && (
                    <div className="modal-detail-row">
                      <span className="detail-label">Allergies:</span>
                      <span className="detail-value">{selectedDonor.allergies}</span>
                    </div>
                  )}
                  <div className="modal-detail-row">
                    <span className="detail-label">QR Code Data:</span>
                    <span className="detail-value small-text">{selectedDonor.qrCodeData}</span>
                  </div>
                </div>

                <div className="modal-actions">
                  <button onClick={handleDownloadCard} className="modal-download-button">
                    <Download size={20} />
                    Download Card
                  </button>
                  <button onClick={() => setShowCardModal(false)} className="modal-close-button">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Modal */}
        {showAddEditModal && (
          <div className="card-modal-overlay" onClick={() => setShowAddEditModal(false)}>
            <div className="card-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-card">
                <div className="modal-card-header">
                  <h2>{editingDonor ? 'Edit Donor Card' : 'Create User with Card'}</h2>
                  <button onClick={() => setShowAddEditModal(false)} className="modal-close-btn">
                    <X size={24} />
                  </button>
                </div>

                <div className="modal-form-content">
                  {!editingDonor && (
                    <>
                      <div className="modal-section-divider">
                        <span className="modal-section-title">Account Information</span>
                      </div>
                      <div className="modal-form-group">
                        <label className="modal-form-label">Email *</label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="modal-form-input"
                          placeholder="email@example.com"
                          required
                        />
                      </div>
                    </>
                  )}

                  <div className="modal-section-divider">
                    <span className="modal-section-title">Personal Information</span>
                  </div>

                  <div className="modal-form-group">
                    <label className="modal-form-label">Full Name *</label>
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="modal-form-input"
                      placeholder="Enter full name"
                      required
                    />
                  </div>

                  <div className="modal-form-row">
                    <div className="modal-form-group">
                      <label className="modal-form-label">Blood Group *</label>
                      <select
                        value={formData.blood_group}
                        onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}
                        className="modal-form-select"
                      >
                        {bloodTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>

                    <div className="modal-form-group">
                      <label className="modal-form-label">Gender</label>
                      <select
                        value={formData.gender}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                        className="modal-form-select"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                  </div>

                  <div className="modal-form-row">
                    <div className="modal-form-group">
                      <label className="modal-form-label">Phone Number</label>
                      <input
                        type="tel"
                        value={formData.phone_number}
                        onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                        className="modal-form-input"
                        placeholder="+60123456789"
                      />
                    </div>

                    {!editingDonor && (
                      <div className="modal-form-group">
                        <label className="modal-form-label">Date of Birth</label>
                        <input
                          type="date"
                          value={formData.birth_date}
                          onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                          className="modal-form-input"
                        />
                      </div>
                    )}
                  </div>

                  <div className="modal-section-divider">
                    <span className="modal-section-title">Emergency Contact</span>
                  </div>

                  <div className="modal-form-row">
                    <div className="modal-form-group">
                      <label className="modal-form-label">Contact Name</label>
                      <input
                        type="text"
                        value={formData.emergency_contact_name}
                        onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                        className="modal-form-input"
                        placeholder="Enter emergency contact name"
                      />
                    </div>

                    <div className="modal-form-group">
                      <label className="modal-form-label">Contact Phone</label>
                      <input
                        type="tel"
                        value={formData.emergency_contact_phone}
                        onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                        className="modal-form-input"
                        placeholder="+60123456789"
                      />
                    </div>
                  </div>

                  <div className="modal-section-divider">
                    <span className="modal-section-title">Medical Information</span>
                  </div>

                  <div className="modal-form-group">
                    <label className="modal-form-label">Medical Conditions</label>
                    <textarea
                      value={formData.medical_conditions}
                      onChange={(e) => setFormData({ ...formData, medical_conditions: e.target.value })}
                      className="modal-form-textarea"
                      rows="2"
                      placeholder="Enter any medical conditions or 'None'"
                    />
                  </div>

                  <div className="modal-form-group">
                    <label className="modal-form-label">Allergies</label>
                    <textarea
                      value={formData.allergies}
                      onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                      className="modal-form-textarea"
                      rows="2"
                      placeholder="Enter any allergies or 'None'"
                    />
                  </div>

                  {!editingDonor && (
                    <>
                      <div className="modal-section-divider">
                        <span className="modal-section-title">Additional Information</span>
                      </div>
                      <div className="modal-form-row">
                        <div className="modal-form-group">
                          <label className="modal-form-label">Height (cm)</label>
                          <input
                            type="number"
                            value={formData.height}
                            onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                            className="modal-form-input"
                            placeholder="Enter height"
                          />
                        </div>

                        <div className="modal-form-group">
                          <label className="modal-form-label">Weight (kg)</label>
                          <input
                            type="number"
                            value={formData.weight}
                            onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                            className="modal-form-input"
                            placeholder="Enter weight"
                          />
                        </div>
                      </div>

                      <div className="modal-form-group">
                        <label className="modal-form-label">Blood Bank ID</label>
                        <input
                          type="text"
                          value={formData.blood_bank_id}
                          onChange={(e) => setFormData({ ...formData, blood_bank_id: e.target.value })}
                          className="modal-form-input"
                          placeholder="e.g., 906-890 (optional)"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="modal-form-actions">
                  <button
                    onClick={() => setShowAddEditModal(false)}
                    className="modal-cancel-button"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    className="modal-save-button"
                  >
                    {editingDonor ? 'Update Card' : 'Create User & Card'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Verify Modal */}
        {showVerifyModal && (
          <div className="card-modal-overlay" onClick={() => setShowVerifyModal(false)}>
            <div className="card-modal-content verify-modal-width" onClick={(e) => e.stopPropagation()}>
              <div className="modal-card">
                <div className="modal-card-header verify-header">
                  <h2>Verify Donor Card</h2>
                  <button onClick={() => setShowVerifyModal(false)} className="modal-close-btn">
                    <X size={24} />
                  </button>
                </div>

                <div className="modal-form-content">
                  <p className="verify-description">Enter the donor ID/display ID from the card or upload/scan a QR code to verify authenticity.</p>

                  <div className="modal-form-group">
                    <label className="modal-form-label">Donor ID / Display ID / QR Code Data</label>
                    <input
                      type="text"
                      value={verificationInput}
                      onChange={(e) => setVerificationInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && verifyDonorCard(verificationInput)}
                      className="modal-form-input"
                      placeholder="e.g., DON-9MW4SEL or BLOODCONNECT:USER:9MW4SELaQibhaXDatRgRkegBzHG3"
                    />
                  </div>

                  <div className="verify-divider">
                    <span>OR</span>
                  </div>

                  <div className="modal-form-group">
                    <label className="modal-form-label">Upload QR Code Image</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleQRImageUpload}
                      className="modal-form-file-input"
                    />
                    <p className="file-input-hint">Upload a screenshot or photo of the QR code</p>
                  </div>

                  <button
                    onClick={() => verifyDonorCard(verificationInput)}
                    className="verify-button"
                    disabled={!verificationInput.trim()}
                  >
                    Verify Card
                  </button>

                  {verificationResult && (
                    <div className={`verification-result ${verificationResult.valid ? 'result-valid' : 'result-invalid'}`}>
                      <div className="verification-result-header">
                        {verificationResult.valid ? (
                          <Check className="verification-icon valid-icon" size={24} />
                        ) : (
                          <AlertCircle className="verification-icon invalid-icon" size={24} />
                        )}
                        <h3 className="verification-result-title">
                          {verificationResult.valid ? 'Valid Card ✓' : 'Invalid Card ✗'}
                        </h3>
                      </div>
                      {verificationResult.valid ? (
                        <div className="verification-details">
                          <p><strong>Name:</strong> {verificationResult.donor.fullName}</p>
                          <p><strong>Display ID:</strong> {verificationResult.donor.displayId}</p>
                          <p><strong>Blood Type:</strong> {verificationResult.donor.bloodGroup}</p>
                          <p><strong>Email:</strong> {verificationResult.donor.email || 'Not provided'}</p>
                          <p><strong>Phone:</strong> {verificationResult.donor.phone || 'Not provided'}</p>
                          <p><strong>Last Donation:</strong> {formatLastDonation(verificationResult.donor.lastDonation)}</p>
                          <p><strong>Eligibility Status:</strong> 
                            <span className={`verification-status ${verificationResult.donor.isEligible ? 'status-eligible' : 'status-ineligible'}`}>
                              {verificationResult.donor.eligibilityStatus}
                            </span>
                          </p>
                          {verificationResult.donor.emergencyContactName && (
                            <p><strong>Emergency Contact:</strong> {verificationResult.donor.emergencyContactName}</p>
                          )}
                          {verificationResult.donor.emergencyContactPhone && (
                            <p><strong>Emergency Phone:</strong> {verificationResult.donor.emergencyContactPhone}</p>
                          )}
                        </div>
                      ) : (
                        <p className="verification-error-message">{verificationResult.message}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && selectedDonor && (
          <div className="modal-overlay">
            <div className="delete-confirm-modal">
              <div className="delete-icon-container">
                <Trash2 className="delete-icon" />
              </div>
              <h3 className="delete-title">Delete Donor Card</h3>
              <p className="delete-message">
                Are you sure you want to delete the donor card for <strong>{selectedDonor.fullName}</strong>? This will also delete the user account. This action cannot be undone.
              </p>
              <div className="delete-details">
                <p><strong>Display ID:</strong> {selectedDonor.displayId}</p>
                <p><strong>Blood Type:</strong> {selectedDonor.bloodGroup}</p>
                <p><strong>Email:</strong> {selectedDonor.email}</p>
              </div>
              <div className="delete-actions">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="delete-btn"
                >
                  Delete Card & User
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default DigitalDonorCards;