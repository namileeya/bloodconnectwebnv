import React, { useState } from 'react';
import {
  Settings,
  User,
  Bell,
  Shield,
  Globe,
  Mail,
  Lock,
  Database,
  Smartphone,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  Trash2,
  Download,
  Upload,
  CheckCircle,
  AlertCircle,
  Building,
  MapPin,
  Phone,
  Clock,
  Calendar,
  Users,
  Heart,
  FileText,
  Palette
} from 'lucide-react';
import Layout from '../../components/Layout';
import './Settings.css';

const SettingsPage = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState('general');
  const [showPassword, setShowPassword] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form states
  const [generalSettings, setGeneralSettings] = useState({
    organizationName: 'BloodConnect Malaysia',
    email: 'admin@bloodconnect.my',
    phone: '+60 3-1234 5678',
    address: 'Kuala Lumpur, Malaysia',
    timezone: 'Asia/Kuala_Lumpur',
    language: 'en',
    dateFormat: 'DD/MM/YYYY'
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,
    urgentRequests: true,
    newDonations: true,
    upcomingEvents: true,
    systemUpdates: false,
    weeklyReports: true
  });

  const [securitySettings, setSecuritySettings] = useState({
    twoFactorAuth: false,
    sessionTimeout: '30',
    passwordExpiry: '90',
    loginAttempts: '5',
    ipWhitelist: false
  });

  const [systemSettings, setSystemSettings] = useState({
    autoBackup: true,
    backupFrequency: 'daily',
    dataRetention: '365',
    maintenanceMode: false,
    debugMode: false
  });

  const [bloodBankSettings, setBloodBankSettings] = useState({
    criticalStockLevel: '10',
    urgentStockLevel: '20',
    expiryAlertDays: '7',
    donationInterval: '56',
    minDonorAge: '18',
    maxDonorAge: '65'
  });

  const handleSave = async () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setSaveSuccess(true);
      setLoading(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    }, 1000);
  };

  const tabs = [
    { id: 'general', name: 'General', icon: Settings },
    { id: 'organization', name: 'Organization', icon: Building },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'bloodbank', name: 'Blood Bank', icon: Heart },
    { id: 'system', name: 'System', icon: Database },
    { id: 'appearance', name: 'Appearance', icon: Palette }
  ];

  return (
    <Layout onNavigate={onNavigate} currentPage="settings">
      <div className="settings-container">
        {/* Header */}
        <div className="settings-header">
          <div className="settings-header-content">
            <div className="settings-header-icon">
              <Settings className="header-icon" />
            </div>
            <div>
              <h1 className="settings-title">Settings</h1>
              <p className="settings-subtitle">Manage your blood bank system configuration</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={loading}
            className="settings-save-btn"
          >
            {loading ? (
              <>
                <RefreshCw className="btn-icon animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="btn-icon" />
                Save Changes
              </>
            )}
          </button>
        </div>

        {/* Success Message */}
        {saveSuccess && (
          <div className="settings-success-alert">
            <CheckCircle className="alert-icon" />
            <span>Settings saved successfully!</span>
          </div>
        )}

        {/* Main Content */}
        <div className="settings-layout">
          {/* Sidebar Tabs */}
          <div className="settings-sidebar">
            <nav className="settings-nav">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`settings-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                  >
                    <Icon className="nav-item-icon" />
                    <span>{tab.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content Area */}
          <div className="settings-content">
            {/* General Settings */}
            {activeTab === 'general' && (
              <div className="settings-section">
                <div className="section-header">
                  <h2 className="section-title">General Settings</h2>
                  <p className="section-description">Basic system configuration and preferences</p>
                </div>

                <div className="settings-grid">
                  <div className="settings-card">
                    <label className="settings-label">
                      <Globe className="label-icon" />
                      Language
                    </label>
                    <select
                      className="settings-select"
                      value={generalSettings.language}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, language: e.target.value })}
                    >
                      <option value="en">English</option>
                      <option value="ms">Bahasa Malaysia</option>
                      <option value="zh">中文</option>
                      <option value="ta">தமிழ்</option>
                    </select>
                  </div>

                  <div className="settings-card">
                    <label className="settings-label">
                      <Clock className="label-icon" />
                      Timezone
                    </label>
                    <select
                      className="settings-select"
                      value={generalSettings.timezone}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, timezone: e.target.value })}
                    >
                      <option value="Asia/Kuala_Lumpur">Asia/Kuala Lumpur (GMT+8)</option>
                      <option value="Asia/Singapore">Asia/Singapore (GMT+8)</option>
                      <option value="Asia/Jakarta">Asia/Jakarta (GMT+7)</option>
                    </select>
                  </div>

                  <div className="settings-card">
                    <label className="settings-label">
                      <Calendar className="label-icon" />
                      Date Format
                    </label>
                    <select
                      className="settings-select"
                      value={generalSettings.dateFormat}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, dateFormat: e.target.value })}
                    >
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Organization Settings */}
            {activeTab === 'organization' && (
              <div className="settings-section">
                <div className="section-header">
                  <h2 className="section-title">Organization Information</h2>
                  <p className="section-description">Update your organization details and contact information</p>
                </div>

                <div className="settings-form">
                  <div className="form-group">
                    <label className="settings-label">
                      <Building className="label-icon" />
                      Organization Name
                    </label>
                    <input
                      type="text"
                      className="settings-input"
                      value={generalSettings.organizationName}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, organizationName: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="settings-label">
                      <Mail className="label-icon" />
                      Email Address
                    </label>
                    <input
                      type="email"
                      className="settings-input"
                      value={generalSettings.email}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, email: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="settings-label">
                      <Phone className="label-icon" />
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      className="settings-input"
                      value={generalSettings.phone}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, phone: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="settings-label">
                      <MapPin className="label-icon" />
                      Address
                    </label>
                    <textarea
                      className="settings-textarea"
                      rows="3"
                      value={generalSettings.address}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, address: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Notification Settings */}
            {activeTab === 'notifications' && (
              <div className="settings-section">
                <div className="section-header">
                  <h2 className="section-title">Notification Preferences</h2>
                  <p className="section-description">Choose how you want to receive notifications</p>
                </div>

                <div className="settings-card-list">
                  <div className="notification-category">
                    <h3 className="category-title">Notification Channels</h3>
                    <div className="toggle-list">
                      <div className="toggle-item">
                        <div className="toggle-info">
                          <Mail className="toggle-icon" />
                          <div>
                            <p className="toggle-title">Email Notifications</p>
                            <p className="toggle-description">Receive notifications via email</p>
                          </div>
                        </div>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={notificationSettings.emailNotifications}
                            onChange={(e) => setNotificationSettings({ ...notificationSettings, emailNotifications: e.target.checked })}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>

                      <div className="toggle-item">
                        <div className="toggle-info">
                          <Bell className="toggle-icon" />
                          <div>
                            <p className="toggle-title">Push Notifications</p>
                            <p className="toggle-description">Receive push notifications in browser</p>
                          </div>
                        </div>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={notificationSettings.pushNotifications}
                            onChange={(e) => setNotificationSettings({ ...notificationSettings, pushNotifications: e.target.checked })}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>

                      <div className="toggle-item">
                        <div className="toggle-info">
                          <Smartphone className="toggle-icon" />
                          <div>
                            <p className="toggle-title">SMS Notifications</p>
                            <p className="toggle-description">Receive notifications via SMS</p>
                          </div>
                        </div>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={notificationSettings.smsNotifications}
                            onChange={(e) => setNotificationSettings({ ...notificationSettings, smsNotifications: e.target.checked })}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="notification-category">
                    <h3 className="category-title">Event Notifications</h3>
                    <div className="toggle-list">
                      <div className="toggle-item">
                        <div className="toggle-info">
                          <AlertCircle className="toggle-icon text-red-600" />
                          <div>
                            <p className="toggle-title">Urgent Blood Requests</p>
                            <p className="toggle-description">Get notified about critical requests</p>
                          </div>
                        </div>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={notificationSettings.urgentRequests}
                            onChange={(e) => setNotificationSettings({ ...notificationSettings, urgentRequests: e.target.checked })}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>

                      <div className="toggle-item">
                        <div className="toggle-info">
                          <Heart className="toggle-icon text-red-600" />
                          <div>
                            <p className="toggle-title">New Donations</p>
                            <p className="toggle-description">Receive updates on new donations</p>
                          </div>
                        </div>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={notificationSettings.newDonations}
                            onChange={(e) => setNotificationSettings({ ...notificationSettings, newDonations: e.target.checked })}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>

                      <div className="toggle-item">
                        <div className="toggle-info">
                          <Calendar className="toggle-icon" />
                          <div>
                            <p className="toggle-title">Upcoming Events</p>
                            <p className="toggle-description">Get reminders for upcoming events</p>
                          </div>
                        </div>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={notificationSettings.upcomingEvents}
                            onChange={(e) => setNotificationSettings({ ...notificationSettings, upcomingEvents: e.target.checked })}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>

                      <div className="toggle-item">
                        <div className="toggle-info">
                          <FileText className="toggle-icon" />
                          <div>
                            <p className="toggle-title">Weekly Reports</p>
                            <p className="toggle-description">Receive weekly summary reports</p>
                          </div>
                        </div>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={notificationSettings.weeklyReports}
                            onChange={(e) => setNotificationSettings({ ...notificationSettings, weeklyReports: e.target.checked })}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Security Settings */}
            {activeTab === 'security' && (
              <div className="settings-section">
                <div className="section-header">
                  <h2 className="section-title">Security Settings</h2>
                  <p className="section-description">Manage security and authentication preferences</p>
                </div>

                <div className="settings-card-list">
                  <div className="security-card">
                    <div className="security-header">
                      <Shield className="security-icon" />
                      <div>
                        <h3 className="security-title">Two-Factor Authentication</h3>
                        <p className="security-description">Add an extra layer of security to your account</p>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={securitySettings.twoFactorAuth}
                          onChange={(e) => setSecuritySettings({ ...securitySettings, twoFactorAuth: e.target.checked })}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>

                  <div className="settings-form">
                    <div className="form-group">
                      <label className="settings-label">
                        <Clock className="label-icon" />
                        Session Timeout (minutes)
                      </label>
                      <input
                        type="number"
                        className="settings-input"
                        value={securitySettings.sessionTimeout}
                        onChange={(e) => setSecuritySettings({ ...securitySettings, sessionTimeout: e.target.value })}
                      />
                      <p className="form-hint">Auto logout after inactivity</p>
                    </div>

                    <div className="form-group">
                      <label className="settings-label">
                        <Lock className="label-icon" />
                        Password Expiry (days)
                      </label>
                      <input
                        type="number"
                        className="settings-input"
                        value={securitySettings.passwordExpiry}
                        onChange={(e) => setSecuritySettings({ ...securitySettings, passwordExpiry: e.target.value })}
                      />
                      <p className="form-hint">Force password change after specified days</p>
                    </div>

                    <div className="form-group">
                      <label className="settings-label">
                        <AlertCircle className="label-icon" />
                        Max Login Attempts
                      </label>
                      <input
                        type="number"
                        className="settings-input"
                        value={securitySettings.loginAttempts}
                        onChange={(e) => setSecuritySettings({ ...securitySettings, loginAttempts: e.target.value })}
                      />
                      <p className="form-hint">Lock account after failed attempts</p>
                    </div>
                  </div>

                  <div className="security-actions">
                    <button className="security-action-btn btn-danger">
                      <Lock className="btn-icon" />
                      Change Password
                    </button>
                    <button className="security-action-btn btn-secondary">
                      <Users className="btn-icon" />
                      Manage Active Sessions
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Blood Bank Settings */}
            {activeTab === 'bloodbank' && (
              <div className="settings-section">
                <div className="section-header">
                  <h2 className="section-title">Blood Bank Configuration</h2>
                  <p className="section-description">Configure blood bank specific settings and thresholds</p>
                </div>

                <div className="settings-grid">
                  <div className="settings-card">
                    <label className="settings-label">
                      <AlertCircle className="label-icon text-red-600" />
                      Critical Stock Level (units)
                    </label>
                    <input
                      type="number"
                      className="settings-input"
                      value={bloodBankSettings.criticalStockLevel}
                      onChange={(e) => setBloodBankSettings({ ...bloodBankSettings, criticalStockLevel: e.target.value })}
                    />
                    <p className="form-hint">Alert when stock falls below this level</p>
                  </div>

                  <div className="settings-card">
                    <label className="settings-label">
                      <AlertCircle className="label-icon text-orange-600" />
                      Urgent Stock Level (units)
                    </label>
                    <input
                      type="number"
                      className="settings-input"
                      value={bloodBankSettings.urgentStockLevel}
                      onChange={(e) => setBloodBankSettings({ ...bloodBankSettings, urgentStockLevel: e.target.value })}
                    />
                    <p className="form-hint">Trigger urgent notifications at this level</p>
                  </div>

                  <div className="settings-card">
                    <label className="settings-label">
                      <Calendar className="label-icon" />
                      Expiry Alert (days before)
                    </label>
                    <input
                      type="number"
                      className="settings-input"
                      value={bloodBankSettings.expiryAlertDays}
                      onChange={(e) => setBloodBankSettings({ ...bloodBankSettings, expiryAlertDays: e.target.value })}
                    />
                    <p className="form-hint">Alert before blood units expire</p>
                  </div>

                  <div className="settings-card">
                    <label className="settings-label">
                      <Clock className="label-icon" />
                      Donation Interval (days)
                    </label>
                    <input
                      type="number"
                      className="settings-input"
                      value={bloodBankSettings.donationInterval}
                      onChange={(e) => setBloodBankSettings({ ...bloodBankSettings, donationInterval: e.target.value })}
                    />
                    <p className="form-hint">Minimum days between donations</p>
                  </div>

                  <div className="settings-card">
                    <label className="settings-label">
                      <Users className="label-icon" />
                      Minimum Donor Age
                    </label>
                    <input
                      type="number"
                      className="settings-input"
                      value={bloodBankSettings.minDonorAge}
                      onChange={(e) => setBloodBankSettings({ ...bloodBankSettings, minDonorAge: e.target.value })}
                    />
                    <p className="form-hint">Minimum age to donate blood</p>
                  </div>

                  <div className="settings-card">
                    <label className="settings-label">
                      <Users className="label-icon" />
                      Maximum Donor Age
                    </label>
                    <input
                      type="number"
                      className="settings-input"
                      value={bloodBankSettings.maxDonorAge}
                      onChange={(e) => setBloodBankSettings({ ...bloodBankSettings, maxDonorAge: e.target.value })}
                    />
                    <p className="form-hint">Maximum age to donate blood</p>
                  </div>
                </div>
              </div>
            )}

            {/* System Settings */}
            {activeTab === 'system' && (
              <div className="settings-section">
                <div className="section-header">
                  <h2 className="section-title">System Configuration</h2>
                  <p className="section-description">Manage system maintenance and data settings</p>
                </div>

                <div className="settings-card-list">
                  <div className="system-card">
                    <div className="system-header">
                      <Database className="system-icon" />
                      <div>
                        <h3 className="system-title">Automatic Backups</h3>
                        <p className="system-description">Automatically backup system data</p>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={systemSettings.autoBackup}
                          onChange={(e) => setSystemSettings({ ...systemSettings, autoBackup: e.target.checked })}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                    {systemSettings.autoBackup && (
                      <div className="system-details">
                        <select
                          className="settings-select"
                          value={systemSettings.backupFrequency}
                          onChange={(e) => setSystemSettings({ ...systemSettings, backupFrequency: e.target.value })}
                        >
                          <option value="hourly">Hourly</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="settings-form">
                    <div className="form-group">
                      <label className="settings-label">
                        <Database className="label-icon" />
                        Data Retention (days)
                      </label>
                      <input
                        type="number"
                        className="settings-input"
                        value={systemSettings.dataRetention}
                        onChange={(e) => setSystemSettings({ ...systemSettings, dataRetention: e.target.value })}
                      />
                      <p className="form-hint">Keep archived data for specified days</p>
                    </div>
                  </div>

                  <div className="system-actions">
                    <button className="system-action-btn btn-primary">
                      <Download className="btn-icon" />
                      Export System Data
                    </button>
                    <button className="system-action-btn btn-secondary">
                      <Upload className="btn-icon" />
                      Import Data
                    </button>
                    <button className="system-action-btn btn-warning">
                      <RefreshCw className="btn-icon" />
                      Clear Cache
                    </button>
                    <button className="system-action-btn btn-danger">
                      <Trash2 className="btn-icon" />
                      Reset System
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Appearance Settings */}
            {activeTab === 'appearance' && (
              <div className="settings-section">
                <div className="section-header">
                  <h2 className="section-title">Appearance Settings</h2>
                  <p className="section-description">Customize the look and feel of your dashboard</p>
                </div>

                <div className="appearance-grid">
                  <div className="appearance-card">
                    <h3 className="appearance-title">Theme</h3>
                    <div className="theme-options">
                      <div className="theme-option active">
                        <div className="theme-preview theme-light"></div>
                        <span className="theme-name">Light</span>
                      </div>
                      <div className="theme-option">
                        <div className="theme-preview theme-dark"></div>
                        <span className="theme-name">Dark</span>
                      </div>
                      <div className="theme-option">
                        <div className="theme-preview theme-auto"></div>
                        <span className="theme-name">Auto</span>
                      </div>
                    </div>
                  </div>

                  <div className="appearance-card">
                    <h3 className="appearance-title">Primary Color</h3>
                    <div className="color-options">
                      <button className="color-option active" style={{ background: '#EF4444' }}></button>
                      <button className="color-option" style={{ background: '#3B82F6' }}></button>
                      <button className="color-option" style={{ background: '#10B981' }}></button>
                      <button className="color-option" style={{ background: '#8B5CF6' }}></button>
                      <button className="color-option" style={{ background: '#F59E0B' }}></button>
                      <button className="color-option" style={{ background: '#EC4899' }}></button>
                    </div>
                  </div>

                  <div className="appearance-card">
                    <h3 className="appearance-title">Display Density</h3>
                    <select className="settings-select">
                      <option value="comfortable">Comfortable</option>
                      <option value="compact">Compact</option>
                      <option value="spacious">Spacious</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SettingsPage;