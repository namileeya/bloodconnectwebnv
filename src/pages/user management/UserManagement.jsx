import React, { useState, useEffect } from 'react';
import {
  Search,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
} from 'lucide-react';
import Layout from '../../components/Layout';
import './UserManagement.css';

// Firebase imports - adjust path as needed
import { getAuth, createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
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
  serverTimestamp,
  Timestamp,
  setDoc
} from 'firebase/firestore';
import app from '../../firebase'; // Adjust path to your firebase config

const auth = getAuth(app);
const db = getFirestore(app);

/* --------------------------------------------------------------
   Helper functions
   -------------------------------------------------------------- */
const getInitials = (name) => {
  return name
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase())
    .join('')
    .substring(0, 2);
};

const getAvatarColor = (name) => {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-teal-500',
    'bg-orange-500',
    'bg-cyan-500',
    'bg-lime-500',
    'bg-amber-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const Avatar = ({ name, size = 'w-20 h-20' }) => {
  const initials = getInitials(name);
  const colorClass = getAvatarColor(name);
  return (
    <div className={`avatar ${size} ${colorClass}`}>
      {initials}
    </div>
  );
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
  // Handle both Date objects and "DD/MM/YYYY" strings
  if (dateString.includes('/')) return dateString;

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // Invalid date

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (error) {
    return dateString;
  }
};

/* --------------------------------------------------------------
   User Card Component
   -------------------------------------------------------------- */
const UserCard = ({ user, onEdit, onDelete, onViewDetails }) => (
  <div className="user-card-wrapper">
    <div className="user-card-actions">
      <button
        className="user-action-button user-edit-button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit(user);
        }}
        title="Edit user"
      >
        <Edit2 className="user-action-icon" />
      </button>
      <button
        className="user-action-button user-delete-button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(user.id);
        }}
        title="Delete user"
      >
        <Trash2 className="user-action-icon" />
      </button>
    </div>

    <div className="user-card-content">
      <div className="avatar-container">
        <Avatar name={user.fullName} />
      </div>

      <div className="user-info">
        <h3 className="user-name">{user.fullName}</h3>
        <div className="user-status">
          <span className="blood-type">{user.bloodGroup}</span>
          <span className="separator">•</span>
          <span className="donor-status">{user.donorStatus || 'New Donor'}</span>
        </div>
        <p className="user-email">{user.email}</p>
        <p className="user-id">ID: {user.displayId || `DON-${user.id.substring(0, 7)}`}</p>

        <button onClick={() => onViewDetails(user)} className="view-details-btn">
          View Details
        </button>
      </div>
    </div>
  </div>
);

/* --------------------------------------------------------------
   User Details Modal
   -------------------------------------------------------------- */
const UserDetailsModal = ({ user, onClose }) => {
  if (!user) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2 className="modal-title">User Details</h2>
          <button onClick={onClose} className="modal-close-btn">
            <X className="modal-close-icon" />
          </button>
        </div>

        <div className="modal-content">
          <div className="profile-header">
            <Avatar name={user.fullName} size="w-24 h-24" />
            <div className="profile-info">
              <h3 className="profile-name">{user.fullName}</h3>
              <div className="profile-tags">
                <span className="blood-type-tag">{user.bloodGroup}</span>
                <span className="donor-status-tag">{user.donorStatus || 'New Donor'}</span>
                <span className="donation-count-tag">
                  {user.donationCount || 0}{' '}
                  {(user.donationCount || 0) === 1 ? 'Donation' : 'Donations'}
                </span>
              </div>
            </div>
          </div>

          <div className="info-grid">
            <div className="info-section personal-info">
              <h4 className="section-title">Personal Information</h4>
              <div className="info-fields">
                <InfoField label="Full Name" value={user.fullName} />
                <InfoField label="ID Type" value={user.idType || 'IC Number'} />
                <InfoField label="ID Number" value={user.idNumber} />
                <InfoField label="Display ID" value={user.displayId || `DON-${user.id.substring(0, 7)}`} />
                <InfoField label="Gender" value={user.gender} />
                <InfoField label="Date of Birth" value={user.birthDate} />
                <InfoField label="Email" value={user.email} />
                <InfoField label="Phone Number" value={user.phoneNumber} />
                <InfoField label="Address" value={user.address} />
                <InfoField label="State" value={user.state} />
                <InfoField label="Postcode" value={user.postcode} />
                <InfoField label="Blood Bank ID" value={user.bloodBankId || 'Not provided'} />
              </div>
            </div>

            <div className="info-section medical-info">
              <h4 className="section-title">Medical Information</h4>
              <div className="info-fields">
                <InfoField label="Blood Group" value={user.bloodGroup} />
                <InfoField label="Rhesus" value={user.rhesus} />
                <InfoField label="Height (cm)" value={user.height} />
                <InfoField label="Weight (kg)" value={user.weight} />
                <InfoField label="Medical Conditions" value={user.medicalConditions || 'None'} />
                <InfoField label="Allergies" value={user.allergies || 'None'} />
              </div>

              <div className="donation-stats">
                <h5 className="stats-title">Donation Statistics</h5>
                <div className="stats-grid">
                  <div className="stat-item">
                    <div className="stat-value">{user.donationCount || 0}</div>
                    <div className="stat-label">Total Donations</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{((user.totalBloodDonatedML || 0) / 1000).toFixed(2)}L</div>
                    <div className="stat-label">Blood Donated</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{user.donationCount || 0}</div>
                    <div className="stat-label">Lives Saved</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button onClick={onClose} className="close-btn">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoField = ({ label, value }) => (
  <div className="info-field">
    <div className="info-label">{label}</div>
    <div className="info-value">{value || 'Not provided'}</div>
  </div>
);

/* --------------------------------------------------------------
   Pagination Component
   -------------------------------------------------------------- */
const Pagination = ({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
}) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="pagination">
      <div className="pagination-info">
        <span>Items per page:</span>
        <select
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          className="items-per-page-select"
        >
          <option value={6}>6</option>
          <option value={8}>8</option>
          <option value={12}>12</option>
          <option value={16}>16</option>
        </select>
        <span className="pagination-range">
          {startItem}-{endItem} of {totalItems}
        </span>
      </div>

      <div className="pagination-controls">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="pagination-btn prev-btn"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="pagination-btn next-btn"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

/* --------------------------------------------------------------
   MAIN COMPONENT
   -------------------------------------------------------------- */
const UserManagement = ({ onNavigate }) => {
  /* ----- Core state ----- */
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);
  const [loading, setLoading] = useState(true);
  const [tempPassword, setTempPassword] = useState('');

  /* ----- Modals ----- */
  const [selectedUser, setSelectedUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  /* ----- New user form ----- */
  const [newUser, setNewUser] = useState({
    fullName: '',
    idType: 'IC Number',
    idNumber: '',
    gender: 'Male',
    birthDate: '',
    email: '',
    phoneNumber: '',
    address: '',
    state: '',
    postcode: '',
    bloodGroup: 'A+',
    rhesus: 'Rh-positive',
    height: '',
    weight: '',
    medicalConditions: 'None',
    allergies: 'None',
    bloodBankId: '',
  });

  /* ----- Filter state ----- */
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [bloodTypeFilter, setBloodTypeFilter] = useState('All');

  /* ----- Load users from Firebase ----- */
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      // 1. Fetch all users from users collection
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = [];

      console.log('Total users in collection:', usersSnapshot.size);

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();

        console.log(`Processing user: ${userId}, email: ${userData.email}`);

        // 2. Fetch donor profile
        let donorProfile = {};
        try {
          const donorDoc = await getDoc(doc(db, 'donor_profiles', userId));
          if (donorDoc.exists()) {
            donorProfile = donorDoc.data();
            console.log(`Found donor profile for ${userId}:`, donorProfile.full_name);
          } else {
            console.log(`No donor profile found for ${userId}`);
          }
        } catch (error) {
          console.error(`Error fetching donor profile for ${userId}:`, error);
        }

        // 3. Query donations for this user - FIXED FIELD NAME
        let donationCount = 0;
        let totalBloodDonatedML = 0;
        try {
          // Debug: Check what field name is used in donations collection
          console.log(`Querying donations for user: ${userId}`);

          // Try both possible field names
          let donationsSnapshot;
          try {
            // First try 'donor_id' (as we created)
            donationsSnapshot = await getDocs(
              query(collection(db, 'donations'), where('donor_id', '==', userId))
            );
            console.log(`Found ${donationsSnapshot.size} donations using 'donor_id' field`);

            if (donationsSnapshot.size === 0) {
              // Try 'userId' or other possible field names
              const allDonations = await getDocs(collection(db, 'donations'));
              console.log('All donations in collection:', allDonations.size);
              allDonations.forEach(doc => {
                console.log('Donation fields:', doc.id, doc.data());
              });
            }
          } catch (queryError) {
            console.log('Query error, checking donations collection structure');
          }

          if (donationsSnapshot) {
            donationCount = donationsSnapshot.size;

            donationsSnapshot.forEach(doc => {
              const donationData = doc.data();
              console.log('Donation data:', donationData);
              totalBloodDonatedML += donationData.amount_ml || 0;
            });
          }

          console.log(`Calculated for ${userId}: ${donationCount} donations, ${totalBloodDonatedML}ml`);

        } catch (error) {
          console.error(`Error fetching donations for ${userId}:`, error);
        }

        // 4. Calculate donor status
        const donorStatus = donationCount >= 3 ? 'Regular Donor' : 'New Donor';

        // 5. Combine all data
        usersData.push({
          id: userId,
          email: userData.email || '',
          username: userData.username || '',
          phoneNumber: userData.phone_number || '',
          address: userData.address || '',
          state: userData.state || '',
          postcode: userData.postcode || '',
          role: userData.role || 'blood_donor',
          qrCodeData: userData.qr_code_data || `BLOODCONNECT:USER:${userId}`,
          // From donor_profiles
          fullName: donorProfile.full_name || '',
          idType: donorProfile.id_type || 'IC Number',
          idNumber: donorProfile.id_number || '',
          birthDate: donorProfile.birth_date || '',
          gender: donorProfile.gender || '',
          bloodGroup: donorProfile.blood_group || '',
          rhesus: donorProfile.rhesus || '',
          height: donorProfile.height || '',
          weight: donorProfile.weight || '',
          medicalConditions: donorProfile.medical_conditions || 'None',
          allergies: donorProfile.allergies || 'None',
          bloodBankId: donorProfile.blood_bank_id || 'Not provided',
          displayId: donorProfile.display_id || `DON-${userId.substring(0, 7)}`,
          // Calculated from donations
          donationCount,
          totalBloodDonatedML,
          donorStatus,
        });
      }

      console.log('Final users data:', usersData);
      setUsers(usersData);
      setFilteredUsers(usersData);

      // 6. Check and create sample donation if needed
      await checkAndCreateSampleDonation();

    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkAndCreateSampleDonation = async () => {
    try {
      const sampleUserId = "9MW4SELaQibhaXDatRgRkegBzHG3";
      console.log('Checking donations for sample user:', sampleUserId);

      // First check if user exists
      const userDoc = await getDoc(doc(db, 'users', sampleUserId));
      if (!userDoc.exists()) {
        console.log('Sample user does not exist in users collection');
        return;
      }

      const userData = userDoc.data();
      console.log('Sample user found:', userData.email);

      // Get donor profile for name
      let donorName = "batrissya aleeya";
      try {
        const donorDoc = await getDoc(doc(db, 'donor_profiles', sampleUserId));
        if (donorDoc.exists()) {
          donorName = donorDoc.data().full_name || donorName;
        }
      } catch (error) {
        console.error('Error getting donor profile:', error);
      }

      // Check if donations exist for this user
      const donationsQuery = query(
        collection(db, 'donations'),
        where('donor_id', '==', sampleUserId)
      );
      const donationsSnapshot = await getDocs(donationsQuery);

      console.log(`Found ${donationsSnapshot.size} donations for sample user`);

      if (donationsSnapshot.empty) {
        console.log('Creating sample donation...');
        // Create a sample donation
        const donationData = {
          donor_id: sampleUserId,
          donor_name: donorName,
          blood_type: "AB+",
          serial_number: "DON-2024-001",
          amount_ml: 450,
          donation_date: serverTimestamp(),
          expiry_date: Timestamp.fromDate(new Date(Date.now() + 42 * 24 * 60 * 60 * 1000)), // 42 days from now
          status: "stored",
          created_by: "Admin",
          created_at: serverTimestamp(),
        };

        await addDoc(collection(db, 'donations'), donationData);
        console.log('Sample donation created successfully');

        // Reload users to show updated donation count
        await loadUsers();
      } else {
        donationsSnapshot.forEach(doc => {
          console.log('Existing donation:', doc.id, doc.data());
        });
      }
    } catch (error) {
      console.error('Error checking/creating sample donation:', error);
    }
  };

  /* ----- Filter logic ----- */
  useEffect(() => {
    let filtered = [...users];

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          (u.fullName || '').toLowerCase().includes(term) ||
          (u.email || '').toLowerCase().includes(term) ||
          (u.idNumber || '').toLowerCase().includes(term) ||
          (u.phoneNumber || '').toLowerCase().includes(term) ||
          (u.displayId || '').toLowerCase().includes(term)
      );
    }

    // Donor status
    if (statusFilter !== 'All') {
      filtered = filtered.filter((u) => u.donorStatus === statusFilter);
    }

    // Blood type
    if (bloodTypeFilter !== 'All') {
      filtered = filtered.filter((u) => u.bloodGroup === bloodTypeFilter);
    }

    setFilteredUsers(filtered);
    setCurrentPage(1);
  }, [searchTerm, statusFilter, bloodTypeFilter, users]);

  /* ----- Pagination helpers ----- */
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentUsers = filteredUsers.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  /* ----- Handlers ----- */
  const handleEdit = (user) => {
    setSelectedUser({ ...user });
    setShowEditModal(true);
  };

  const handleDeleteClick = (id) => {
    setDeletingUserId(id);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      // 1. Delete from Firebase Auth
      const userToDelete = users.find(u => u.id === deletingUserId);
      if (userToDelete) {
        // Note: This requires admin privileges or the user to be current user
        // In production, you'd need a backend function for this
        console.log('Would delete auth user:', userToDelete.email);
        // await deleteUser(auth.currentUser); // Requires user to be signed in
      }

      // 2. Delete from users collection
      await deleteDoc(doc(db, 'users', deletingUserId));

      // 3. Delete from donor_profiles collection
      await deleteDoc(doc(db, 'donor_profiles', deletingUserId));

      // 4. Update local state
      setUsers(prev => prev.filter((u) => u.id !== deletingUserId));

      // 5. Close modal
      setShowDeleteConfirm(false);
      setDeletingUserId(null);

    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Error deleting user. Check console for details.');
    }
  };

  const handleAddNewMember = () => {
    setNewUser({
      fullName: '',
      idType: 'IC Number',
      idNumber: '',
      gender: 'Male',
      birthDate: '',
      email: '',
      phoneNumber: '',
      address: '',
      state: '',
      postcode: '',
      bloodGroup: 'A+',
      rhesus: 'Rh-positive',
      height: '',
      weight: '',
      medicalConditions: 'None',
      allergies: 'None',
      bloodBankId: '',
    });
    setShowAddModal(true);
  };

  const handleSaveNewUser = async () => {
    try {
      const password = generateRandomPassword();
      console.log('Creating user with email:', newUser.email);

      // 1. Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        newUser.email,
        password
      );
      const userId = userCredential.user.uid;
      console.log('Auth user created with ID:', userId);

      // Generate display ID and QR code
      const displayId = `DON-${userId.substring(0, 7)}`;
      const qrCodeData = `BLOODCONNECT:USER:${userId}`;

      // 2. Create users document
      await setDoc(doc(db, 'users', userId), {
        email: newUser.email,
        username: newUser.email.split('@')[0], // Simple username from email
        phone_number: newUser.phoneNumber,
        address: newUser.address,
        state: newUser.state,
        postcode: newUser.postcode,
        role: 'blood_donor',
        qr_code_data: qrCodeData,
        created_at: serverTimestamp(),
      });
      console.log('users document created');

      // 3. Create donor_profiles document
      await setDoc(doc(db, 'donor_profiles', userId), {
        user_id: userId,
        full_name: newUser.fullName,
        id_type: newUser.idType,
        id_number: newUser.idNumber,
        birth_date: newUser.birthDate ? formatDateToDDMMYYYY(newUser.birthDate) : '',
        gender: newUser.gender,
        blood_group: newUser.bloodGroup,
        rhesus: newUser.rhesus,
        height: newUser.height,
        weight: newUser.weight,
        medical_conditions: newUser.medicalConditions,
        allergies: newUser.allergies,
        blood_bank_id: newUser.bloodBankId || 'Not provided',
        display_id: displayId,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      console.log('donor_profiles document created');

      // 4. Show temp password to admin
      setTempPassword(password);
      setShowPasswordModal(true);

      // 5. Reload users and close modal
      await loadUsers();
      setShowAddModal(false);
      setNewUser({
        fullName: '',
        idType: 'IC Number',
        idNumber: '',
        gender: 'Male',
        birthDate: '',
        email: '',
        phoneNumber: '',
        address: '',
        state: '',
        postcode: '',
        bloodGroup: 'A+',
        rhesus: 'Rh-positive',
        height: '',
        weight: '',
        medicalConditions: 'None',
        allergies: 'None',
        bloodBankId: '',
      });

    } catch (error) {
      console.error('Error adding new user:', error);

      // Check if auth user was created but Firestore failed
      if (error.code === 'auth/email-already-in-use') {
        alert('Error: Email already in use. The auth user was created but Firestore documents may have failed. Check Firebase console.');
      } else {
        alert(`Error adding user: ${error.message}`);
      }
    }
  };

  const handleSaveEditUser = async () => {
    if (!selectedUser) return;

    try {
      const userId = selectedUser.id;

      // 1. Update users document (except email)
      await updateDoc(doc(db, 'users', userId), {
        phone_number: selectedUser.phoneNumber,
        address: selectedUser.address,
        state: selectedUser.state,
        postcode: selectedUser.postcode,
      });

      // 2. Update donor_profiles document
      await updateDoc(doc(db, 'donor_profiles', userId), {
        full_name: selectedUser.fullName,
        id_type: selectedUser.idType,
        id_number: selectedUser.idNumber,
        birth_date: selectedUser.birthDate,
        gender: selectedUser.gender,
        blood_group: selectedUser.bloodGroup,
        rhesus: selectedUser.rhesus,
        height: selectedUser.height,
        weight: selectedUser.weight,
        medical_conditions: selectedUser.medicalConditions,
        allergies: selectedUser.allergies,
        blood_bank_id: selectedUser.bloodBankId,
        updated_at: serverTimestamp(),
      });

      // 3. Update local state and close modal
      setUsers(prev => prev.map((u) =>
        u.id === selectedUser.id ? { ...selectedUser } : u
      ));
      handleCloseEditModal();

    } catch (error) {
      console.error('Error updating user:', error);
      alert(`Error updating user: ${error.message}`);
    }
  };

  const handleViewDetails = (user) => setSelectedUser(user);
  const handleCloseDetails = () => setSelectedUser(null);

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedUser(null);
  };

  const handlePageChange = (page) => setCurrentPage(page);
  const handleItemsPerPageChange = (val) => {
    setItemsPerPage(val);
    setCurrentPage(1);
  };

  /* --------------------------------------------------------------
     RENDER
     -------------------------------------------------------------- */
  return (
    <Layout onNavigate={onNavigate} currentPage="user-management">
      <div className="space-y-6">
        {/* ---------- Header ---------- */}
        <div className="user-header-container">
          <h1 className="user-header-title">User Management</h1>
          <button className="add-record-button" onClick={handleAddNewMember}>
            Add New Member
          </button>
        </div>

        {/* ---------- Loading State ---------- */}
        {loading && (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading users...</p>
          </div>
        )}

        {/* ---------- Search & Filters ---------- */}
        {!loading && (
          <>
            <div className="user-filters-container">
              <div className="user-filters-row">
                <div className="user-search-input-container">
                  <Search className="user-search-icon" />
                  <input
                    type="text"
                    placeholder="Search by name, email, ID, or phone..."
                    className="user-search-input"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <select
                  className="user-status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="All">All Status</option>
                  <option value="New Donor">New Donor</option>
                  <option value="Regular Donor">Regular Donor</option>
                </select>
                <select
                  className="user-blood-type-filter"
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

            {/* ---------- Users Grid ---------- */}
            <div className="users-grid">
              {currentUsers.length === 0 ? (
                <div className="user-empty-state">
                  <div className="user-empty-state-icon">
                    <Search />
                  </div>
                  <h3 className="user-empty-state-title">No users found</h3>
                  <p className="user-empty-state-description">
                    Try adjusting your search or filters
                  </p>
                </div>
              ) : (
                currentUsers.map((user) => (
                  <UserCard
                    key={user.id}
                    user={user}
                    onEdit={handleEdit}
                    onDelete={handleDeleteClick}
                    onViewDetails={handleViewDetails}
                  />
                ))
              )}
            </div>

            {/* ---------- Pagination ---------- */}
            {filteredUsers.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalItems={filteredUsers.length}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            )}
          </>
        )}

        {/* ---------- Details Modal ---------- */}
        {selectedUser && !showEditModal && (
          <UserDetailsModal user={selectedUser} onClose={handleCloseDetails} />
        )}

        {/* ---------- Edit Modal ---------- */}
        {showEditModal && selectedUser && (
          <div className="modal-overlay">
            <div className="edit-modal-container">
              <div className="modal-header">
                <h2 className="modal-title">Edit User</h2>
                <button onClick={handleCloseEditModal} className="modal-close-btn">
                  <X className="modal-close-icon" />
                </button>
              </div>

              <div className="modal-content edit-modal-content">
                <div className="edit-form-grid">
                  {/* Personal Information */}
                  <div className="edit-form-section">
                    <h3 className="edit-modal-section-title">Personal Information</h3>

                    <div className="edit-form-field">
                      <label className="edit-form-label">Full Name *</label>
                      <input
                        type="text"
                        className="edit-form-input"
                        value={selectedUser.fullName || ''}
                        onChange={(e) => setSelectedUser({ ...selectedUser, fullName: e.target.value })}
                        required
                      />
                    </div>

                    <div className="edit-form-field">
                      <label className="edit-form-label">ID Type *</label>
                      <select
                        className="edit-form-select"
                        value={selectedUser.idType || 'IC Number'}
                        onChange={(e) => setSelectedUser({ ...selectedUser, idType: e.target.value })}
                      >
                        <option value="IC Number">IC Number</option>
                        <option value="Passport">Passport</option>
                      </select>
                    </div>

                    <div className="edit-form-field">
                      <label className="edit-form-label">ID Number *</label>
                      <input
                        type="text"
                        className="edit-form-input"
                        value={selectedUser.idNumber || ''}
                        onChange={(e) => setSelectedUser({ ...selectedUser, idNumber: e.target.value })}
                        required
                      />
                    </div>

                    <div className="edit-form-field">
                      <label className="edit-form-label">Display ID</label>
                      <input
                        type="text"
                        className="edit-form-input"
                        value={selectedUser.displayId || `DON-${selectedUser.id.substring(0, 7)}`}
                        readOnly
                        disabled
                      />
                    </div>

                    <div className="edit-form-field">
                      <label className="edit-form-label">Gender *</label>
                      <select
                        className="edit-form-select"
                        value={selectedUser.gender || 'Male'}
                        onChange={(e) => setSelectedUser({ ...selectedUser, gender: e.target.value })}
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>

                    <div className="edit-form-field">
                      <label className="edit-form-label">Date of Birth *</label>
                      <input
                        type="text"
                        className="edit-form-input"
                        value={selectedUser.birthDate || ''}
                        onChange={(e) => setSelectedUser({ ...selectedUser, birthDate: e.target.value })}
                        placeholder="DD/MM/YYYY"
                        required
                      />
                    </div>

                    <div className="edit-form-field">
                      <label className="edit-form-label">Email *</label>
                      <input
                        type="email"
                        className="edit-form-input"
                        value={selectedUser.email || ''}
                        disabled
                        readOnly
                      />
                      <small className="text-gray-500 text-sm mt-1">
                        Email cannot be changed
                      </small>
                    </div>

                    <div className="edit-form-field">
                      <label className="edit-form-label">Phone Number *</label>
                      <input
                        type="tel"
                        className="edit-form-input"
                        value={selectedUser.phoneNumber || ''}
                        onChange={(e) => setSelectedUser({ ...selectedUser, phoneNumber: e.target.value })}
                        required
                      />
                    </div>

                    <div className="edit-form-field">
                      <label className="edit-form-label">Address *</label>
                      <textarea
                        className="edit-form-textarea"
                        value={selectedUser.address || ''}
                        onChange={(e) => setSelectedUser({ ...selectedUser, address: e.target.value })}
                        rows="3"
                        required
                      />
                    </div>

                    <div className="edit-form-field">
                      <label className="edit-form-label">State *</label>
                      <input
                        type="text"
                        className="edit-form-input"
                        value={selectedUser.state || ''}
                        onChange={(e) => setSelectedUser({ ...selectedUser, state: e.target.value })}
                        required
                      />
                    </div>

                    <div className="edit-form-field">
                      <label className="edit-form-label">Postcode *</label>
                      <input
                        type="text"
                        className="edit-form-input"
                        value={selectedUser.postcode || ''}
                        onChange={(e) => setSelectedUser({ ...selectedUser, postcode: e.target.value })}
                        required
                      />
                    </div>

                    <div className="edit-form-field">
                      <label className="edit-form-label">Blood Bank ID</label>
                      <input
                        type="text"
                        className="edit-form-input"
                        value={selectedUser.bloodBankId || ''}
                        onChange={(e) => setSelectedUser({ ...selectedUser, bloodBankId: e.target.value })}
                        placeholder="e.g., 906-890"
                      />
                    </div>
                  </div>

                  {/* Medical Information */}
                  <div className="edit-form-section">
                    <h3 className="edit-modal-section-title">Medical Information</h3>

                    <div className="edit-form-field">
                      <label className="edit-form-label">Blood Group *</label>
                      <select
                        className="edit-form-select"
                        value={selectedUser.bloodGroup || 'A+'}
                        onChange={(e) => setSelectedUser({ ...selectedUser, bloodGroup: e.target.value })}
                      >
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

                    <div className="edit-form-field">
                      <label className="edit-form-label">Rhesus *</label>
                      <select
                        className="edit-form-select"
                        value={selectedUser.rhesus || 'Rh-positive'}
                        onChange={(e) => setSelectedUser({ ...selectedUser, rhesus: e.target.value })}
                      >
                        <option value="Rh-positive">Rh-positive</option>
                        <option value="Rh-negative">Rh-negative</option>
                      </select>
                    </div>

                    <div className="edit-form-field">
                      <label className="edit-form-label">Height (cm) *</label>
                      <input
                        type="number"
                        className="edit-form-input"
                        value={selectedUser.height || ''}
                        onChange={(e) => setSelectedUser({ ...selectedUser, height: e.target.value })}
                        required
                      />
                    </div>

                    <div className="edit-form-field">
                      <label className="edit-form-label">Weight (kg) *</label>
                      <input
                        type="number"
                        className="edit-form-input"
                        value={selectedUser.weight || ''}
                        onChange={(e) => setSelectedUser({ ...selectedUser, weight: e.target.value })}
                        required
                      />
                    </div>

                    <div className="edit-form-field">
                      <label className="edit-form-label">Medical Conditions</label>
                      <textarea
                        className="edit-form-textarea"
                        value={selectedUser.medicalConditions || ''}
                        onChange={(e) => setSelectedUser({ ...selectedUser, medicalConditions: e.target.value })}
                        rows="3"
                        placeholder="None"
                      />
                    </div>

                    <div className="edit-form-field">
                      <label className="edit-form-label">Allergies</label>
                      <textarea
                        className="edit-form-textarea"
                        value={selectedUser.allergies || ''}
                        onChange={(e) => setSelectedUser({ ...selectedUser, allergies: e.target.value })}
                        rows="3"
                        placeholder="None"
                      />
                    </div>

                    <div className="edit-form-field">
                      <label className="edit-form-label">Donor Status</label>
                      <input
                        type="text"
                        className="edit-form-input"
                        value={selectedUser.donorStatus || 'New Donor'}
                        readOnly
                        disabled
                      />
                      <small className="text-gray-500 text-sm mt-1">
                        Auto-calculated from donations
                      </small>
                    </div>

                    <div className="edit-form-field">
                      <label className="edit-form-label">Total Donations</label>
                      <input
                        type="number"
                        className="edit-form-input"
                        value={selectedUser.donationCount || 0}
                        readOnly
                        disabled
                      />
                      <small className="text-gray-500 text-sm mt-1">
                        Calculated from donations records
                      </small>
                    </div>
                  </div>
                </div>

                <div className="modal-actions">
                  <button onClick={handleCloseEditModal} className="cancel-btn">
                    Cancel
                  </button>
                  <button onClick={handleSaveEditUser} className="save-btn">
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------- Add Modal ---------- */}
        {showAddModal && (
          <div className="modal-overlay">
            <div className="modal-container">
              <div className="modal-header">
                <h2 className="modal-title">Add New Member</h2>
                <button onClick={() => setShowAddModal(false)} className="modal-close-btn">
                  <X className="modal-close-icon" />
                </button>
              </div>

              <div className="modal-content">
                <div className="edit-form-grid">
                  {/* Personal Information */}
                  <div className="edit-form-section">
                    <h3 className="edit-modal-section-title">Personal Information</h3>

                    <div className="edit-form-field">
                      <label className="edit-form-label">Email *</label>
                      <input
                        type="email"
                        className="edit-form-input"
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        placeholder="Email will be used for login"
                        required
                      />
                    </div>

                    <div className="edit-form-field">
                      <label className="edit-form-label">Full Name *</label>
                      <input
                        type="text"
                        className="edit-form-input"
                        value={newUser.fullName}
                        onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                        placeholder="Enter full name"
                        required
                      />
                    </div>

                    <div className="edit-form-field">
                      <label className="edit-form-label">ID Type *</label>
                      <select
                        className="edit-form-select"
                        value={newUser.idType}
                        onChange={(e) => setNewUser({ ...newUser, idType: e.target.value })}
                      >
                        <option value="IC Number">IC Number</option>
                        <option value="Passport">Passport</option>
                      </select>
                    </div>

                    <div className="edit-form-field">
                      <label className="edit-form-label">ID Number *</label>
                      <input
                        type="text"
                        className="edit-form-input"
                        value={newUser.idNumber}
                        onChange={(e) => setNewUser({ ...newUser, idNumber: e.target.value })}
                        placeholder="Enter IC or passport number"
                        required
                      />
                    </div>

                    <div className="edit-form-field">
                      <label className="edit-form-label">Gender *</label>
                      <select
                        className="edit-form-select"
                        value={newUser.gender}
                        onChange={(e) => setNewUser({ ...newUser, gender: e.target.value })}
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>

                    <div className="edit-form-field">
                      <label className="edit-form-label">Date of Birth *</label>
                      <input
                        type="date"
                        className="edit-form-input"
                        value={newUser.birthDate}
                        onChange={(e) => setNewUser({ ...newUser, birthDate: e.target.value })}
                        required
                      />
                    </div>

                    <div className="edit-form-field">
                      <label className="edit-form-label">Phone Number *</label>
                      <input
                        type="tel"
                        className="edit-form-input"
                        value={newUser.phoneNumber}
                        onChange={(e) => setNewUser({ ...newUser, phoneNumber: e.target.value })}
                        placeholder="Enter phone number"
                        required
                      />
                    </div>

                    <div className="edit-form-field">
                      <label className="edit-form-label">Address *</label>
                      <textarea
                        className="edit-form-textarea"
                        value={newUser.address}
                        onChange={(e) => setNewUser({ ...newUser, address: e.target.value })}
                        placeholder="Enter address"
                        rows="3"
                        required
                      />
                    </div>

                    <div className="edit-form-field">
                      <label className="edit-form-label">State *</label>
                      <input
                        type="text"
                        className="edit-form-input"
                        value={newUser.state}
                        onChange={(e) => setNewUser({ ...newUser, state: e.target.value })}
                        placeholder="Enter state"
                        required
                      />
                    </div>

                    <div className="edit-form-field">
                      <label className="edit-form-label">Postcode *</label>
                      <input
                        type="text"
                        className="edit-form-input"
                        value={newUser.postcode}
                        onChange={(e) => setNewUser({ ...newUser, postcode: e.target.value })}
                        placeholder="Enter postcode"
                        required
                      />
                    </div>

                    <div className="edit-form-field">
                      <label className="edit-form-label">Blood Bank ID</label>
                      <input
                        type="text"
                        className="edit-form-input"
                        value={newUser.bloodBankId}
                        onChange={(e) => setNewUser({ ...newUser, bloodBankId: e.target.value })}
                        placeholder="e.g., 906-890 (optional)"
                      />
                    </div>
                  </div>

                  {/* Medical Information */}
                  <div className="edit-form-section">
                    <h3 className="edit-modal-section-title">Medical Information</h3>

                    <div className="edit-form-field">
                      <label className="edit-form-label">Blood Group *</label>
                      <select
                        className="edit-form-select"
                        value={newUser.bloodGroup}
                        onChange={(e) => setNewUser({ ...newUser, bloodGroup: e.target.value })}
                      >
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

                    <div className="edit-form-field">
                      <label className="edit-form-label">Rhesus *</label>
                      <select
                        className="edit-form-select"
                        value={newUser.rhesus}
                        onChange={(e) => setNewUser({ ...newUser, rhesus: e.target.value })}
                      >
                        <option value="Rh-positive">Rh-positive</option>
                        <option value="Rh-negative">Rh-negative</option>
                      </select>
                    </div>

                    <div className="edit-form-field">
                      <label className="edit-form-label">Height (cm) *</label>
                      <input
                        type="number"
                        className="edit-form-input"
                        value={newUser.height}
                        onChange={(e) => setNewUser({ ...newUser, height: e.target.value })}
                        placeholder="Enter height"
                        required
                      />
                    </div>

                    <div className="edit-form-field">
                      <label className="edit-form-label">Weight (kg) *</label>
                      <input
                        type="number"
                        className="edit-form-input"
                        value={newUser.weight}
                        onChange={(e) => setNewUser({ ...newUser, weight: e.target.value })}
                        placeholder="Enter weight"
                        required
                      />
                    </div>

                    <div className="edit-form-field">
                      <label className="edit-form-label">Medical Conditions</label>
                      <textarea
                        className="edit-form-textarea"
                        value={newUser.medicalConditions}
                        onChange={(e) => setNewUser({ ...newUser, medicalConditions: e.target.value })}
                        placeholder="Enter medical conditions or 'None'"
                        rows="3"
                      />
                    </div>

                    <div className="edit-form-field">
                      <label className="edit-form-label">Allergies</label>
                      <textarea
                        className="edit-form-textarea"
                        value={newUser.allergies}
                        onChange={(e) => setNewUser({ ...newUser, allergies: e.target.value })}
                        placeholder="Enter allergies or 'None'"
                        rows="3"
                      />
                    </div>
                  </div>
                </div>

                <div className="modal-actions">
                  <button onClick={() => setShowAddModal(false)} className="cancel-btn">
                    Cancel
                  </button>
                  <button onClick={handleSaveNewUser} className="save-btn">
                    Add Member
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------- Password Display Modal ---------- */}
        {showPasswordModal && (
          <div className="modal-overlay">
            <div className="delete-confirm-modal">
              <div className="delete-icon-container">
                <AlertCircle className="delete-icon" />
              </div>
              <h3 className="delete-title">User Created Successfully!</h3>
              <div className="password-display">
                <p className="password-label">Temporary Password:</p>
                <div className="password-value">{tempPassword}</div>
                <p className="password-warning">
                  Share this password with the user. They should change it on first login.
                </p>
              </div>
              <div className="delete-actions">
                <button onClick={() => {
                  setShowPasswordModal(false);
                  setTempPassword('');
                }} className="save-btn">
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---------- Delete Confirmation ---------- */}
        {showDeleteConfirm && (
          <div className="modal-overlay">
            <div className="delete-confirm-modal">
              <div className="delete-icon-container">
                <AlertCircle className="delete-icon" />
              </div>
              <h3 className="delete-title">Delete User</h3>
              <p className="delete-message">
                Are you sure you want to delete this user? This action cannot be undone.
              </p>
              <div className="delete-actions">
                <button onClick={() => setShowDeleteConfirm(false)} className="cancel-btn">
                  Cancel
                </button>
                <button onClick={handleDeleteConfirm} className="delete-btn">
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default UserManagement;