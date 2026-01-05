import React, { useState, useEffect } from 'react';
import { Search, Upload, Edit2, Trash2, AlertCircle, X, ChevronLeft, ChevronRight } from 'lucide-react';
import Layout from '../../components/Layout';
import './CommunityManagement.css';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot,
  query,
  where,
  Timestamp,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import { db } from '../../firebase'; // Adjust path to your Firebase config
import { getAuth } from 'firebase/auth';

const CommunityManagement = ({ onNavigate }) => {
  const [groups, setGroups] = useState([]);
  const [contents, setContents] = useState([]);
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // Edit and Delete states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editType, setEditType] = useState(''); // 'group', 'content', or 'banner'
  const [selectedItem, setSelectedItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  
  // Pagination states
  const [groupsPage, setGroupsPage] = useState(1);
  const [contentsPage, setContentsPage] = useState(1);
  const [bannersPage, setBannersPage] = useState(1);
  const itemsPerPage = 5;

  // Form state for announcement (removed image field)
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
    date: '',
  });

  // Search and Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [filteredContents, setFilteredContents] = useState([]);
  const [filteredBanners, setFilteredBanners] = useState([]);

  // Firebase auth
  const auth = getAuth();
  const currentUser = auth.currentUser;

  // Format timestamp to display date
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    
    try {
      if (timestamp instanceof Timestamp) {
        const date = timestamp.toDate();
        return date.toLocaleDateString('en-GB', { 
          day: 'numeric', 
          month: 'short', 
          year: 'numeric' 
        });
      } else if (typeof timestamp === 'string') {
        return timestamp;
      } else if (timestamp.seconds) {
        const date = new Date(timestamp.seconds * 1000);
        return date.toLocaleDateString('en-GB', { 
          day: 'numeric', 
          month: 'short', 
          year: 'numeric' 
        });
      }
      return '';
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  };

  // Map Firebase status to UI status
  const mapStatusToUI = (status, type) => {
    if (!status) return type === 'group' ? 'In Break' : 'In Review';
    
    const statusLower = status.toLowerCase().trim();
    
    if (type === 'group') {
      switch(statusLower) {
        case 'active': return 'Active';
        case 'inactive': return 'In Break';
        case 'disbanded': return 'Disband';
        default: return status;
      }
    } else if (type === 'content' || type === 'banner') {
      switch(statusLower) {
        case 'approved': return 'Published';
        case 'pending': return 'In Review';
        case 'rejected': return 'Rejected';
        default: return status;
      }
    }
    return status;
  };

  // Map UI status to Firebase status
  const mapStatusToFirebase = (uiStatus, type) => {
    if (!uiStatus) return type === 'group' ? 'inactive' : 'pending';
    
    const uiStatusLower = uiStatus.toLowerCase().trim();
    
    if (type === 'group') {
      switch(uiStatusLower) {
        case 'active': return 'active';
        case 'in break': return 'inactive';
        case 'disband': return 'disbanded';
        default: return uiStatusLower;
      }
    } else if (type === 'content' || type === 'banner') {
      switch(uiStatusLower) {
        case 'published': return 'approved';
        case 'in review': return 'pending';
        case 'rejected': return 'rejected';
        default: return uiStatusLower;
      }
    }
    return uiStatusLower;
  };

  // Get document ID (first 5 chars)
  const getDisplayId = (docId) => {
    if (!docId) return '00000';
    return docId.substring(0, 5).toUpperCase().padEnd(5, '0');
  };

  // Function to send notification when status changes - FIXED VERSION
  const sendStatusChangeNotification = async (item, editType, oldStatus, newStatus) => {
    try {
      console.log('=== STARTING NOTIFICATION PROCESS ===');
      console.log('Item:', item);
      console.log('Edit Type:', editType);
      console.log('Old Status:', oldStatus);
      console.log('New Status:', newStatus);
      
      // Map Firebase status to readable format
      const getReadableStatus = (status, type) => {
        if (!status) return 'Unknown';
        
        if (type === 'group') {
          const statusMap = {
            'active': 'Active',
            'inactive': 'In Break',
            'disbanded': 'Disbanded'
          };
          return statusMap[status.toLowerCase()] || status;
        } else {
          const statusMap = {
            'approved': 'Published',
            'pending': 'In Review',
            'rejected': 'Rejected'
          };
          return statusMap[status.toLowerCase()] || status;
        }
      };

      let title = '';
      let message = '';
      let userId = '';
      let notificationType = '';
      let targetId = '';
      let itemName = '';

      if (editType === 'group') {
        title = 'Group Status Updated';
        itemName = item.groupName || 'Your group';
        message = `Your group "${itemName}" status changed from ${getReadableStatus(oldStatus, 'group')} to ${getReadableStatus(newStatus, 'group')}`;
        userId = item.createdById || item.ownerId || item.userId || '';
        notificationType = 'GROUP_STATUS_UPDATE';
        targetId = item.id;
      } else if (editType === 'content') {
        title = 'Story Status Updated';
        itemName = item.contentName?.split(': ')[0] || 'Your story';
        message = `Your story "${itemName}" status changed from ${getReadableStatus(oldStatus, 'content')} to ${getReadableStatus(newStatus, 'content')}`;
        userId = item.userId || item.authorId || item.createdById || item.ownerId || '';
        notificationType = 'CONTENT_STATUS_UPDATE';
        targetId = item.id;
      } else if (editType === 'banner') {
        title = 'Banner Status Updated';
        itemName = item.bannerTitle || 'Your banner';
        message = `Your banner "${itemName}" status changed from ${getReadableStatus(oldStatus, 'banner')} to ${getReadableStatus(newStatus, 'banner')}`;
        userId = item.createdById || item.ownerId || item.userId || '';
        notificationType = 'BANNER_STATUS_UPDATE';
        targetId = item.id;
      }

      console.log('Notification Details:', {
        title,
        message,
        userId,
        notificationType,
        targetId,
        itemName
      });

      // Only send notification if status actually changed and we have a user ID
      const statusChanged = oldStatus !== newStatus;
      const hasUserId = !!userId;
      
      console.log('Validation:', {
        statusChanged,
        hasUserId,
        oldStatus,
        newStatus,
        userId
      });

      if (statusChanged && hasUserId) {
        // Create notification in Firestore - your mobile app can listen to this
        const notificationId = `${targetId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const notificationData = {
          id: notificationId,
          userId: userId,
          title: title,
          message: message,
          type: notificationType,
          targetId: targetId,
          data: {
            oldStatus: oldStatus,
            newStatus: newStatus,
            itemName: itemName,
            itemType: editType,
            timestamp: new Date().toISOString()
          },
          isRead: false,
          createdAt: serverTimestamp(),
          createdBy: currentUser?.uid || 'admin',
          createdByName: currentUser?.displayName || 'Admin',
          status: 'unread'
        };

        console.log('Creating notification with data:', notificationData);

        try {
          // Add to global notifications collection
          await addDoc(collection(db, 'notifications'), notificationData);
          console.log('✅ Notification added to global collection');
          
          // Also add to user's personal notifications subcollection
          try {
            const userNotificationRef = doc(db, 'users', userId, 'notifications', notificationId);
            await setDoc(userNotificationRef, notificationData);
            console.log(`✅ Notification added to user ${userId}'s collection`);
          } catch (userNotificationError) {
            console.error('⚠️ Error adding to user notifications subcollection:', userNotificationError);
            // Try alternative path
            try {
              const altUserNotificationRef = doc(db, 'userNotifications', notificationId);
              await setDoc(altUserNotificationRef, {
                ...notificationData,
                userId: userId
              });
              console.log(`✅ Notification added to alternative collection`);
            } catch (altError) {
              console.error('⚠️ Alternative path also failed:', altError);
            }
          }
          
          console.log(`✅ Notification sent successfully to user ${userId}`);
          return true;
        } catch (firestoreError) {
          console.error('❌ Firestore error:', firestoreError);
          return false;
        }
      } else {
        console.log('⚠️ Notification not sent:', { 
          reason: !statusChanged ? 'Status unchanged' : 'No user ID',
          statusChanged, 
          hasUserId
        });
        return false;
      }
    } catch (error) {
      console.error('❌ Error in sendStatusChangeNotification:', error);
      return false;
    }
  };

  // Load data from Firebase with debugging
  useEffect(() => {
    setLoading(true);
    console.log('=== LOADING DATA FROM FIREBASE ===');

    // Subscribe to teams collection
    const teamsUnsubscribe = onSnapshot(
      collection(db, 'teams'),
      (snapshot) => {
        const teamsData = snapshot.docs.map(doc => {
          const data = doc.data();
          console.log('Team data loaded:', { 
            id: doc.id, 
            name: data.name,
            status: data.status,
            createdById: data.createdById,
            ownerId: data.ownerId,
            userId: data.userId,
            fullData: data
          });
          return {
            id: doc.id,
            displayId: getDisplayId(doc.id),
            groupName: data.name || '',
            members: data.memberCount || 0,
            status: mapStatusToUI(data.status, 'group'),
            rawStatus: data.status || '',
            description: data.description || '',
            imageUrl: data.imageUrl || '',
            createdAt: data.createdAt,
            createdBy: data.createdBy || '',
            createdById: data.createdById || data.ownerId || data.userId || data.creatorId || '',
            ownerId: data.ownerId || '',
            userId: data.userId || ''
          };
        });
        console.log('Total teams loaded:', teamsData.length);
        setGroups(teamsData);
      },
      (error) => {
        console.error('Error loading teams:', error);
        setError('Failed to load groups data');
      }
    );

    // Subscribe to stories collection
    const storiesUnsubscribe = onSnapshot(
      collection(db, 'stories'),
      (snapshot) => {
        const storiesData = snapshot.docs.map(doc => {
          const data = doc.data();
          console.log('Story data loaded:', { 
            id: doc.id, 
            title: data.title,
            status: data.status,
            userId: data.userId,
            authorId: data.authorId,
            createdById: data.createdById,
            fullData: data
          });
          return {
            id: doc.id,
            displayId: getDisplayId(doc.id),
            contentName: `${data.title || ''}: ${data.description || ''}`,
            date: formatDate(data.createdAt),
            status: mapStatusToUI(data.status, 'content'),
            rawStatus: data.status || '',
            title: data.title || '',
            description: data.description || '',
            fullStory: data.fullStory || '',
            imagePath: data.imagePath || '',
            author: data.author || '',
            category: data.category || '',
            comments: data.comments || 0,
            likes: data.likes || 0,
            isAnonymous: data.isAnonymous || false,
            userId: data.userId || data.authorId || data.createdById || data.creatorId || '',
            authorId: data.authorId || '',
            createdById: data.createdById || '',
            createdAt: data.createdAt
          };
        });
        console.log('Total stories loaded:', storiesData.length);
        setContents(storiesData);
      },
      (error) => {
        console.error('Error loading stories:', error);
        setError('Failed to load content data');
      }
    );

    // Subscribe to banners collection
    const bannersUnsubscribe = onSnapshot(
      collection(db, 'banners'),
      (snapshot) => {
        const bannersData = snapshot.docs.map(doc => {
          const data = doc.data();
          console.log('Banner data loaded:', { 
            id: doc.id, 
            title: data.title,
            status: data.status,
            createdById: data.createdById,
            ownerId: data.ownerId,
            userId: data.userId,
            fullData: data
          });
          return {
            id: doc.id,
            displayId: getDisplayId(doc.id),
            bannerTitle: data.title || '',
            date: data.date || formatDate(data.createdAt),
            status: mapStatusToUI(data.status, 'banner'),
            rawStatus: data.status || '',
            content: data.content || '',
            imageUrl: data.imageUrl || '',
            createdAt: data.createdAt,
            createdBy: data.createdBy || '',
            createdById: data.createdById || data.ownerId || data.userId || data.creatorId || '',
            ownerId: data.ownerId || '',
            userId: data.userId || ''
          };
        });
        console.log('Total banners loaded:', bannersData.length);
        setBanners(bannersData);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading banners:', error);
        setError('Failed to load banners data');
        setLoading(false);
      }
    );

    // Cleanup subscriptions
    return () => {
      teamsUnsubscribe();
      storiesUnsubscribe();
      bannersUnsubscribe();
    };
  }, []);

  // Filter data
  useEffect(() => {
    let filteredGroupsData = [...groups];
    let filteredContentsData = [...contents];
    let filteredBannersData = [...banners];

    // Apply search
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filteredGroupsData = filteredGroupsData.filter(item =>
        item.displayId.toLowerCase().includes(searchLower) ||
        item.groupName.toLowerCase().includes(searchLower)
      );
      filteredContentsData = filteredContentsData.filter(item =>
        item.displayId.toLowerCase().includes(searchLower) ||
        item.contentName.toLowerCase().includes(searchLower) ||
        item.date.toLowerCase().includes(searchLower)
      );
      filteredBannersData = filteredBannersData.filter(item =>
        item.displayId.toLowerCase().includes(searchLower) ||
        item.bannerTitle.toLowerCase().includes(searchLower) ||
        item.date.toLowerCase().includes(searchLower)
      );
    }

    // Apply status filter
    if (statusFilter !== 'All') {
      filteredGroupsData = filteredGroupsData.filter(item => item.status === statusFilter);
      filteredContentsData = filteredContentsData.filter(item => item.status === statusFilter);
      filteredBannersData = filteredBannersData.filter(item => item.status === statusFilter);
    }

    // Apply type filter
    if (typeFilter !== 'All') {
      if (typeFilter === 'Groups') {
        filteredContentsData = [];
        filteredBannersData = [];
      } else if (typeFilter === 'Content') {
        filteredGroupsData = [];
        filteredBannersData = [];
      } else if (typeFilter === 'Banner') {
        filteredGroupsData = [];
        filteredContentsData = [];
      }
    }

    setFilteredGroups(filteredGroupsData);
    setFilteredContents(filteredContentsData);
    setFilteredBanners(filteredBannersData);
    setGroupsPage(1);
    setContentsPage(1);
    setBannersPage(1);
  }, [searchTerm, statusFilter, typeFilter, groups, contents, banners]);

  const getStatusClass = (status) => {
    switch (status) {
      case 'Active':
      case 'Published':
        return 'status-active';
      case 'In Break':
      case 'In Review':
        return 'status-review';
      case 'Disband':
      case 'Rejected':
        return 'status-rejected';
      default:
        return '';
    }
  };

  // Pagination helper function
  const paginate = (items, page) => {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  };

  // Calculate total pages
  const totalGroupsPages = Math.ceil(filteredGroups.length / itemsPerPage);
  const totalContentsPages = Math.ceil(filteredContents.length / itemsPerPage);
  const totalBannersPages = Math.ceil(filteredBanners.length / itemsPerPage);

  // Get paginated data
  const paginatedGroups = paginate(filteredGroups, groupsPage);
  const paginatedContents = paginate(filteredContents, contentsPage);
  const paginatedBanners = paginate(filteredBanners, bannersPage);

  // Pagination component
  const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    return (
      <div className="pagination-container">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="pagination-button"
        >
          <ChevronLeft className="pagination-icon" />
          Previous
        </button>
        <div className="pagination-info">
          <span className="pagination-text">
            Page {currentPage} of {totalPages}
          </span>
        </div>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="pagination-button"
        >
          Next
          <ChevronRight className="pagination-icon" />
        </button>
      </div>
    );
  };

  // Handle Edit
  const handleEdit = (item, type) => {
    console.log('Editing item:', { item, type });
    setSelectedItem(item);
    setEditType(type);
    setShowEditModal(true);
  };

  // Handle Delete Click
  const handleDeleteClick = (item, type) => {
    setDeletingItem({ ...item, type });
    setShowDeleteConfirm(true);
  };

  // Handle Delete Confirm
  const handleDeleteConfirm = async () => {
    try {
      if (deletingItem.type === 'group') {
        await deleteDoc(doc(db, 'teams', deletingItem.id));
      } else if (deletingItem.type === 'content') {
        await deleteDoc(doc(db, 'stories', deletingItem.id));
      } else if (deletingItem.type === 'banner') {
        await deleteDoc(doc(db, 'banners', deletingItem.id));
      }
      setShowDeleteConfirm(false);
      setDeletingItem(null);
      setError(`${deletingItem.type.charAt(0).toUpperCase() + deletingItem.type.slice(1)} deleted successfully.`);
      setTimeout(() => setError(''), 3000);
    } catch (error) {
      console.error('Error deleting item:', error);
      setError(`Failed to delete ${deletingItem.type}: ${error.message}`);
    }
  };

  // Handle Save Edit - FIXED VERSION WITH DEBUGGING
  const handleSaveEdit = async () => {
    try {
      if (!selectedItem) {
        console.error('No selected item');
        setError('No item selected for editing');
        return;
      }
      
      console.log('=== STARTING SAVE EDIT PROCESS ===');
      console.log('Selected Item:', selectedItem);
      console.log('Edit Type:', editType);
      
      const oldStatus = selectedItem.rawStatus || '';
      // Get the new status from the UI selection and convert to Firebase format
      const newStatus = mapStatusToFirebase(selectedItem.status, editType);
      
      console.log('Status Comparison:', {
        oldStatus,
        newStatus,
        uiStatus: selectedItem.status,
        statusChanged: oldStatus !== newStatus
      });
      
      // Update the item in Firestore
      if (editType === 'group') {
        const teamRef = doc(db, 'teams', selectedItem.id);
        console.log('Updating group:', selectedItem.id, 'with status:', newStatus);
        await updateDoc(teamRef, {
          name: selectedItem.groupName || '',
          memberCount: selectedItem.members || 0,
          status: newStatus,
          lastUpdated: serverTimestamp(),
          lastUpdatedBy: currentUser?.uid || '',
          statusChangedAt: serverTimestamp(),
          previousStatus: oldStatus
        });
        console.log('✅ Group updated successfully');
      } else if (editType === 'content') {
        const storyRef = doc(db, 'stories', selectedItem.id);
        // Extract title and description from contentName format
        const contentParts = selectedItem.contentName?.split(': ') || ['', ''];
        const title = contentParts[0] || '';
        const description = contentParts.slice(1).join(': ') || '';
        
        console.log('Updating content:', selectedItem.id, 'with status:', newStatus);
        await updateDoc(storyRef, {
          title: title,
          description: description,
          status: newStatus,
          lastUpdated: serverTimestamp(),
          lastUpdatedBy: currentUser?.uid || '',
          statusChangedAt: serverTimestamp(),
          previousStatus: oldStatus
        });
        console.log('✅ Content updated successfully');
      } else if (editType === 'banner') {
        const bannerRef = doc(db, 'banners', selectedItem.id);
        console.log('Updating banner:', selectedItem.id, 'with status:', newStatus);
        await updateDoc(bannerRef, {
          title: selectedItem.bannerTitle || '',
          status: newStatus,
          lastUpdated: serverTimestamp(),
          lastUpdatedBy: currentUser?.uid || '',
          statusChangedAt: serverTimestamp(),
          previousStatus: oldStatus
        });
        console.log('✅ Banner updated successfully');
      }
      
      // Send notification to the user about status change
      console.log('=== ATTEMPTING TO SEND NOTIFICATION ===');
      const notificationSent = await sendStatusChangeNotification(
        selectedItem,
        editType,
        oldStatus,
        newStatus
      );
      
      console.log('Notification sent result:', notificationSent);
      
      // Close modal and reset state
      setShowEditModal(false);
      setSelectedItem(null);
      setEditType('');
      
      if (notificationSent) {
        setError(`${editType.charAt(0).toUpperCase() + editType.slice(1)} updated successfully. ✅ Notification sent to user.`);
      } else {
        setError(`${editType.charAt(0).toUpperCase() + editType.slice(1)} updated successfully. ⚠️ No notification sent (check console for details).`);
      }
      
      // Clear error after 3 seconds
      setTimeout(() => setError(''), 3000);
      
    } catch (error) {
      console.error('❌ Error updating item:', error);
      setError(`Failed to update ${editType}: ${error.message}`);
    }
  };

  // Handle Announcement Form Input
  const handleAnnouncementInputChange = (e) => {
    const { name, value } = e.target;
    setAnnouncementForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle Announcement Submission
  const handleAnnouncementSubmit = async () => {
    if (!announcementForm.title || !announcementForm.date) {
      setError('Please fill in all required fields (Title and Date)');
      return;
    }

    try {
      // Format date to match display format
      const formattedDate = new Date(announcementForm.date).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });

      const newBanner = {
        title: announcementForm.title,
        content: announcementForm.content || '',
        status: 'pending', // Default to pending review
        date: formattedDate,
        createdAt: serverTimestamp(),
        createdBy: currentUser?.displayName || 'Admin',
        createdById: currentUser?.uid || 'admin'
      };

      await addDoc(collection(db, 'banners'), newBanner);
      
      // Reset form and close modal
      setAnnouncementForm({ title: '', content: '', date: '' });
      setShowUploadModal(false);
      setError('Announcement created successfully and is pending review.');
      setTimeout(() => setError(''), 3000);
    } catch (error) {
      console.error('Error creating announcement:', error);
      setError(`Failed to create announcement: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <Layout onNavigate={onNavigate} currentPage="community-management">
        <div className="loading-container">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <p className="loading-text">Loading community management...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout onNavigate={onNavigate} currentPage="community-management">
      <div className="space-y-6">
        {/* Header */}
        <div className="community-header-container">
          <h1 className="community-header-title">Community Management</h1>
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

        {/* Upload Announcement Button */}
        <div className="upload-announcement-container">
          <button 
            className="upload-announcement-button"
            onClick={() => setShowUploadModal(true)}
          >
            <Upload className="upload-icon" />
            Upload Announcement
          </button>
        </div>

        {/* Search and Filters */}
        <div className="community-filters-container">
          <div className="community-filters-grid">
            <div className="community-search-container">
              <label className="community-filter-label">Search Community</label>
              <div className="community-search-input-container">
                <Search className="community-search-icon" />
                <input
                  type="text"
                  placeholder="Search by ID, name, or date..."
                  className="community-search-input"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="community-filter-select-container">
              <label className="community-filter-label">Status</label>
              <select
                className="community-filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="In Break">In Break</option>
                <option value="Disband">Disband</option>
                <option value="Published">Published</option>
                <option value="In Review">In Review</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            <div className="community-filter-select-container">
              <label className="community-filter-label">Type</label>
              <select
                className="community-filter-select"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="All">All Types</option>
                <option value="Groups">Groups</option>
                <option value="Content">Content</option>
                <option value="Banner">Banner</option>
              </select>
            </div>
          </div>
        </div>

        {/* Groups Table */}
        <div className="community-section">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Groups Overview</h2>
          <div className="community-table-container">
            <div className="community-table-wrapper">
              <table className="community-table">
                <thead className="community-table-header">
                  <tr>
                    <th className="community-table-header-cell">ID</th>
                    <th className="community-table-header-cell">GROUP NAME</th>
                    <th className="community-table-header-cell">MEMBERS</th>
                    <th className="community-table-header-cell">STATUS</th>
                    <th className="community-table-header-cell">ACTION</th>
                  </tr>
                </thead>
                <tbody className="community-table-body">
                  {paginatedGroups.map((group) => (
                    <tr key={group.id} className="community-table-row">
                      <td className="community-table-cell community-id-cell">
                        {group.displayId}
                      </td>
                      <td className="community-table-cell community-name-cell">
                        {group.groupName}
                      </td>
                      <td className="community-table-cell community-members-cell">
                        {group.members}
                      </td>
                      <td className="community-table-cell">
                        <span className={`status-badge ${getStatusClass(group.status)}`}>
                          {group.status}
                        </span>
                      </td>
                      <td className="community-table-cell community-action-cell">
                        <button 
                          className="action-button action-edit"
                          onClick={() => handleEdit(group, 'group')}
                        >
                          <Edit2 className="action-icon" />
                        </button>
                        <button 
                          className="action-button action-delete"
                          onClick={() => handleDeleteClick(group, 'group')}
                        >
                          <Trash2 className="action-icon" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredGroups.length === 0 && !loading && (
              <div className="community-empty-state">
                <div className="community-empty-state-icon">
                  <Search />
                </div>
                <h3 className="community-empty-state-title">No groups found</h3>
                <p className="community-empty-state-description">
                  Try adjusting your search filters
                </p>
              </div>
            )}
            <Pagination 
              currentPage={groupsPage}
              totalPages={totalGroupsPages}
              onPageChange={setGroupsPage}
            />
          </div>
        </div>

        {/* Content Table */}
        <div className="community-section">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Content Overview</h2>
          <div className="community-table-container">
            <div className="community-table-wrapper">
              <table className="community-table">
                <thead className="community-table-header">
                  <tr>
                    <th className="community-table-header-cell">ID</th>
                    <th className="community-table-header-cell">CONTENT NAME</th>
                    <th className="community-table-header-cell">DATE</th>
                    <th className="community-table-header-cell">STATUS</th>
                    <th className="community-table-header-cell">ACTION</th>
                  </tr>
                </thead>
                <tbody className="community-table-body">
                  {paginatedContents.map((content) => (
                    <tr key={content.id} className="community-table-row">
                      <td className="community-table-cell community-id-cell">
                        {content.displayId}
                      </td>
                      <td className="community-table-cell community-content-cell">
                        {content.contentName}
                      </td>
                      <td className="community-table-cell community-date-cell">
                        {content.date}
                      </td>
                      <td className="community-table-cell">
                        <span className={`status-badge ${getStatusClass(content.status)}`}>
                          {content.status}
                        </span>
                      </td>
                      <td className="community-table-cell community-action-cell">
                        <button 
                          className="action-button action-edit"
                          onClick={() => handleEdit(content, 'content')}
                        >
                          <Edit2 className="action-icon" />
                        </button>
                        <button 
                          className="action-button action-delete"
                          onClick={() => handleDeleteClick(content, 'content')}
                        >
                          <Trash2 className="action-icon" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredContents.length === 0 && !loading && (
              <div className="community-empty-state">
                <div className="community-empty-state-icon">
                  <Search />
                </div>
                <h3 className="community-empty-state-title">No content found</h3>
                <p className="community-empty-state-description">
                  Try adjusting your search filters
                </p>
              </div>
            )}
            <Pagination 
              currentPage={contentsPage}
              totalPages={totalContentsPages}
              onPageChange={setContentsPage}
            />
          </div>
        </div>

        {/* Banner Table */}
        <div className="community-section">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Banner Overview</h2>
          <div className="community-table-container">
            <div className="community-table-wrapper">
              <table className="community-table">
                <thead className="community-table-header">
                  <tr>
                    <th className="community-table-header-cell">ID</th>
                    <th className="community-table-header-cell">BANNER TITLE</th>
                    <th className="community-table-header-cell">DATE</th>
                    <th className="community-table-header-cell">STATUS</th>
                    <th className="community-table-header-cell">ACTION</th>
                  </tr>
                </thead>
                <tbody className="community-table-body">
                  {paginatedBanners.map((banner) => (
                    <tr key={banner.id} className="community-table-row">
                      <td className="community-table-cell community-id-cell">
                        {banner.displayId}
                      </td>
                      <td className="community-table-cell community-content-cell">
                        {banner.bannerTitle}
                      </td>
                      <td className="community-table-cell community-date-cell">
                        {banner.date}
                      </td>
                      <td className="community-table-cell">
                        <span className={`status-badge ${getStatusClass(banner.status)}`}>
                          {banner.status}
                        </span>
                      </td>
                      <td className="community-table-cell community-action-cell">
                        <button 
                          className="action-button action-edit"
                          onClick={() => handleEdit(banner, 'banner')}
                        >
                          <Edit2 className="action-icon" />
                        </button>
                        <button 
                          className="action-button action-delete"
                          onClick={() => handleDeleteClick(banner, 'banner')}
                        >
                          <Trash2 className="action-icon" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredBanners.length === 0 && !loading && (
              <div className="community-empty-state">
                <div className="community-empty-state-icon">
                  <Search />
                </div>
                <h3 className="community-empty-state-title">No banners found</h3>
                <p className="community-empty-state-description">
                  Try adjusting your search filters
                </p>
              </div>
            )}
            <Pagination 
              currentPage={bannersPage}
              totalPages={totalBannersPages}
              onPageChange={setBannersPage}
            />
          </div>
        </div>

        {/* Upload Announcement Modal */}
        {showUploadModal && (
          <div className="community-modal-overlay">
            <div className="community-modal-container">
              <div className="community-modal-header">
                <h2 className="community-modal-title">Upload Announcement</h2>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setAnnouncementForm({ title: '', content: '', date: '' });
                  }}
                  className="community-modal-close"
                >
                  <X className="community-modal-close-icon" />
                </button>
              </div>
              <div className="community-modal-body">
                <div className="community-modal-form">
                  <div className="community-form-group">
                    <label className="community-form-label">Announcement Title *</label>
                    <input
                      type="text"
                      name="title"
                      className="community-form-input"
                      placeholder="Enter announcement title"
                      value={announcementForm.title}
                      onChange={handleAnnouncementInputChange}
                      required
                    />
                  </div>
                  <div className="community-form-group">
                    <label className="community-form-label">Content</label>
                    <textarea
                      name="content"
                      className="community-form-textarea"
                      rows="5"
                      placeholder="Enter announcement content"
                      value={announcementForm.content}
                      onChange={handleAnnouncementInputChange}
                    ></textarea>
                  </div>
                  <div className="community-form-group">
                    <label className="community-form-label">Date *</label>
                    <input
                      type="date"
                      name="date"
                      className="community-form-input"
                      value={announcementForm.date}
                      onChange={handleAnnouncementInputChange}
                      required
                    />
                  </div>
                </div>
                <div className="community-modal-actions">
                  <button
                    onClick={() => {
                      setShowUploadModal(false);
                      setAnnouncementForm({ title: '', content: '', date: '' });
                    }}
                    className="community-modal-button community-cancel-button"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAnnouncementSubmit}
                    className="community-modal-button community-save-button"
                  >
                    Upload
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && selectedItem && (
          <div className="community-modal-overlay">
            <div className="community-modal-container">
              <div className="community-modal-header">
                <h2 className="community-modal-title">
                  Edit {editType === 'group' ? 'Group' : editType === 'content' ? 'Content' : 'Banner'}
                </h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedItem(null);
                    setEditType('');
                  }}
                  className="community-modal-close"
                >
                  <X className="community-modal-close-icon" />
                </button>
              </div>
              <div className="community-modal-body">
                <div className="community-modal-form">
                  <div className="community-form-group">
                    <label className="community-form-label">ID</label>
                    <input
                      type="text"
                      className="community-form-input"
                      value={selectedItem.displayId}
                      disabled
                    />
                  </div>

                  {editType === 'group' && (
                    <>
                      <div className="community-form-group">
                        <label className="community-form-label">Group Name</label>
                        <input
                          type="text"
                          className="community-form-input"
                          value={selectedItem.groupName}
                          onChange={(e) => setSelectedItem({...selectedItem, groupName: e.target.value})}
                        />
                      </div>
                      <div className="community-form-group">
                        <label className="community-form-label">Members</label>
                        <input
                          type="number"
                          className="community-form-input"
                          value={selectedItem.members}
                          onChange={(e) => setSelectedItem({...selectedItem, members: parseInt(e.target.value) || 0})}
                        />
                      </div>
                      <div className="community-form-group">
                        <label className="community-form-label">Status</label>
                        <select
                          className="community-form-select"
                          value={selectedItem.status}
                          onChange={(e) => setSelectedItem({...selectedItem, status: e.target.value})}
                        >
                          <option value="Active">Active</option>
                          <option value="In Break">In Break</option>
                          <option value="Disband">Disband</option>
                        </select>
                      </div>
                    </>
                  )}

                  {editType === 'content' && (
                    <>
                      <div className="community-form-group">
                        <label className="community-form-label">Content Name</label>
                        <textarea
                          className="community-form-textarea"
                          rows="4"
                          value={selectedItem.contentName}
                          onChange={(e) => setSelectedItem({...selectedItem, contentName: e.target.value})}
                        />
                      </div>
                      <div className="community-form-group">
                        <label className="community-form-label">Status</label>
                        <select
                          className="community-form-select"
                          value={selectedItem.status}
                          onChange={(e) => setSelectedItem({...selectedItem, status: e.target.value})}
                        >
                          <option value="Published">Published</option>
                          <option value="In Review">In Review</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      </div>
                    </>
                  )}

                  {editType === 'banner' && (
                    <>
                      <div className="community-form-group">
                        <label className="community-form-label">Banner Title</label>
                        <textarea
                          className="community-form-textarea"
                          rows="4"
                          value={selectedItem.bannerTitle}
                          onChange={(e) => setSelectedItem({...selectedItem, bannerTitle: e.target.value})}
                        />
                      </div>
                      <div className="community-form-group">
                        <label className="community-form-label">Status</label>
                        <select
                          className="community-form-select"
                          value={selectedItem.status}
                          onChange={(e) => setSelectedItem({...selectedItem, status: e.target.value})}
                        >
                          <option value="Published">Published</option>
                          <option value="In Review">In Review</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
                <div className="community-modal-actions">
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedItem(null);
                      setEditType('');
                    }}
                    className="community-modal-button community-cancel-button"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="community-modal-button community-save-button"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && deletingItem && (
          <div className="community-modal-overlay">
            <div className="community-confirm-modal">
              <div className="community-confirm-icon-container">
                <AlertCircle className="community-confirm-icon" />
              </div>
              <h3 className="community-confirm-title">
                Delete {deletingItem.type === 'group' ? 'Group' : deletingItem.type === 'content' ? 'Content' : 'Banner'}
              </h3>
              <p className="community-confirm-message">
                Are you sure you want to delete this {deletingItem.type}? This action cannot be undone.
              </p>
              <div className="community-confirm-actions">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletingItem(null);
                  }}
                  className="community-confirm-button community-confirm-cancel"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="community-confirm-button community-confirm-delete"
                >
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

export default CommunityManagement;