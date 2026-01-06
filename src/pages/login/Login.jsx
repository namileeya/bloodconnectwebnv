import React, { useState } from 'react';
import { CheckCircle, X, AlertCircle } from 'lucide-react';
import './Login.css'; // Import the custom CSS styles

// Success Popup Component
const SuccessPopup = ({ isVisible, onClose }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center relative animate-bounce">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={20} />
        </button>
        <div className="flex justify-center mb-4">
          <CheckCircle size={64} className="text-green-500" />
        </div>
        <h3 className="text-2xl font-bold text-gray-800 mb-2">Login Successful!</h3>
        <p className="text-gray-600">Welcome back, Admin. Redirecting to dashboard...</p>
      </div>
    </div>
  );
};

// Error Popup Component
const ErrorPopup = ({ isVisible, onClose, message }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={20} />
        </button>
        <div className="flex justify-center mb-4">
          <AlertCircle size={64} className="text-red-500" />
        </div>
        <h3 className="text-2xl font-bold text-gray-800 mb-2">Login Failed</h3>
        <p className="text-gray-600">{message}</p>
        <button
          onClick={onClose}
          className="mt-4 px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
};

// Login Component
const Login = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberPassword, setRememberPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Predefined valid credentials
  const validCredentials = [
    { email: 'admin@gmail.com', password: 'admin123' },
    { email: 'user@example.com', password: 'password123' }
  ];

  // Decision logic for login validation
  const validateLogin = () => {
    // Decision 1: Check if fields are empty
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please fill in all fields');
      return false;
    }

    // Decision 2: Check email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMessage('Please enter a valid email address');
      return false;
    }

    // Decision 3: Check credentials
    const isValidCredential = validCredentials.some(
      cred => cred.email.toLowerCase() === email.toLowerCase() && cred.password === password
    );

    if (!isValidCredential) {
      // Decision 4: Provide specific error message
      const emailExists = validCredentials.some(
        cred => cred.email.toLowerCase() === email.toLowerCase()
      );

      if (emailExists) {
        setErrorMessage('Incorrect password. Please try again.');
      } else {
        setErrorMessage('Email not found. Please check your email address.');
      }
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Apply decision logic
    if (!validateLogin()) {
      setShowErrorPopup(true);
      return;
    }

    // Proceed with login if validation passes
    if (email && password) {
      setIsLoading(true);
      // Simulate API call
      setTimeout(() => {
        console.log('Login successful', { email, rememberPassword });
        setIsLoading(false);
        setShowSuccessPopup(true);

        // Hide popup and navigate to dashboard after 2 seconds
        setTimeout(() => {
          setShowSuccessPopup(false);
          if (onLoginSuccess) {
            onLoginSuccess();
          }
        }, 2000);
      }, 1500);
    }
  };

  return (
    <>
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{
        backgroundImage: 'url(/images/background.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}>
        {/* Animated Background Shapes - Now with CSS animations */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="bg-shape bg-shape-1 absolute -top-32 -left-32 w-96 h-96 opacity-60"></div>
          <div className="bg-shape bg-shape-2 absolute -bottom-24 -right-24 w-80 h-80 opacity-50"></div>
          <div className="bg-shape bg-shape-3 absolute top-20 right-20 w-48 h-48 opacity-40"></div>
          <div className="bg-shape bg-shape-4 absolute top-1/2 -left-16 w-64 h-64 opacity-30"></div>

          {/* Additional decorative elements with pulse animation */}
          <div className="absolute top-1/3 right-1/3 w-32 h-32 bg-white opacity-5 rounded-full bg-pulse"></div>
          <div className="absolute bottom-1/4 left-1/4 w-24 h-24 bg-white opacity-10 rounded-full bg-pulse"></div>
        </div>

        {/* Login Card - Enhanced with CSS animations */}
        <div className="login-card-animated relative z-10 bg-white/95 rounded-3xl shadow-2xl p-8 w-full max-w-md mx-4">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Admin Login</h2>
            <p className="text-gray-600">Please enter your email and password to continue</p>
          </div>

          <div className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email address:
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@gmail.com"
                className="login-input w-full px-4 py-3 rounded-xl bg-gray-50 text-gray-700 placeholder-gray-400 focus:outline-none"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="login-input w-full px-4 py-3 pr-12 rounded-xl bg-gray-50 text-gray-700 placeholder-gray-400 focus:outline-none"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="password-toggle absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none z-10"
                  disabled={isLoading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    // Eye slash icon (hide password)
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 11-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    // Eye icon (show password)
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember"
                  type="checkbox"
                  checked={rememberPassword}
                  onChange={(e) => setRememberPassword(e.target.checked)}
                  className="login-checkbox h-4 w-4 rounded border-gray-300 focus:ring-red-500"
                  disabled={isLoading}
                />
                <label htmlFor="remember" className="ml-2 block text-sm text-gray-700">
                  Remember Password
                </label>
              </div>
              <button
                type="button"
                className="login-link text-sm text-gray-600 hover:text-red-600 font-medium"
                disabled={isLoading}
              >
                Forget Password?
              </button>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              className="login-button w-full text-white font-semibold py-3 px-4 rounded-xl focus:ring-4 focus:ring-red-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <svg className="loading-spinner -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing In...
                </>
              ) : (
                'Login'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Success Popup */}
      <SuccessPopup
        isVisible={showSuccessPopup}
        onClose={() => setShowSuccessPopup(false)}
      />

      {/* Error Popup */}
      <ErrorPopup
        isVisible={showErrorPopup}
        onClose={() => setShowErrorPopup(false)}
        message={errorMessage}
      />
    </>
  );
};

export default Login;