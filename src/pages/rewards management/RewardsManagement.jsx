import React, { useState, useEffect } from 'react';
import { Search, Edit, Trash2, Plus, ToggleLeft, ToggleRight, Gift, Percent, Package, X, AlertCircle, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import Layout from '../../components/Layout';
import './RewardsManagement.css';

// Import Firebase - UPDATE THIS PATH TO MATCH YOUR STRUCTURE
import { db } from '../../firebase'; // Adjust this path!
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  Timestamp, 
  query, 
  orderBy 
} from 'firebase/firestore';

const RewardsManagement = ({ onNavigate }) => {
    const [rewards, setRewards] = useState([]);
    const [filteredRewards, setFilteredRewards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [showAddEditModal, setShowAddEditModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [editingReward, setEditingReward] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(8);
    const [firebaseError, setFirebaseError] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        type: 'voucher',
        category: '',
        pointsRequired: '',
        discountValue: '',
        isActive: true,
        stock: '',
        expiryDate: '',
        maxClaimsPerUser: 1
    });

    // Firebase collection reference
    const rewardsCollectionRef = collection(db, 'rewards');

    // Calculate days remaining
    const calculateDaysRemaining = (expiryTimestamp) => {
        if (!expiryTimestamp) return null;
        
        const now = new Date();
        const expiryDate = expiryTimestamp.toDate();
        const diffTime = expiryDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays;
    };

    // Format date for input field (YYYY-MM-DD)
    const formatDateForInput = (timestamp) => {
        if (!timestamp) return '';
        return timestamp.toDate().toISOString().split('T')[0];
    };

    // Fetch rewards with real-time updates
    useEffect(() => {
        setLoading(true);
        
        try {
            console.log("🔍 Connecting to Firestore...");
            console.log("Database object:", db);
            console.log("Collection ref:", rewardsCollectionRef);
            
            // Create query with ordering
            const rewardsQuery = query(rewardsCollectionRef, orderBy('createdAt', 'desc'));
            
            // Set up real-time listener
            const unsubscribe = onSnapshot(rewardsQuery, 
                (snapshot) => {
                    console.log("✅ Firestore data received!");
                    const rewardsList = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                        createdAt: doc.data().createdAt,
                        updatedAt: doc.data().updatedAt,
                        expiryDate: doc.data().expiryDate
                    }));
                    
                    console.log("Rewards loaded:", rewardsList.length);
                    setRewards(rewardsList);
                    setFilteredRewards(rewardsList);
                    setLoading(false);
                    setFirebaseError(null);
                },
                (error) => {
                    console.error("❌ Firestore error:", error);
                    console.error("Error code:", error.code);
                    console.error("Error message:", error.message);
                    setFirebaseError(error.message);
                    setLoading(false);
                }
            );

            // Cleanup listener on unmount
            return () => unsubscribe();
        } catch (error) {
            console.error("❌ Setup error:", error);
            setFirebaseError(error.message);
            setLoading(false);
        }
    }, []);

    // Filter rewards based on search and filters
    useEffect(() => {
        let filtered = [...rewards];

        if (typeFilter !== 'All') {
            filtered = filtered.filter(r => r.type === typeFilter);
        }

        if (statusFilter !== 'All') {
            const active = statusFilter === 'Active';
            filtered = filtered.filter(r => r.isActive === active);
        }

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            filtered = filtered.filter(r =>
                r.name.toLowerCase().includes(lower) ||
                r.category.toLowerCase().includes(lower)
            );
        }

        setFilteredRewards(filtered);
        setCurrentPage(1);
    }, [searchTerm, typeFilter, statusFilter, rewards]);

    const handleAddNew = () => {
        setEditingReward(null);
        setFormData({
            name: '',
            description: '',
            type: 'voucher',
            category: '',
            pointsRequired: '',
            discountValue: '',
            isActive: true,
            stock: '',
            expiryDate: '',
            maxClaimsPerUser: 1
        });
        setShowAddEditModal(true);
    };

    const handleEdit = (reward) => {
        setEditingReward(reward);
        setFormData({
            name: reward.name,
            description: reward.description || '',
            type: reward.type,
            category: reward.category,
            pointsRequired: reward.pointsRequired,
            discountValue: reward.discountValue || '',
            isActive: reward.isActive,
            stock: reward.stock || '',
            expiryDate: reward.expiryDate ? formatDateForInput(reward.expiryDate) : '',
            maxClaimsPerUser: reward.maxClaimsPerUser || 1
        });
        setShowAddEditModal(true);
    };

    const handleSave = async () => {
        try {
            console.log("💾 Saving reward to Firestore...");
            
            const rewardData = {
                name: formData.name,
                description: formData.description,
                type: formData.type,
                category: formData.category,
                pointsRequired: Number(formData.pointsRequired),
                isActive: formData.isActive,
                maxClaimsPerUser: Number(formData.maxClaimsPerUser),
                updatedAt: Timestamp.now(),
                claimCount: editingReward ? editingReward.claimCount || 0 : 0
            };

            // Add type-specific fields
            if (formData.type === 'voucher') {
                rewardData.discountValue = Number(formData.discountValue);
                // Don't set stock for vouchers
            } else {
                rewardData.stock = formData.stock ? Number(formData.stock) : 0;
                // Don't set discountValue for products
            }

            // Add expiry date if provided
            if (formData.expiryDate) {
                rewardData.expiryDate = Timestamp.fromDate(new Date(formData.expiryDate));
            } else {
                rewardData.expiryDate = null;
            }

            if (editingReward) {
                console.log("Updating existing reward:", editingReward.id);
                const rewardDoc = doc(db, 'rewards', editingReward.id);
                await updateDoc(rewardDoc, rewardData);
                console.log("✅ Reward updated successfully!");
            } else {
                console.log("Adding new reward...");
                rewardData.createdAt = Timestamp.now();
                const docRef = await addDoc(rewardsCollectionRef, rewardData);
                console.log("✅ Reward added with ID:", docRef.id);
            }

            setShowAddEditModal(false);
        } catch (error) {
            console.error("❌ Error saving reward:", error);
            alert(`Failed to save reward: ${error.message}\n\nMake sure Firestore is enabled in Firebase Console.`);
        }
    };

    const handleDeleteClick = (id) => {
        setDeletingId(id);
        setShowDeleteConfirm(true);
    };

    const handleDeleteConfirm = async () => {
        try {
            console.log("Deleting reward:", deletingId);
            const rewardDoc = doc(db, 'rewards', deletingId);
            await deleteDoc(rewardDoc);
            console.log("✅ Reward deleted!");
            setShowDeleteConfirm(false);
            setDeletingId(null);
        } catch (error) {
            console.error("❌ Error deleting reward:", error);
            alert(`Failed to delete reward: ${error.message}`);
        }
    };

    const handleToggleStatus = async (reward) => {
        try {
            const rewardDoc = doc(db, 'rewards', reward.id);
            await updateDoc(rewardDoc, {
                isActive: !reward.isActive,
                updatedAt: Timestamp.now()
            });
            console.log("✅ Status toggled!");
        } catch (error) {
            console.error("❌ Error toggling status:", error);
            alert(`Failed to update status: ${error.message}`);
        }
    };

    const handlePageChange = (page) => {
        setCurrentPage(page);
    };

    const handleItemsPerPageChange = (newItemsPerPage) => {
        setItemsPerPage(newItemsPerPage);
        setCurrentPage(1);
    };

    // Calculate pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedRewards = filteredRewards.slice(startIndex, endIndex);
    const totalPages = Math.ceil(filteredRewards.length / itemsPerPage);

    const getTypeIcon = (type) => {
        return type === 'voucher' ? <Percent size={16} /> : <Package size={16} />;
    };

    const getDaysRemainingDisplay = (expiryDate) => {
        if (!expiryDate) return '-';
        
        const daysRemaining = calculateDaysRemaining(expiryDate);
        
        if (daysRemaining < 0) {
            return <span className="expired-badge">Expired</span>;
        } else if (daysRemaining === 0) {
            return <span className="expiring-badge">Today</span>;
        } else {
            return (
                <div className="days-remaining">
                    <Clock size={14} />
                    <span>{daysRemaining} days</span>
                </div>
            );
        }
    };

    const getStatusToggle = (reward) => (
        <button
            onClick={() => handleToggleStatus(reward)}
            className={`toggle-status ${reward.isActive ? 'active' : 'inactive'}`}
        >
            {reward.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
            <span className="toggle-label">{reward.isActive ? 'Active' : 'Inactive'}</span>
        </button>
    );

    // Show error message if Firebase fails
    if (firebaseError) {
        return (
            <Layout onNavigate={onNavigate} currentPage="rewards-management">
                <div className="p-6">
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded mb-6">
                        <div className="flex items-center">
                            <AlertCircle className="text-red-500 mr-3" size={24} />
                            <div>
                                <h3 className="text-red-800 font-bold text-lg">Firebase Connection Error</h3>
                                <p className="text-red-700">{firebaseError}</p>
                                <p className="text-red-600 text-sm mt-2">
                                    Please enable Firestore in Firebase Console:
                                    <a 
                                        href="https://console.firebase.google.com/project/bloodconnectnv/firestore" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="ml-2 text-red-800 underline"
                                    >
                                        Enable Firestore
                                    </a>
                                </p>
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={() => window.location.reload()}
                        className="bg-red-600 text-white px-4 py-2 rounded"
                    >
                        Retry Connection
                    </button>
                </div>
            </Layout>
        );
    }

    if (loading) {
        return (
            <Layout onNavigate={onNavigate} currentPage="rewards-management">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>Connecting to Firebase...</p>
                </div>
            </Layout>
        );
    }

    return (
        <Layout onNavigate={onNavigate} currentPage="rewards-management">
            <div className="space-y-6">
                {/* Header */}
                <div className="rewards-header">
                    <h1 className="rewards-title">Rewards Management</h1>
                    <button onClick={handleAddNew} className="add-reward-btn">
                        <Plus size={20} />
                        Add Reward
                    </button>
                </div>

                {/* Firebase Status */}
                <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                    <div className="flex items-center">
                        <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                        <div>
                            <p className="text-green-800 font-medium">Connected to Firebase</p>
                            <p className="text-green-700 text-sm">Data is being saved to Firestore database</p>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="rewards-stats-grid">
                    <div className="stat-card total">
                        <h3>{rewards.length}</h3>
                        <p>Total Rewards</p>
                    </div>
                    <div className="stat-card vouchers">
                        <h3>{rewards.filter(r => r.type === 'voucher').length}</h3>
                        <p>Vouchers</p>
                    </div>
                    <div className="stat-card products">
                        <h3>{rewards.filter(r => r.type === 'product').length}</h3>
                        <p>Physical Products</p>
                    </div>
                    <div className="stat-card active">
                        <h3>{rewards.filter(r => r.isActive).length}</h3>
                        <p>Active Rewards</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="rewards-filters">
                    <div className="search-box">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Search rewards..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                        <option value="All">All Types</option>
                        <option value="voucher">Vouchers</option>
                        <option value="product">Products</option>
                    </select>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="All">All Status</option>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                    </select>
                </div>

                {/* Rewards Table */}
                <div className="rewards-table-container">
                    <table className="rewards-table">
                        <thead>
                            <tr>
                                <th>Reward Name</th>
                                <th>Type</th>
                                <th>Category</th>
                                <th>Points Required</th>
                                <th>Details</th>
                                <th>Days Remaining</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedRewards.map((reward) => (
                                <tr key={reward.id}>
                                    <td className="reward-name">
                                        <Gift size={18} className="reward-icon" />
                                        {reward.name}
                                    </td>
                                    <td>
                                        <span className={`type-badge ${reward.type}`}>
                                            {getTypeIcon(reward.type)}
                                            {reward.type === 'voucher' ? 'Voucher' : 'Product'}
                                        </span>
                                    </td>
                                    <td>{reward.category}</td>
                                    <td className="points">{reward.pointsRequired} pts</td>
                                    <td>
                                        {reward.type === 'voucher'
                                            ? `${reward.discountValue}% OFF`
                                            : reward.stock !== undefined ? `Stock: ${reward.stock}` : '-'
                                        }
                                    </td>
                                    <td>
                                        {getDaysRemainingDisplay(reward.expiryDate)}
                                    </td>
                                    <td>{getStatusToggle(reward)}</td>
                                    <td>
                                        <div className="records-actions-container">
                                            <button
                                                onClick={() => handleEdit(reward)}
                                                className="records-action-button reschedule-button"
                                                title="Edit Reward"
                                            >
                                                <Edit className="records-action-icon" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteClick(reward.id)}
                                                className="records-action-button cancel-button"
                                                title="Delete Reward"
                                            >
                                                <Trash2 className="records-action-icon" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {filteredRewards.length === 0 && (
                        <div className="empty-state">
                            <Gift size={48} />
                            <h3>No rewards found</h3>
                            <p>Try adjusting your filters or add a new reward.</p>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {filteredRewards.length > 0 && (
                    <div className="rewards-pagination">
                        <div className="rewards-pagination-info">
                            <span>Items per page:</span>
                            <select 
                                value={itemsPerPage} 
                                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                                className="rewards-items-per-page-select"
                            >
                                <option value={6}>6</option>
                                <option value={8}>8</option>
                                <option value={12}>12</option>
                                <option value={16}>16</option>
                            </select>
                            <span className="rewards-pagination-range">
                                {startIndex + 1}-{Math.min(endIndex, filteredRewards.length)} of {filteredRewards.length}
                            </span>
                        </div>
                        
                        <div className="rewards-pagination-controls">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="rewards-pagination-btn"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="rewards-pagination-btn"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Add/Edit Modal */}
                {showAddEditModal && (
                    <div className="modal-overlay">
                        <div className="modal">
                            <div className="modal-header">
                                <h2>{editingReward ? 'Edit Reward' : 'Add New Reward'}</h2>
                                <button onClick={() => setShowAddEditModal(false)}><X size={24} /></button>
                            </div>
                            <div className="modal-body">
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Reward Name *</label>
                                        <input 
                                            value={formData.name} 
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Type *</label>
                                        <select 
                                            value={formData.type} 
                                            onChange={(e) => setFormData({ 
                                                ...formData, 
                                                type: e.target.value, 
                                                discountValue: '', 
                                                stock: '' 
                                            })}
                                        >
                                            <option value="voucher">Voucher (Discount)</option>
                                            <option value="product">Physical Product</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Category *</label>
                                        <input 
                                            value={formData.category} 
                                            onChange={(e) => setFormData({ ...formData, category: e.target.value })} 
                                            placeholder="e.g. Food & Beverages, Merchandise" 
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Points Required *</label>
                                        <input 
                                            type="number" 
                                            value={formData.pointsRequired} 
                                            onChange={(e) => setFormData({ ...formData, pointsRequired: e.target.value })} 
                                        />
                                    </div>

                                    {formData.type === 'voucher' && (
                                        <div className="form-group">
                                            <label>Discount Percentage *</label>
                                            <input 
                                                type="number" 
                                                value={formData.discountValue} 
                                                onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })} 
                                                placeholder="e.g. 20" 
                                            />
                                        </div>
                                    )}

                                    {formData.type === 'product' && (
                                        <div className="form-group">
                                            <label>Stock Quantity</label>
                                            <input 
                                                type="number" 
                                                value={formData.stock} 
                                                onChange={(e) => setFormData({ ...formData, stock: e.target.value })} 
                                                placeholder="e.g. 20" 
                                            />
                                        </div>
                                    )}

                                    <div className="form-group">
                                        <label>Expiry Date (Optional)</label>
                                        <input 
                                            type="date" 
                                            value={formData.expiryDate} 
                                            onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })} 
                                            min={new Date().toISOString().split('T')[0]}
                                        />
                                        <small>Reward will expire on this date</small>
                                    </div>

                                    <div className="form-group">
                                        <label>Max Claims Per User</label>
                                        <input 
                                            type="number" 
                                            value={formData.maxClaimsPerUser} 
                                            onChange={(e) => setFormData({ ...formData, maxClaimsPerUser: e.target.value })} 
                                            min="1"
                                        />
                                        <small>How many times a user can claim this reward</small>
                                    </div>

                                    <div className="form-group full-width">
                                        <label>Description (Optional)</label>
                                        <textarea 
                                            rows={3} 
                                            value={formData.description} 
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
                                        />
                                    </div>
                                </div>

                                <div className="modal-actions">
                                    <button onClick={() => setShowAddEditModal(false)} className="cancel-btn">Cancel</button>
                                    <button
                                        onClick={handleSave}
                                        disabled={!formData.name || !formData.category || !formData.pointsRequired || (formData.type === 'voucher' && !formData.discountValue)}
                                        className="save-btn"
                                    >
                                        {editingReward ? 'Save Changes' : 'Add Reward'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Confirm Modal */}
                {showDeleteConfirm && (
                    <div className="modal-overlay">
                        <div className="confirm-modal">
                            <AlertCircle size={48} className="warning-icon" />
                            <h3>Delete Reward</h3>
                            <p>Are you sure you want to delete this reward? This action cannot be undone.</p>
                            <div className="confirm-actions">
                                <button onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                                <button onClick={handleDeleteConfirm} className="delete-confirm">Delete</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default RewardsManagement;