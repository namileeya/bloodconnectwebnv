import React, { useState, useEffect, useCallback } from 'react';
import {
  Heart,
  Users,
  TrendingUp,
  Calendar,
  AlertCircle,
  X,
  Activity,
  Award,
  Target,
  MapPin,
  Clock,
  ArrowUp,
  ArrowDown,
  Droplet,
  Package,
  FileText,
  UserCheck,
  Gift,
  RefreshCw
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Layout from '../../components/Layout';
import './dashboard.css';
import dashboardService from '../../services/dashboardServices';

const Dashboard = ({ onNavigate }) => {
  const [stats, setStats] = useState({
    livesSaved: 0,
    totalDonations: 0,
    communityParticipation: 0,
    activeCampaigns: 0,
    pendingRequests: 0,
    completedThisMonth: 0,
    totalUsers: 0,
    totalBloodStock: 0,
    totalEvents: 0,
    communityGroups: 0,
    communityContent: 0,
    communityBanners: 0,
    totalDonationRecords: 0,
    totalAppointments: 0,
    pendingAppointments: 0,
    confirmedAppointments: 0,
    totalRegistrations: 0,
    pendingRegistrations: 0,
    eligibleDonors: 0,
    deferredDonors: 0,
    ineligibleDonors: 0,
    totalDonorCards: 0,
    totalRewards: 0,
    activeRewards: 0,
    critical: 0,
    urgent: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recentActivities, setRecentActivities] = useState([]);
  const [donationTrends, setDonationTrends] = useState([]);
  const [bloodTypeData, setBloodTypeData] = useState([]);
  const [monthlyComparison, setMonthlyComparison] = useState([]);
  const [topDonors, setTopDonors] = useState([]);
  const [urgentRequests, setUrgentRequests] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Load all dashboard data (all-time data)
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      // Load all data in parallel
      const [
        dashboardStats,
        activities,
        trends,
        bloodTypes,
        monthlyData,
        donors,
        requests,
        events
      ] = await Promise.all([
        dashboardService.getDashboardStats(),
        dashboardService.getRecentActivities(),
        dashboardService.getDonationTrends(),
        dashboardService.getBloodTypeDistribution(),
        dashboardService.getMonthlyComparison(),
        dashboardService.getTopDonors(),
        dashboardService.getUrgentRequests(),
        dashboardService.getUpcomingEvents()
      ]);

      setStats(dashboardStats);
      setRecentActivities(activities);
      setDonationTrends(trends);
      setBloodTypeData(bloodTypes);
      setMonthlyComparison(monthlyData);
      setTopDonors(donors);
      setUrgentRequests(requests);
      setUpcomingEvents(events);
      setLastUpdated(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Real-time subscription
  useEffect(() => {
    const unsubscribe = dashboardService.subscribeToDashboardData(() => {
      // Refresh data when changes occur
      loadDashboardData();
    });

    return () => unsubscribe();
  }, [loadDashboardData]);

  const getActivityIcon = (type) => {
    switch (type) {
      case 'donation': return <Heart className="activity-icon-donation" />;
      case 'request': return <AlertCircle className="activity-icon-request" />;
      case 'campaign':
      case 'story': return <Users className="activity-icon-campaign" />;
      default: return <Activity className="activity-icon-default" />;
    }
  };

  const getActivityStatusClass = (status) => {
    switch (status) {
      case 'completed':
      case 'used': return 'activity-status-completed';
      case 'pending': return 'activity-status-pending';
      case 'active': return 'activity-status-active';
      default: return 'activity-status-default';
    }
  };

  const getUrgencyClass = (urgency) => {
    switch (urgency) {
      case 'critical': return 'urgency-critical';
      case 'high': return 'urgency-high';
      case 'medium': return 'urgency-medium';
      default: return 'urgency-low';
    }
  };

  // Format last updated time
  const formatLastUpdated = () => {
    if (!lastUpdated) return '';
    const now = new Date();
    const diffMs = now - lastUpdated;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;

    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;

    return lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <Layout onNavigate={onNavigate} currentPage="dashboard">
        <div className="loading-container">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <p className="loading-text">Loading dashboard data...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout onNavigate={onNavigate} currentPage="dashboard">
      <div className="space-y-6">
        {/* Header - Simplified without period selector */}
        <div className="dashboard-header-container">
          <div>
            <h1 className="dashboard-header-title">Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Real-time overview of your blood donation system
              {lastUpdated && (
                <span className="text-sm text-gray-500 ml-2">
                  • Updated {formatLastUpdated()}
                </span>
              )}
            </p>
          </div>
          <div className="dashboard-header-actions">
            <button
              onClick={loadDashboardData}
              className="px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold text-sm shadow-sm flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
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

        {/* Hero Stats - Main Impact Metrics */}
        <div className="dashboard-stats-grid">
          <div className="dashboard-stat-card stat-card-lives">
            <div className="stat-icon-container stat-icon-lives">
              <Heart className="stat-icon" />
            </div>
            <div className="stat-content">
              <h3 className="stat-number-lives">{stats.livesSaved.toLocaleString()}</h3>
              <p className="stat-label">Lives Saved</p>
              <div className="stat-badge stat-badge-success">
                <ArrowUp className="stat-badge-icon" />
                <span>All-time impact</span>
              </div>
            </div>
          </div>

          <div className="dashboard-stat-card stat-card-donations">
            <div className="stat-icon-container stat-icon-donations">
              <Activity className="stat-icon" />
            </div>
            <div className="stat-content">
              <h3 className="stat-number-donations">{stats.totalDonations.toLocaleString()}</h3>
              <p className="stat-label">Total Donations</p>
              <div className="stat-badge stat-badge-success">
                <ArrowUp className="stat-badge-icon" />
                <span>Historical total</span>
              </div>
            </div>
          </div>

          <div className="dashboard-stat-card stat-card-community">
            <div className="stat-icon-container stat-icon-community">
              <Users className="stat-icon" />
            </div>
            <div className="stat-content">
              <h3 className="stat-number-community">{stats.communityParticipation.toLocaleString()}</h3>
              <p className="stat-label">Community Members</p>
              <div className="stat-badge stat-badge-success">
                <ArrowUp className="stat-badge-icon" />
                <span>Registered donors</span>
              </div>
            </div>
          </div>
        </div>

        {/* Key Operational Metrics */}
        <div className="dashboard-secondary-grid">
          <div className="dashboard-secondary-card card-campaigns">
            <div className="secondary-card-header">
              <Target className="secondary-card-icon icon-campaigns" />
              <span className="secondary-card-title">Active Campaigns</span>
            </div>
            <div className="secondary-card-value">{stats.activeCampaigns}</div>
            <div className="secondary-card-trend trend-up">
              <ArrowUp className="trend-icon" />
              <span>Currently running</span>
            </div>
          </div>

          <div className="dashboard-secondary-card card-pending">
            <div className="secondary-card-header">
              <AlertCircle className="secondary-card-icon icon-pending" />
              <span className="secondary-card-title">Pending Requests</span>
            </div>
            <div className="secondary-card-value">{stats.pendingRequests}</div>
            <div className="secondary-card-trend trend-down">
              <ArrowDown className="trend-icon" />
              <span>Needs attention</span>
            </div>
          </div>

          <div className="dashboard-secondary-card card-completed">
            <div className="secondary-card-header">
              <Award className="secondary-card-icon icon-completed" />
              <span className="secondary-card-title">Completed This Month</span>
            </div>
            <div className="secondary-card-value">{stats.completedThisMonth}</div>
            <div className="secondary-card-trend trend-up">
              <ArrowUp className="trend-icon" />
              <span>Monthly progress</span>
            </div>
          </div>

          <div className="dashboard-secondary-card card-scheduled">
            <div className="secondary-card-header">
              <Calendar className="secondary-card-icon icon-scheduled" />
              <span className="secondary-card-title">Upcoming Events</span>
            </div>
            <div className="secondary-card-value">{upcomingEvents.length}</div>
            <div className="secondary-card-trend trend-neutral">
              <Calendar className="trend-icon" />
              <span>Scheduled campaigns</span>
            </div>
          </div>
        </div>

        {/* System-Wide Overview - Show all data */}
        <div className="dashboard-overview-section">
          <h2 className="dashboard-section-title">System Overview</h2>
          <p className="text-gray-600 mb-6">All-time statistics and system-wide metrics</p>
          <div className="dashboard-overview-grid">
            {/* Donation Management Group */}
            <div className="overview-category-card">
              <div className="category-header">
                <div className="category-icon-wrapper category-icon-red">
                  <Heart className="category-icon" />
                </div>
                <h3 className="category-title">Donation Management</h3>
              </div>
              <div className="category-stats">
                <div className="category-stat-item">
                  <span className="category-stat-label">Total Donations</span>
                  <span className="category-stat-value">{stats.totalDonations}</span>
                </div>
                <div className="category-stat-item">
                  <span className="category-stat-label">Lives Saved</span>
                  <span className="category-stat-value">{stats.livesSaved}</span>
                </div>
                <div className="category-stat-item">
                  <span className="category-stat-label">Appointments</span>
                  <span className="category-stat-value">{stats.totalAppointments}</span>
                </div>
              </div>
            </div>

            {/* Blood Inventory Group - Shows ACTUAL bloodstock quantities */}
            <div className="overview-category-card">
              <div className="category-header">
                <div className="category-icon-wrapper category-icon-blue">
                  <Droplet className="category-icon" />
                </div>
                <h3 className="category-title">Blood Inventory</h3>
              </div>
              <div className="category-stats">
                <div className="category-stat-item">
                  <span className="category-stat-label">Total Units</span>
                  <span className="category-stat-value">{stats.totalBloodStock}</span>
                </div>
                <div className="category-stat-item">
                  <span className="category-stat-label">Critical</span>
                  <span className="category-stat-value" style={{ color: '#dc2626' }}>{stats.critical}</span>
                </div>
                <div className="category-stat-item">
                  <span className="category-stat-label">Urgent</span>
                  <span className="category-stat-value" style={{ color: '#ea580c' }}>{stats.urgent}</span>
                </div>
              </div>
            </div>

            {/* Events Group */}
            <div className="overview-category-card">
              <div className="category-header">
                <div className="category-icon-wrapper category-icon-purple">
                  <Calendar className="category-icon" />
                </div>
                <h3 className="category-title">Events</h3>
              </div>
              <div className="category-stats">
                <div className="category-stat-item">
                  <span className="category-stat-label">Total Events</span>
                  <span className="category-stat-value">{stats.totalEvents}</span>
                </div>
                <div className="category-stat-item">
                  <span className="category-stat-label">Active</span>
                  <span className="category-stat-value">{stats.activeCampaigns}</span>
                </div>
                <div className="category-stat-item">
                  <span className="category-stat-label">Upcoming</span>
                  <span className="category-stat-value">{upcomingEvents.length}</span>
                </div>
              </div>
            </div>

            {/* User Management Group */}
            <div className="overview-category-card">
              <div className="category-header">
                <div className="category-icon-wrapper category-icon-green">
                  <Users className="category-icon" />
                </div>
                <h3 className="category-title">Users & Donors</h3>
              </div>
              <div className="category-stats">
                <div className="category-stat-item">
                  <span className="category-stat-label">Total Users</span>
                  <span className="category-stat-value">{stats.totalUsers}</span>
                </div>
                <div className="category-stat-item">
                  <span className="category-stat-label">Donors</span>
                  <span className="category-stat-value">{stats.communityParticipation}</span>
                </div>
                <div className="category-stat-item">
                  <span className="category-stat-label">Donor Cards</span>
                  <span className="category-stat-value">{stats.totalDonorCards}</span>
                </div>
              </div>
            </div>

            {/* Community Group */}
            <div className="overview-category-card">
              <div className="category-header">
                <div className="category-icon-wrapper category-icon-teal">
                  <Users className="category-icon" />
                </div>
                <h3 className="category-title">Community</h3>
              </div>
              <div className="category-stats">
                <div className="category-stat-item">
                  <span className="category-stat-label">Groups</span>
                  <span className="category-stat-value">{stats.communityGroups}</span>
                </div>
                <div className="category-stat-item">
                  <span className="category-stat-label">Stories</span>
                  <span className="category-stat-value">{stats.communityContent}</span>
                </div>
                <div className="category-stat-item">
                  <span className="category-stat-label">Announcements</span>
                  <span className="category-stat-value">{stats.communityBanners}</span>
                </div>
              </div>
            </div>

            {/* Rewards & Cards Group */}
            <div className="overview-category-card">
              <div className="category-header">
                <div className="category-icon-wrapper category-icon-yellow">
                  <Gift className="category-icon" />
                </div>
                <h3 className="category-title">Rewards</h3>
              </div>
              <div className="category-stats">
                <div className="category-stat-item">
                  <span className="category-stat-label">Total Rewards</span>
                  <span className="category-stat-value">{stats.totalRewards}</span>
                </div>
                <div className="category-stat-item">
                  <span className="category-stat-label">Active</span>
                  <span className="category-stat-value">{stats.activeRewards}</span>
                </div>
                <div className="category-stat-item">
                  <span className="category-stat-label">Eligible Donors</span>
                  <span className="category-stat-value">{stats.eligibleDonors}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section - All showing actual data */}
        <div className="dashboard-charts-grid">
          <div className="dashboard-chart-card chart-full">
            <div className="chart-header">
              <h3 className="chart-title">Donation History</h3>
              <p className="chart-subtitle">Monthly donations over the past 6 months</p>
            </div>
            <div className="chart-container">
              {donationTrends.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={donationTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value) => [`${value} donations`, 'Count']}
                      labelFormatter={(label) => `Month: ${label}`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="donations"
                      stroke="#EF4444"
                      strokeWidth={3}
                      dot={{ fill: '#EF4444', r: 5 }}
                      activeDot={{ r: 7, strokeWidth: 2 }}
                      name="Donations"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Activity className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-lg font-medium">No donation history data available</p>
                  <p className="text-sm text-gray-400 mt-1">Donation records will appear here</p>
                </div>
              )}
            </div>
          </div>

          <div className="dashboard-chart-card chart-half">
            <div className="chart-header">
              <h3 className="chart-title">Blood Type Distribution</h3>
              <p className="chart-subtitle">Current inventory levels by type</p>
            </div>
            <div className="chart-container">
              {bloodTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={bloodTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                    >
                      {bloodTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [`${value} units`, name]}
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Droplet className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-lg font-medium">No blood type data available</p>
                  <p className="text-sm text-gray-400 mt-1">Blood inventory will appear here</p>
                </div>
              )}
            </div>
          </div>

          <div className="dashboard-chart-card chart-half">
            <div className="chart-header">
              <h3 className="chart-title">Recent Month Comparison</h3>
              <p className="chart-subtitle">Donation status comparison</p>
            </div>
            <div className="chart-container">
              {monthlyComparison.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyComparison}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px'
                      }}
                      formatter={(value, name) => [`${value} donations`, name]}
                    />
                    <Legend />
                    <Bar dataKey="completed" fill="#10B981" radius={[8, 8, 0, 0]} name="Completed" />
                    <Bar dataKey="pending" fill="#F59E0B" radius={[8, 8, 0, 0]} name="Pending" />
                    <Bar dataKey="rejected" fill="#EF4444" radius={[8, 8, 0, 0]} name="Rejected/Expired" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <TrendingUp className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-lg font-medium">No monthly comparison data</p>
                  <p className="text-sm text-gray-400 mt-1">Monthly donation data will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="dashboard-two-column">
          {/* Urgent Blood Requests - Shows ACTUAL pending requests only */}
          <div className="dashboard-urgent-container">
            <div className="dashboard-urgent-header">
              <div className="urgent-header-left">
                <AlertCircle className="urgent-header-icon" />
                <h2 className="dashboard-urgent-title">Urgent Blood Requests</h2>
              </div>
              <button className="dashboard-view-all-btn" onClick={() => onNavigate && onNavigate('blood-request')}>
                View All
              </button>
            </div>
            <div className="dashboard-urgent-list">
              {urgentRequests.length > 0 ? (
                urgentRequests.map((request) => (
                  <div key={request.id} className="dashboard-urgent-item">
                    <div className="urgent-item-header">
                      <div className="urgent-blood-type">
                        <Droplet className="urgent-droplet-icon" />
                        <span className="urgent-blood-text">{request.bloodType}</span>
                      </div>
                      <span className={`urgent-badge ${getUrgencyClass(request.urgency)}`}>
                        {request.urgency}
                      </span>
                    </div>
                    <div className="urgent-item-details">
                      <div className="urgent-detail-row">
                        <MapPin className="urgent-detail-icon" />
                        <span className="urgent-hospital">{request.state}</span>
                      </div>
                      <div className="urgent-detail-row">
                        <Target className="urgent-detail-icon" />
                        <span className="urgent-units">{request.units} units needed</span>
                      </div>
                      <div className="urgent-detail-row">
                        <Clock className="urgent-detail-icon" />
                        <span className="urgent-time">{request.time}</span>
                      </div>
                    </div>
                    <button
                      className="urgent-respond-btn"
                      onClick={() => onNavigate && onNavigate('blood-request')}
                    >
                      Respond to Request
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <AlertCircle className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-lg font-medium">No urgent requests at the moment</p>
                  <p className="text-sm text-gray-400 mt-1">Great job keeping up with requests!</p>
                </div>
              )}
            </div>
          </div>

          {/* Top Donors */}
          <div className="dashboard-donors-container">
            <div className="dashboard-donors-header">
              <div className="donors-header-left">
                <Award className="donors-header-icon" />
                <h2 className="dashboard-donors-title">Top Donors</h2>
              </div>
              <button className="dashboard-view-all-btn" onClick={() => onNavigate && onNavigate('user-management')}>
                View All
              </button>
            </div>
            <div className="dashboard-donors-list">
              {topDonors.length > 0 ? (
                topDonors.map((donor, index) => (
                  <div key={donor.id || index} className="dashboard-donor-item">
                    <div className="donor-rank">{index + 1}</div>
                    <div className="donor-info">
                      <h4 className="donor-name">{donor.name}</h4>
                      <div className="donor-details">
                        <span className="donor-blood-type">{donor.bloodType}</span>
                        <span className="donor-separator">•</span>
                        <span className="donor-count">{donor.donationCount} donations</span>
                      </div>
                    </div>
                    <div className="donor-last">
                      <Clock className="donor-clock-icon" />
                      <span className="donor-last-text">{donor.lastDonation}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Users className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-lg font-medium">No donor data available</p>
                  <p className="text-sm text-gray-400 mt-1">Donation records will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="dashboard-events-container">
          <div className="dashboard-events-header">
            <div className="events-header-left">
              <Calendar className="events-header-icon" />
              <h2 className="dashboard-events-title">Upcoming Events</h2>
            </div>
            <button className="dashboard-view-all-btn" onClick={() => onNavigate && onNavigate('event-management')}>
              View All
            </button>
          </div>
          <div className="dashboard-events-grid">
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map((event) => (
                <div key={event.id} className="dashboard-event-card">
                  <div className="event-date-badge">
                    <Calendar className="event-date-icon" />
                    <span className="event-date-text">{event.date}</span>
                  </div>
                  <h3 className="event-title">{event.title}</h3>
                  <div className="event-details">
                    <div className="event-detail-item">
                      <Clock className="event-detail-icon" />
                      <span>{event.time}</span>
                    </div>
                    <div className="event-detail-item">
                      <MapPin className="event-detail-icon" />
                      <span>{event.location}</span>
                    </div>
                    <div className="event-detail-item">
                      <Users className="event-detail-icon" />
                      <span>{event.participants} participants</span>
                    </div>
                  </div>
                  <button
                    className="event-register-btn"
                    onClick={() => onNavigate && onNavigate('event-management')}
                  >
                    View Details
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500 col-span-3">
                <Calendar className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-lg font-medium">No upcoming events scheduled</p>
                <p className="text-sm text-gray-400 mt-1">Create events to engage your community</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="dashboard-activity-container">
          <div className="dashboard-activity-header">
            <h2 className="dashboard-activity-title">Recent Activity</h2>
            <button className="dashboard-view-all-btn" onClick={() => onNavigate && onNavigate('donation-management')}>
              View All
            </button>
          </div>
          <div className="dashboard-activity-list">
            {recentActivities.length > 0 ? (
              recentActivities.map((activity) => (
                <div key={activity.id} className="dashboard-activity-item">
                  <div className="activity-icon-wrapper">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="activity-details">
                    <div className="activity-main">
                      <span className="activity-user">{activity.user}</span>
                      <span className="activity-action">{activity.action}</span>
                    </div>
                    <span className="activity-time">{activity.time}</span>
                  </div>
                  <span className={`activity-status-badge ${getActivityStatusClass(activity.status)}`}>
                    {activity.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Activity className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-lg font-medium">No recent activities</p>
                <p className="text-sm text-gray-400 mt-1">Activities will appear here as they happen</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions - Organized by Category */}
        <div className="dashboard-quick-actions">
          <h2 className="dashboard-quick-actions-title">Quick Actions</h2>

          {/* Donation Management Actions */}
          <div className="quick-actions-category">
            <h3 className="quick-actions-category-title">
              <Heart className="w-5 h-5 text-red-600" />
              Donation Management
            </h3>
            <div className="quick-actions-grid">
              <button className="dashboard-quick-action-btn action-btn-primary" onClick={() => onNavigate && onNavigate('donation-management')}>
                <Heart className="quick-action-icon" />
                <span>Donations</span>
              </button>
              <button className="dashboard-quick-action-btn action-btn-primary" onClick={() => onNavigate && onNavigate('donation-records')}>
                <FileText className="quick-action-icon" />
                <span>Records</span>
              </button>
              <button className="dashboard-quick-action-btn action-btn-primary" onClick={() => onNavigate && onNavigate('donation-appointments')}>
                <Calendar className="quick-action-icon" />
                <span>Appointments</span>
              </button>
            </div>
          </div>

          {/* Blood Management Actions */}
          <div className="quick-actions-category">
            <h3 className="quick-actions-category-title">
              <Droplet className="w-5 h-5 text-blue-600" />
              Blood Management
            </h3>
            <div className="quick-actions-grid">
              <button className="dashboard-quick-action-btn action-btn-secondary" onClick={() => onNavigate && onNavigate('blood-inventory')}>
                <Package className="quick-action-icon" />
                <span>Inventory</span>
              </button>
              <button className="dashboard-quick-action-btn action-btn-secondary" onClick={() => onNavigate && onNavigate('blood-request')}>
                <AlertCircle className="quick-action-icon" />
                <span>Requests</span>
              </button>
            </div>
          </div>

          {/* Event Management Actions */}
          <div className="quick-actions-category">
            <h3 className="quick-actions-category-title">
              <Calendar className="w-5 h-5 text-purple-600" />
              Event Management
            </h3>
            <div className="quick-actions-grid">
              <button className="dashboard-quick-action-btn action-btn-tertiary" onClick={() => onNavigate && onNavigate('event-management')}>
                <Calendar className="quick-action-icon" />
                <span>Events</span>
              </button>
              <button className="dashboard-quick-action-btn action-btn-tertiary" onClick={() => onNavigate && onNavigate('manage-events-slots')}>
                <Clock className="quick-action-icon" />
                <span>Slots</span>
              </button>
              <button className="dashboard-quick-action-btn action-btn-tertiary" onClick={() => onNavigate && onNavigate('event-registrations')}>
                <Users className="quick-action-icon" />
                <span>Registrations</span>
              </button>
            </div>
          </div>

          {/* User Management Actions */}
          <div className="quick-actions-category">
            <h3 className="quick-actions-category-title">
              <Users className="w-5 h-5 text-green-600" />
              User Management
            </h3>
            <div className="quick-actions-grid">
              <button className="dashboard-quick-action-btn action-btn-quaternary" onClick={() => onNavigate && onNavigate('user-management')}>
                <Users className="quick-action-icon" />
                <span>Users</span>
              </button>
              <button className="dashboard-quick-action-btn action-btn-quaternary" onClick={() => onNavigate && onNavigate('donor-eligibility')}>
                <UserCheck className="quick-action-icon" />
                <span>Eligibility</span>
              </button>
              <button className="dashboard-quick-action-btn action-btn-quaternary" onClick={() => onNavigate && onNavigate('digital-donor-cards')}>
                <Award className="quick-action-icon" />
                <span>Donor Cards</span>
              </button>
            </div>
          </div>

          {/* Community & Rewards Actions */}
          <div className="quick-actions-category">
            <h3 className="quick-actions-category-title">
              <Gift className="w-5 h-5 text-yellow-600" />
              Community & Rewards
            </h3>
            <div className="quick-actions-grid">
              <button className="dashboard-quick-action-btn action-btn-primary" onClick={() => onNavigate && onNavigate('community-management')}>
                <Users className="quick-action-icon" />
                <span>Community</span>
              </button>
              <button className="dashboard-quick-action-btn action-btn-primary" onClick={() => onNavigate && onNavigate('rewards-management')}>
                <Gift className="quick-action-icon" />
                <span>Rewards</span>
              </button>
            </div>
          </div>

          {/* Reports */}
          <div className="quick-actions-category">
            <h3 className="quick-actions-category-title">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              Analytics
            </h3>
            <div className="quick-actions-grid">
              <button className="dashboard-quick-action-btn action-btn-secondary" onClick={() => onNavigate && onNavigate('reports')}>
                <TrendingUp className="quick-action-icon" />
                <span>Reports</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;