import React, { useState } from 'react';
import { 
  Menu, 
  Search, 
  Bell, 
  ChevronDown,
  User,
  Languages
} from 'lucide-react';

// Flag Components
const UKFlag = ({ className = "w-6 h-4" }) => (
  <svg className={`${className} rounded-sm border border-gray-300`} viewBox="0 0 60 30" xmlns="http://www.w3.org/2000/svg">
    <clipPath id="t">
      <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/>
    </clipPath>
    <path d="M0,0 v30 h60 v-30 z" fill="#012169"/>
    <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6"/>
    <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#t)" stroke="#C8102E" strokeWidth="4"/>
    <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10"/>
    <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6"/>
  </svg>
);

const MalaysiaFlag = ({ className = "w-6 h-4" }) => (
  <svg className={`${className} rounded-sm border border-gray-300`} viewBox="0 0 60 30" xmlns="http://www.w3.org/2000/svg">
    <rect width="60" height="30" fill="#DC143C"/>
    <rect width="60" height="2.14" y="2.14" fill="#fff"/>
    <rect width="60" height="2.14" y="6.43" fill="#fff"/>
    <rect width="60" height="2.14" y="10.71" fill="#fff"/>
    <rect width="60" height="2.14" y="15" fill="#fff"/>
    <rect width="60" height="2.14" y="19.29" fill="#fff"/>
    <rect width="60" height="2.14" y="23.57" fill="#fff"/>
    <rect width="60" height="2.14" y="27.86" fill="#fff"/>
    <rect width="30" height="15" fill="#000080"/>
    <circle cx="11" cy="7.5" r="4" fill="none" stroke="#FFD700" strokeWidth="0.8"/>
    <path d="M 15 5 L 16.5 7 L 19 6 L 17.5 8.5 L 19 11 L 16.5 10 L 15 12 L 13.5 10 L 11 11 L 12.5 8.5 L 11 6 L 13.5 7 Z" fill="#FFD700"/>
  </svg>
);

const Header = ({ isSidebarCollapsed, toggleSidebar, onNavigate }) => {
  const [searchValue, setSearchValue] = useState('');
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('English');

  const languages = [
    { name: 'English', flag: UKFlag, code: 'en' },
    { name: 'Bahasa Malaysia', flag: MalaysiaFlag, code: 'ms' }
  ];

  const currentLanguage = languages.find(lang => lang.name === selectedLanguage);

  const handleLanguageSelect = (language) => {
    setSelectedLanguage(language.name);
    setIsLanguageOpen(false);
  };

  const handleLogout = () => {
    // Handle logout functionality - navigate to login page
    if (onNavigate) {
      onNavigate('logout');
    }
    // Close the profile dropdown
    setIsProfileOpen(false);
  };

  return (
    <header className={`bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm fixed top-0 right-0 z-40 transition-all duration-300 ${
      isSidebarCollapsed ? 'left-16' : 'left-72'
    }`}>
      {/* Left Section - Hamburger Menu */}
      <div className="flex items-center gap-4 flex-1">
        <button 
          onClick={toggleSidebar}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Menu size={20} className="text-gray-600" />
        </button>
      
        {/* Search Bar */}
        <div className="w-full max-w-md">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-full text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>
      </div>
    
      {/* Right Section - Notifications, Language, Profile */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <div className="relative">
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative">
            <Bell size={20} className="text-gray-600" />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
              6
            </span>
          </button>
        </div>

        {/* Language Selector */}
        <div className="relative">
          <button
            onClick={() => setIsLanguageOpen(!isLanguageOpen)}
            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Languages size={18} className="text-gray-600" />
            {!isSidebarCollapsed && (
              <>
                <currentLanguage.flag className="w-5 h-3" />
                <span className="text-sm font-medium text-gray-700">{selectedLanguage}</span>
              </>
            )}
            <ChevronDown size={16} className="text-gray-500" />
          </button>
          
          {/* Language Dropdown */}
          {isLanguageOpen && (
            <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-40 z-50">
              {languages.map((language) => {
                const FlagComponent = language.flag;
                return (
                  <button 
                    key={language.code}
                    onClick={() => handleLanguageSelect(language)}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-3 transition-colors ${
                      selectedLanguage === language.name ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    <FlagComponent className="w-5 h-3" />
                    <span>{language.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-3 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center overflow-hidden">
              <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                <User size={14} className="text-purple-500" />
              </div>
            </div>
            {!isSidebarCollapsed && (
              <div className="text-left">
                <div className="text-sm font-semibold text-gray-900">Azura</div>
                <div className="text-xs text-gray-500">Admin</div>
              </div>
            )}
            <ChevronDown size={16} className="text-gray-500" />
          </button>

          {/* Profile Dropdown */}
          {isProfileOpen && (
            <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-48 z-50">
              <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors">
                View Profile
              </button>
              <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors">
                Settings
              </button>
              <hr className="my-2 border-gray-200" />
              <button 
                onClick={handleLogout}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-red-600 transition-colors"
              >
                Log Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;