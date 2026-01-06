import React, { useState, useEffect } from 'react';
import {
  Clock, User, CalendarDays, Users, LogOut, ChevronDown, ChevronRight,
  Gift, HeartHandshake, Droplet, ClipboardPlus, ChartColumn
} from 'lucide-react';

import logoImage from '../assets/bloodconnect_logo_6.png';

const Sidebar = ({ isCollapsed, activeItem, setActiveItem, onNavigate, currentPage }) => {
  const [donationDropdownOpen, setDonationDropdownOpen] = useState(false);
  const [eventDropdownOpen, setEventDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const navRef = React.useRef(null);

  // Close all dropdowns when sidebar collapses
  useEffect(() => {
    if (isCollapsed) {
      setDonationDropdownOpen(false);
      setEventDropdownOpen(false);
      setUserDropdownOpen(false);
    }
  }, [isCollapsed]);

  // Restore scroll position when navigating
  useEffect(() => {
    const savedScrollPos = sessionStorage.getItem('sidebarScrollPos');
    if (savedScrollPos && navRef.current) {
      navRef.current.scrollTop = parseInt(savedScrollPos, 10);
    }
  }, [currentPage]);

  // Restore dropdown states from sessionStorage on mount
  useEffect(() => {
    const savedDonationState = sessionStorage.getItem('donationDropdownOpen');
    const savedEventState = sessionStorage.getItem('eventDropdownOpen');
    const savedUserState = sessionStorage.getItem('userDropdownOpen');

    if (savedDonationState !== null) setDonationDropdownOpen(savedDonationState === 'true');
    if (savedEventState !== null) setEventDropdownOpen(savedEventState === 'true');
    if (savedUserState !== null) setUserDropdownOpen(savedUserState === 'true');
  }, []);

  const saveScrollPosition = () => {
    if (navRef.current) {
      sessionStorage.setItem('sidebarScrollPos', navRef.current.scrollTop.toString());
    }
  };

  const mainItems = [
    { name: 'Dashboard', icon: Clock, page: 'dashboard' },
    {
      name: 'User Management',
      icon: User,
      page: 'user-management',
      isDropdown: true,
      dropdownType: 'user'
    },
    {
      name: 'Donation Management',
      icon: HeartHandshake,
      page: 'donation-management',
      isDropdown: true,
      dropdownType: 'donation'
    },
    { name: 'Blood Inventory', icon: Droplet, page: 'blood-inventory' },
    { name: 'Blood Request', icon: ClipboardPlus, page: 'blood-request' },
    { name: 'Reports', icon: ChartColumn, page: 'reports' },
    {
      name: 'Event Management',
      icon: CalendarDays,
      page: 'event-management',
      isDropdown: true,
      dropdownType: 'event'
    },
    { name: 'Rewards Management', icon: Gift, page: 'rewards-management' },
    { name: 'Community Management', icon: Users, page: 'community-management' },
  ];

  const bottomItems = [
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
    saveScrollPosition();
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
    saveScrollPosition();
    setActiveItem(parentName);
    onNavigate(page);
  };

  const toggleDonationDropdown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const newState = !donationDropdownOpen;
    setDonationDropdownOpen(newState);
    sessionStorage.setItem('donationDropdownOpen', newState.toString());
  };

  const toggleEventDropdown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const newState = !eventDropdownOpen;
    setEventDropdownOpen(newState);
    sessionStorage.setItem('eventDropdownOpen', newState.toString());
  };

  const toggleUserDropdown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const newState = !userDropdownOpen;
    setUserDropdownOpen(newState);
    sessionStorage.setItem('userDropdownOpen', newState.toString());
  };

  return (
    <div className={`bg-[#DE0D0D] text-white fixed left-0 top-0 h-screen shadow-lg z-50 flex flex-col transition-all duration-300 ease-in-out ${isCollapsed ? 'w-16' : 'w-72'}`}>
      {/* Logo */}
      <div className={`border-b border-white border-opacity-10 flex-shrink-0 transition-all duration-300 ${isCollapsed ? 'p-3' : 'p-6'}`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'}`}>
          <img
            src={logoImage}
            alt="BloodConnect Logo"
            className="w-10 h-10 flex-shrink-0 object-contain"
          />
          <span className={`ml-3 text-xl font-bold whitespace-nowrap transition-opacity duration-300 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
            BloodConnect
          </span>
        </div>
      </div>

      <nav ref={navRef} className="flex-1 py-5 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white scrollbar-thumb-opacity-20 scrollbar-track-transparent">
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