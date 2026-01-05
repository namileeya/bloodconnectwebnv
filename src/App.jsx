// src/App.jsx
import React, { useState } from 'react';
import Login from './pages/login/Login';
import Dashboard from './pages/dashboard/Dashboard';
import UserManagement from './pages/user management/UserManagement';
import DigitalDonorCards from './pages/user management/DigitalDonorCards';
import BloodRequest from './pages/blood request/BloodRequest';
import BloodInventory from './pages/blood inventory/BloodInventory';
import DonationRecords from './pages/donation management/DonationRecords';
import DonationAppointment from './pages/donation management/DonationAppointment';
import DonorEligibility from './pages/donation management/DonorEligibility';
import CommunityManagement from './pages/community management/CommunityManagement';
import ManageEventsSlots from './pages/event management/ManageEventsSlots';
import RewardsManagement from './pages/rewards management/RewardsManagement';
import EventRegistrations from './pages/event management/EventRegistrations';
import SettingsPage from './pages/Settings/Settings';
import Reports from './pages/reports/Reports';
import './App.css';
import { Settings } from 'lucide-react';


function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentPage('dashboard');
  };

  const handlePageNavigation = (page) => {
    if (page === 'logout') {
      handleLogout();
      return;
    }
    setCurrentPage(page);
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={handlePageNavigation} />;
      case 'user-management':
        return <UserManagement onNavigate={handlePageNavigation} />;
      case 'digital-donor-cards':
        return <DigitalDonorCards onNavigate={handlePageNavigation} />;
      case 'donation-records':
        // Return placeholder or actual component when created
        return <DonationRecords onNavigate={handlePageNavigation} />;
      case 'donation-appointment':
        // Return placeholder or actual component when created
        return <DonationAppointment onNavigate={handlePageNavigation} />;
      case 'donor-eligibility':
        // Return placeholder or actual component when created
        return <DonorEligibility onNavigate={handlePageNavigation} />;
      case 'blood-inventory':
        // Return placeholder or actual component when created
        return <BloodInventory onNavigate={handlePageNavigation} />;
      case 'blood-request':
        // Return placeholder or actual component when created
        return <BloodRequest onNavigate={handlePageNavigation} />;
      case 'reports':
        // Return placeholder or actual component when created
        return <Reports onNavigate={handlePageNavigation} />;
      case 'event-registrations':
        // Return placeholder or actual component when created
        return <EventRegistrations onNavigate={handlePageNavigation} />;
      case 'manage-events-slots':
        // Return placeholder or actual component when created
        return <ManageEventsSlots onNavigate={handlePageNavigation} />;
      case 'rewards-management':
        // Return placeholder or actual component when created
        return <RewardsManagement onNavigate={handlePageNavigation} />;
      case 'community-management':
        // Return placeholder or actual component when created
        return <CommunityManagement onNavigate={handlePageNavigation} />;
      case 'settings':
        // Return placeholder or actual component when created
        return <SettingsPage onNavigate={handlePageNavigation} />;
      default:
        return <Dashboard onNavigate={handlePageNavigation} />;
    }
  };

  return (
    <div className="App">
      {isLoggedIn ? (
        renderCurrentPage()
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
}

export default App;