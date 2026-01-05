import React, { useState, useEffect } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';

const Layout = ({ children, onNavigate, currentPage }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState('Dashboard');

  // Map page names to menu item names
  const pageToMenuMap = {
    'dashboard': 'Dashboard',
    'user-management': 'User Management',
    'digital-donor-cards': 'User Management',
    'donation-management': 'Donation Management',
    'donation-records': 'Donation Management',
    'donation-appointment': 'Donation Management',
    'donor-eligibility': 'Donation Management',
    'blood-inventory': 'Blood Inventory',
    'blood-request': 'Blood Request',
    'reports': 'Reports',
    'event-management': 'Event Management',
    'manage-events-slots': 'Event Management',
    'event-registrations': 'Event Management',
    'rewards-management': 'Rewards Management',   // <-- NEW LINE
    'community-management': 'Community Management',
    'settings': 'Settings'
  };

  // Update activeItem when currentPage changes
  useEffect(() => {
    if (currentPage && pageToMenuMap[currentPage]) {
      setActiveItem(pageToMenuMap[currentPage]);
    }
  }, [currentPage]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        activeItem={activeItem}
        setActiveItem={setActiveItem}
        onNavigate={onNavigate}
        currentPage={currentPage}
      />

      {/* Header */}
      <Header
        isSidebarCollapsed={isSidebarCollapsed}
        toggleSidebar={toggleSidebar}
        onNavigate={onNavigate}
      />

      {/* Main Content Area */}
      <main className={`transition-all duration-300 pt-20 ${isSidebarCollapsed ? 'ml-16' : 'ml-72'
        }`}>
        <div className="p-6">
          {children ? children : (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                {activeItem}
              </h1>
              <p className="text-gray-600">
                This is the {activeItem.toLowerCase()} page content. The sidebar is currently {isSidebarCollapsed ? 'collapsed' : 'expanded'}.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Layout;