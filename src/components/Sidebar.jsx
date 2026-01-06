import React, { useState, useEffect } from 'react';
import {
  Clock, Users, FileText, Grid3X3, BarChart3, Calendar,
  FileBarChart, UsersRound, Settings, LogOut, ChevronDown, ChevronRight,
  Gift
} from 'lucide-react';

const Sidebar = ({ isCollapsed, activeItem, setActiveItem, onNavigate, currentPage }) => {
  const [donationDropdownOpen, setDonationDropdownOpen] = useState(true);
  const [eventDropdownOpen, setEventDropdownOpen] = useState(true);
  const [userDropdownOpen, setUserDropdownOpen] = useState(true);

  // Close all dropdowns when sidebar collapses
  useEffect(() => {
    if (isCollapsed) {
      setDonationDropdownOpen(false);
      setEventDropdownOpen(false);
      setUserDropdownOpen(false);
    }
  }, [isCollapsed]);

  const mainItems = [
    { name: 'Dashboard', icon: Clock, page: 'dashboard' },
    {
      name: 'User Management',
      icon: Users,
      page: 'user-management',
      isDropdown: true,
      dropdownType: 'user'
    },
    {
      name: 'Donation Management',
      icon: FileText,
      page: 'donation-management',
      isDropdown: true,
      dropdownType: 'donation'
    },
    { name: 'Blood Inventory', icon: Grid3X3, page: 'blood-inventory' },
    { name: 'Blood Request', icon: BarChart3, page: 'blood-request' },
    { name: 'Reports', icon: FileBarChart, page: 'reports' },
    {
      name: 'Event Management',
      icon: Calendar,
      page: 'event-management',
      isDropdown: true,
      dropdownType: 'event'
    },
    { name: 'Rewards Management', icon: Gift, page: 'rewards-management' },
    { name: 'Community Management', icon: UsersRound, page: 'community-management' },
  ];

  const bottomItems = [
    { name: 'Settings', icon: Settings, page: 'settings' },
    { name: 'Logout', icon: LogOut, page: 'logout' },
  ];

  const userSubItems = [
    { label: 'Donor List', page: 'user-management' },
    { label: 'Digital Donor Cards', page: 'digital-donor-cards' },
  ];

  const donationSubItems = [
    { label: 'Donation Records', page: 'donation-records' },
    { label: 'Donation Appointment', page: 'donation-appointment' },
    { label: 'Donor Eligibility', page: 'donor-eligibility' },
  ];

  const eventSubItems = [
    { label: 'Manage Events & Slots', page: 'manage-events-slots' },
    { label: 'Event Registrations', page: 'event-registrations' },
  ];

  const handleItemClick = (item) => {
    if (item.name === 'Logout') {
      onNavigate('logout');
      return;
    }
    setActiveItem(item.name);
    onNavigate(item.page);
  };

  const handleSubmenuClick = (e, page, parentName) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveItem(parentName);
    onNavigate(page);
  };

  const toggleDonationDropdown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDonationDropdownOpen(!donationDropdownOpen);
  };

  const toggleEventDropdown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setEventDropdownOpen(!eventDropdownOpen);
  };

  const toggleUserDropdown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setUserDropdownOpen(!userDropdownOpen);
  };

  return (
    <div className={`bg-[#DE0D0D] text-white fixed left-0 top-0 h-screen shadow-lg z-50 flex flex-col transition-all duration-300 ease-in-out ${isCollapsed ? 'w-16' : 'w-72'}`}>
      {/* Logo */}
      <div className={`border-b border-white border-opacity-10 flex-shrink-0 transition-all duration-300 ${isCollapsed ? 'p-3' : 'p-6'}`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'}`}>
          <img
            src="/images/bloodconnect logo 6.png"
            alt="Logo"
            className="w-10 h-10 flex-shrink-0"
          />
          <span className={`ml-3 text-xl font-bold whitespace-nowrap transition-opacity duration-300 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
            BloodConnect
          </span>
        </div>
      </div>

      <nav className="flex-1 py-5 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white scrollbar-thumb-opacity-20 scrollbar-track-transparent">
        {mainItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.name;

          if (item.isDropdown) {
            const subItems =
              item.dropdownType === 'donation' ? donationSubItems :
                item.dropdownType === 'event' ? eventSubItems :
                  userSubItems;

            const isDropdownOpen =
              item.dropdownType === 'donation' ? donationDropdownOpen :
                item.dropdownType === 'event' ? eventDropdownOpen :
                  userDropdownOpen;

            const toggleDropdown =
              item.dropdownType === 'donation' ? toggleDonationDropdown :
                item.dropdownType === 'event' ? toggleEventDropdown :
                  toggleUserDropdown;

            const isAnySubActive = subItems.some(sub => currentPage === sub.page);

            return (
              <div key={item.name} className="relative group">
                {/* Dropdown Button */}
                <button
                  onClick={toggleDropdown}
                  className={`w-full flex items-center justify-between py-3 text-left font-medium transition-all duration-200 ${isAnySubActive ? 'bg-white bg-opacity-90 text-[#DE0D0D]' : 'hover:bg-white hover:bg-opacity-10'
                    } ${isCollapsed ? 'justify-center px-3' : 'px-5'}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon size={20} className="flex-shrink-0" />
                    <span className={`whitespace-nowrap transition-opacity duration-300 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
                      {item.name}
                    </span>
                  </div>
                  <div className={`transition-opacity duration-300 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
                    {isDropdownOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                </button>

                {/* Tooltip in collapsed mode */}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs px-3 py-1.5 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                    {item.name}
                  </div>
                )}

                {/* Submenu */}
                {!isCollapsed && isDropdownOpen && (
                  <div className="bg-black bg-opacity-20 border-l-2 border-white border-opacity-30">
                    {subItems.map((subItem) => {
                      const isSubActive = currentPage === subItem.page;
                      return (
                        <button
                          key={subItem.page}
                          onClick={(e) => handleSubmenuClick(e, subItem.page, item.name)}
                          className={`block w-full text-left py-2.5 px-12 text-sm font-medium transition-all duration-200 cursor-pointer ${isSubActive
                              ? 'bg-white bg-opacity-30 text-white border-l-4 border-white'
                              : 'hover:bg-white hover:bg-opacity-10 border-l-4 border-transparent'
                            }`}
                        >
                          {subItem.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // Regular non-dropdown items
          return (
            <div key={item.name} className="relative group">
              <button
                onClick={() => handleItemClick(item)}
                className={`w-full flex items-center gap-3 py-3 text-left font-medium transition-all duration-200 ${isActive && currentPage === item.page ? 'bg-white bg-opacity-90 text-[#DE0D0D]' : 'hover:bg-white hover:bg-opacity-10'
                  } ${isCollapsed ? 'justify-center px-3' : 'px-5'}`}
                title={isCollapsed ? item.name : ''}
              >
                <Icon size={20} className="flex-shrink-0" />
                <span className={`whitespace-nowrap transition-opacity duration-300 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
                  {item.name}
                </span>
              </button>
              {isCollapsed && (
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs px-3 py-1.5 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                  {item.name}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom Items */}
      <div className="border-t border-white border-opacity-10 pt-4 pb-6">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.name} className="relative group">
              <button
                onClick={() => handleItemClick(item)}
                className={`w-full flex items-center gap-3 py-3 text-left font-medium hover:bg-white hover:bg-opacity-10 transition-all duration-200 ${isCollapsed ? 'justify-center px-3' : 'px-5'
                  }`}
              >
                <Icon size={20} className="flex-shrink-0" />
                <span className={`whitespace-nowrap transition-opacity duration-300 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
                  {item.name}
                </span>
              </button>
              {isCollapsed && (
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs px-3 py-1.5 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                  {item.name}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Sidebar;