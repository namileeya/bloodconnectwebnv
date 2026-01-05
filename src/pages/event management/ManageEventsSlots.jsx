import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Plus, X, MapPin, Clock, Users, AlertCircle, Trash2, Edit3, User, Search, ChevronDown, Building } from 'lucide-react';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../../firebase';
import Layout from '../../components/Layout';
import './ManageEventsSlots.css';

const ManageEventsSlots = ({ onNavigate }) => {
  const [events, setEvents] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  
  // For Destination Hospital (Compulsary)
  const [filteredHospitals, setFilteredHospitals] = useState([]);
  const [showDestinationDropdown, setShowDestinationDropdown] = useState(false);
  const [destinationSearch, setDestinationSearch] = useState('');
  
  // For Event Location (Optional hospital search)
  const [filteredLocationHospitals, setFilteredLocationHospitals] = useState([]);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [isEventAtHospital, setIsEventAtHospital] = useState(false);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const [showSlotsModal, setShowSlotsModal] = useState(false);
  const [selectedEventForSlots, setSelectedEventForSlots] = useState(null);
  const [slotBookings, setSlotBookings] = useState([]);
  const [donorDetails, setDonorDetails] = useState({});
  const [timeSlots, setTimeSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    location: '',
    locationType: 'other', // 'hospital' or 'other'
    locationHospitalId: '',
    locationHospitalName: '',
    organizerName: '',
    description: '',
    expectedCapacity: '',
    slotCapacity: '',
    assignedHospitalId: '', // Destination hospital
    assignedHospitalName: '',
    status: 'active'
  });

  const eventsRef = collection(db, 'blood_drive_events');
  const bookingsRef = collection(db, 'slot_bookings');
  const usersRef = collection(db, 'users');
  const donorProfilesRef = collection(db, 'donor_profiles');
  const hospitalsRef = collection(db, 'hospitals');
  
  // Refs for dropdown click outside
  const destinationDropdownRef = useRef(null);
  const locationDropdownRef = useRef(null);

  // Convert dd/mm/yyyy to Date object
  const parseDateString = (dateStr) => {
    if (!dateStr) return new Date();
    try {
      const [day, month, year] = dateStr.split('/').map(Number);
      return new Date(year, month - 1, day);
    } catch (error) {
      console.error('Error parsing date:', dateStr, error);
      return new Date();
    }
  };

  // Convert dd/mm/yyyy to yyyy-mm-dd for input
  const toInputDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const [day, month, year] = dateStr.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } catch (error) {
      console.error('Error converting date:', dateStr, error);
      return '';
    }
  };

  // Convert time "08:00 AM" to "08:00" for input
  const toInputTime = (timeStr) => {
    if (!timeStr) return '';
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!match) return '';
    
    let hours = parseInt(match[1]);
    const minutes = match[2];
    const period = match[3];
    
    if (period) {
      if (period.toUpperCase() === 'PM' && hours !== 12) hours += 12;
      if (period.toUpperCase() === 'AM' && hours === 12) hours = 0;
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  };

  // Format time back to 12-hour format
  const formatTimeTo12Hour = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    let hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    if (hour > 12) hour -= 12;
    if (hour === 0) hour = 12;
    return `${hour}:${minutes} ${period}`;
  };

  // Load hospitals from Firebase
  const loadHospitals = async () => {
    try {
      const querySnapshot = await getDocs(hospitalsRef);
      const hospitalsData = [];
      
      querySnapshot.forEach((doc) => {
        hospitalsData.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setHospitals(hospitalsData);
      setFilteredHospitals(hospitalsData);
      setFilteredLocationHospitals(hospitalsData);
    } catch (error) {
      console.error('Error loading hospitals:', error);
    }
  };

  // Filter hospitals for destination dropdown
  const filterDestinationHospitals = (searchTerm) => {
    if (!searchTerm.trim()) {
      setFilteredHospitals(hospitals);
      return;
    }
    
    const lowerSearch = searchTerm.toLowerCase();
    const filtered = hospitals.filter(hospital =>
      hospital.name.toLowerCase().includes(lowerSearch) ||
      hospital.city.toLowerCase().includes(lowerSearch) ||
      hospital.state.toLowerCase().includes(lowerSearch) ||
      hospital.address.toLowerCase().includes(lowerSearch)
    );
    
    setFilteredHospitals(filtered);
  };

  // Filter hospitals for event location dropdown
  const filterLocationHospitals = (searchTerm) => {
    if (!searchTerm.trim()) {
      setFilteredLocationHospitals(hospitals);
      return;
    }
    
    const lowerSearch = searchTerm.toLowerCase();
    const filtered = hospitals.filter(hospital =>
      hospital.name.toLowerCase().includes(lowerSearch) ||
      hospital.city.toLowerCase().includes(lowerSearch) ||
      hospital.state.toLowerCase().includes(lowerSearch) ||
      hospital.address.toLowerCase().includes(lowerSearch)
    );
    
    setFilteredLocationHospitals(filtered);
  };

  // Handle destination hospital selection
  const handleDestinationHospitalSelect = (hospital) => {
    setFormData(prev => ({
      ...prev,
      assignedHospitalId: hospital.id,
      assignedHospitalName: hospital.name
    }));
    setDestinationSearch(hospital.name);
    setShowDestinationDropdown(false);
  };

  // Handle event location hospital selection
  const handleLocationHospitalSelect = (hospital) => {
    setFormData(prev => ({
      ...prev,
      location: hospital.name + ' - ' + hospital.address,
      locationType: 'hospital',
      locationHospitalId: hospital.id,
      locationHospitalName: hospital.name
    }));
    setLocationSearch(hospital.name);
    setShowLocationDropdown(false);
    setIsEventAtHospital(true);
  };

  // Clear destination hospital
  const handleClearDestinationHospital = () => {
    setFormData(prev => ({
      ...prev,
      assignedHospitalId: '',
      assignedHospitalName: ''
    }));
    setDestinationSearch('');
    setFilteredHospitals(hospitals);
  };

  // Clear location hospital
  const handleClearLocationHospital = () => {
    setFormData(prev => ({
      ...prev,
      location: '',
      locationType: 'other',
      locationHospitalId: '',
      locationHospitalName: ''
    }));
    setLocationSearch('');
    setFilteredLocationHospitals(hospitals);
    setIsEventAtHospital(false);
  };

  // Handle location type change
  const handleLocationTypeChange = (type) => {
    setFormData(prev => ({
      ...prev,
      locationType: type,
      location: type === 'hospital' ? '' : prev.location,
      locationHospitalId: type === 'hospital' ? '' : prev.locationHospitalId,
      locationHospitalName: type === 'hospital' ? '' : prev.locationHospitalName
    }));
    setLocationSearch('');
    setIsEventAtHospital(type === 'hospital');
  };

  // Handle location input change
  const handleLocationInputChange = (value) => {
    setFormData(prev => ({
      ...prev,
      location: value
    }));
    
    // If user types in location, check if it starts with hospital-related words
    if (value.toLowerCase().includes('hospital') || 
        value.toLowerCase().includes('clinic') ||
        value.toLowerCase().includes('medical') ||
        value.toLowerCase().includes('health')) {
      setIsEventAtHospital(true);
      setFormData(prev => ({ ...prev, locationType: 'hospital' }));
      
      // Show hospital suggestions
      filterLocationHospitals(value);
      if (value.trim() && !showLocationDropdown) {
        setShowLocationDropdown(true);
      }
    } else {
      setIsEventAtHospital(false);
      setFormData(prev => ({ ...prev, locationType: 'other' }));
    }
  };

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (destinationDropdownRef.current && !destinationDropdownRef.current.contains(event.target)) {
        setShowDestinationDropdown(false);
      }
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(event.target)) {
        setShowLocationDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Load events from Firebase
  const loadEvents = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(eventsRef);
      const eventsData = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        eventsData.push({
          id: doc.id,
          ...data,
          startDateObj: parseDateString(data.startDate),
          endDateObj: parseDateString(data.endDate)
        });
      });
      
      setEvents(eventsData);
    } catch (error) {
      console.error('Error loading events:', error);
      alert('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  // Load bookings for an event
  const loadEventBookings = async (eventId) => {
    try {
      const q = query(bookingsRef, where('eventId', '==', eventId));
      const querySnapshot = await getDocs(q);
      const bookings = [];
      
      querySnapshot.forEach((doc) => {
        bookings.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return bookings;
    } catch (error) {
      console.error('Error loading bookings:', error);
      return [];
    }
  };

  // Load donor details for bookings
  const loadDonorDetails = async (bookings) => {
    const details = {};
    
    for (const booking of bookings) {
      if (!details[booking.userId]) {
        try {
          const userQuery = query(usersRef, where('__name__', '==', booking.userId));
          const userSnapshot = await getDocs(userQuery);
          
          const donorQuery = query(donorProfilesRef, where('user_id', '==', booking.userId));
          const donorSnapshot = await getDocs(donorQuery);
          
          if (!userSnapshot.empty) {
            const userData = userSnapshot.docs[0].data();
            let donorData = {};
            
            if (!donorSnapshot.empty) {
              donorData = donorSnapshot.docs[0].data();
            }
            
            details[booking.userId] = {
              user: userData,
              donor: donorData
            };
          }
        } catch (error) {
          console.error(`Error loading donor ${booking.userId}:`, error);
        }
      }
    }
    
    setDonorDetails(details);
  };

  // Get events for a specific date - FIXED VERSION
  const getEventsForDate = (date) => {
    if (!date || !events.length) return [];
    
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    return events.filter(event => {
      if (!event.startDateObj || !event.endDateObj) return false;
      
      const eventStart = new Date(event.startDateObj);
      eventStart.setHours(0, 0, 0, 0);
      
      const eventEnd = new Date(event.endDateObj);
      eventEnd.setHours(23, 59, 59, 999);
      
      return targetDate >= eventStart && targetDate <= eventEnd;
    });
  };

  // NEW FUNCTION: Generate time slots with specific bookings data
  const generateTimeSlotsForEvent = (event, bookings) => {
    if (!event.startTime || !event.endTime) return [];
    
    const timeToMinutes = (timeStr) => {
      if (!timeStr) return 0;
      
      const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
      if (!match) return 0;
      
      let hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      const period = match[3];
      
      if (period) {
        if (period.toUpperCase() === 'PM' && hours !== 12) hours += 12;
        if (period.toUpperCase() === 'AM' && hours === 12) hours = 0;
      }
      
      return hours * 60 + minutes;
    };
    
    const startMinutes = timeToMinutes(event.startTime);
    const endMinutes = timeToMinutes(event.endTime);
    const slots = [];
    
    // Generate slots every 30 minutes
    for (let time = startMinutes; time < endMinutes; time += 30) {
      const hours = Math.floor(time / 60);
      const minutes = time % 60;
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      const timeStr = `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
      const timeKey = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      
      const endTime = time + 30;
      const endHours = Math.floor(endTime / 60);
      const endMinutesVal = endTime % 60;
      const endPeriod = endHours >= 12 ? 'PM' : 'AM';
      const endDisplayHours = endHours % 12 || 12;
      const endTimeStr = `${endDisplayHours}:${endMinutesVal.toString().padStart(2, '0')} ${endPeriod}`;
      
      // Count bookings for this slot using the provided bookings array
      const bookedCount = bookings.filter(
        booking => booking.selectedTime === timeKey
      ).length;
      
      // FIX: Proper capacity check - only show full if capacity > 0 and booked >= capacity
      const capacity = parseInt(event.slotCapacity) || 0;
      const isFull = capacity > 0 && bookedCount >= capacity;
      
      slots.push({
        time: timeKey,
        displayTime: `${timeStr} - ${endTimeStr}`,
        bookedCount,
        capacity,
        isFull,
        availableSlots: Math.max(0, capacity - bookedCount),
        bookings: bookings.filter(b => b.selectedTime === timeKey)
      });
    }
    
    return slots;
  };

  // Initialize
  useEffect(() => {
    loadEvents();
    loadHospitals();
  }, []);

  // Calendar helper functions
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    return { daysInMonth, startingDayOfWeek };
  };

  const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  // Navigation functions
  const previousPeriod = () => {
    if (viewMode === 'day') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 1));
    } else if (viewMode === 'week') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 7));
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    }
  };

  const nextPeriod = () => {
    if (viewMode === 'day') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1));
    } else if (viewMode === 'week') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 7));
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    }
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  // FIXED: Event handlers - Fixed the slot booking mismatch
  const handleOpenSlotsModal = async (event) => {
    console.log('Opening slots modal for event:', event.title);
    setSelectedEventForSlots(event);
    
    try {
      // Load bookings for this specific event
      const bookings = await loadEventBookings(event.id);
      console.log('Bookings loaded:', bookings.length);
      
      // Set the slot bookings state
      setSlotBookings(bookings);
      
      // Load donor details asynchronously
      loadDonorDetails(bookings);
      
      // Generate slots using the bookings we just loaded
      const slots = generateTimeSlotsForEvent(event, bookings);
      console.log('Generated slots:', slots.length);
      console.log('Total bookings across all slots:', slots.reduce((sum, slot) => sum + slot.bookedCount, 0));
      
      setTimeSlots(slots);
      
      setShowSlotsModal(true);
    } catch (error) {
      console.error('Error opening slots modal:', error);
      alert('Failed to load slot bookings');
    }
  };

  const handleAddEvent = async () => {
    if (!formData.title || !formData.startDate || !formData.startTime || 
        !formData.endDate || !formData.endTime || !formData.slotCapacity || 
        !formData.assignedHospitalId) {
      alert('Please fill all required fields including Destination Hospital');
      return;
    }

    try {
      const formatDate = (dateStr) => {
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
      };

      const newEvent = {
        title: formData.title,
        description: formData.description || '',
        startDate: formatDate(formData.startDate),
        endDate: formatDate(formData.endDate),
        startTime: formatTimeTo12Hour(formData.startTime),
        endTime: formatTimeTo12Hour(formData.endTime),
        location: formData.location || '',
        locationType: formData.locationType || 'other',
        locationHospitalId: formData.locationHospitalId || '',
        locationHospitalName: formData.locationHospitalName || '',
        organizerName: formData.organizerName || '',
        expectedCapacity: parseInt(formData.expectedCapacity) || 0,
        slotCapacity: parseInt(formData.slotCapacity),
        assignedHospitalId: formData.assignedHospitalId,
        assignedHospitalName: formData.assignedHospitalName,
        currentParticipants: 0,
        status: 'active',
        createdAt: Timestamp.now(),
        createdBy: null
      };

      const docRef = await addDoc(eventsRef, newEvent);
      
      setEvents(prev => [...prev, {
        id: docRef.id,
        ...newEvent,
        startDateObj: parseDateString(newEvent.startDate),
        endDateObj: parseDateString(newEvent.endDate)
      }]);
      
      setShowAddModal(false);
      resetForm();
      alert('Event created successfully!');
    } catch (error) {
      console.error('Error adding event:', error);
      alert('Failed to create event');
    }
  };

  const handleEditEvent = (event) => {
    setSelectedEvent(event);
    setFormData({
      title: event.title,
      description: event.description || '',
      startDate: toInputDate(event.startDate),
      endDate: toInputDate(event.endDate),
      startTime: toInputTime(event.startTime),
      endTime: toInputTime(event.endTime),
      location: event.location || '',
      locationType: event.locationType || 'other',
      locationHospitalId: event.locationHospitalId || '',
      locationHospitalName: event.locationHospitalName || '',
      organizerName: event.organizerName || '',
      expectedCapacity: event.expectedCapacity || '',
      slotCapacity: event.slotCapacity || '',
      assignedHospitalId: event.assignedHospitalId || '',
      assignedHospitalName: event.assignedHospitalName || '',
      status: event.status || 'active'
    });
    setDestinationSearch(event.assignedHospitalName || '');
    setLocationSearch(event.locationHospitalName || '');
    setIsEventAtHospital(event.locationType === 'hospital');
    setShowEventDetails(false);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!formData.title || !formData.startDate || !formData.startTime || 
        !formData.endDate || !formData.endTime || !formData.slotCapacity ||
        !formData.assignedHospitalId) {
      alert('Please fill all required fields including Destination Hospital');
      return;
    }

    try {
      const formatDate = (dateStr) => {
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
      };

      const updatedEvent = {
        title: formData.title,
        description: formData.description || '',
        startDate: formatDate(formData.startDate),
        endDate: formatDate(formData.endDate),
        startTime: formatTimeTo12Hour(formData.startTime),
        endTime: formatTimeTo12Hour(formData.endTime),
        location: formData.location || '',
        locationType: formData.locationType || 'other',
        locationHospitalId: formData.locationHospitalId || '',
        locationHospitalName: formData.locationHospitalName || '',
        organizerName: formData.organizerName || '',
        expectedCapacity: parseInt(formData.expectedCapacity) || 0,
        slotCapacity: parseInt(formData.slotCapacity),
        assignedHospitalId: formData.assignedHospitalId,
        assignedHospitalName: formData.assignedHospitalName,
        status: formData.status
      };

      const eventRef = doc(db, 'blood_drive_events', selectedEvent.id);
      await updateDoc(eventRef, updatedEvent);
      
      setEvents(prev => prev.map(e => 
        e.id === selectedEvent.id 
          ? {
              ...e,
              ...updatedEvent,
              startDateObj: parseDateString(updatedEvent.startDate),
              endDateObj: parseDateString(updatedEvent.endDate)
            }
          : e
      ));
      
      setShowEditModal(false);
      setSelectedEvent(null);
      resetForm();
      alert('Event updated successfully!');
    } catch (error) {
      console.error('Error updating event:', error);
      alert('Failed to update event');
    }
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;
    
    try {
      const bookingsQuery = query(bookingsRef, where('eventId', '==', selectedEvent.id));
      const bookingsSnapshot = await getDocs(bookingsQuery);
      
      if (!bookingsSnapshot.empty) {
        if (!confirm('This event has bookings. Deleting it will also delete all associated bookings. Continue?')) {
          return;
        }
        
        const deletePromises = bookingsSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
      }
      
      const eventRef = doc(db, 'blood_drive_events', selectedEvent.id);
      await deleteDoc(eventRef);
      
      setEvents(prev => prev.filter(e => e.id !== selectedEvent.id));
      setShowDeleteConfirm(false);
      setShowEventDetails(false);
      setSelectedEvent(null);
      alert('Event deleted successfully!');
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Failed to delete event');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      startDate: '',
      endDate: '',
      startTime: '',
      endTime: '',
      location: '',
      locationType: 'other',
      locationHospitalId: '',
      locationHospitalName: '',
      organizerName: '',
      description: '',
      expectedCapacity: '',
      slotCapacity: '',
      assignedHospitalId: '',
      assignedHospitalName: '',
      status: 'active'
    });
    setDestinationSearch('');
    setLocationSearch('');
    setIsEventAtHospital(false);
    setFilteredHospitals(hospitals);
    setFilteredLocationHospitals(hospitals);
    setShowDestinationDropdown(false);
    setShowLocationDropdown(false);
  };

  // Calculate summary statistics
  const calculateSummary = () => {
    if (timeSlots.length === 0) {
      return {
        totalSlots: 0,
        availableSlots: 0,
        fullSlots: 0,
        totalBookings: slotBookings.length,
        totalBookedInSlots: 0
      };
    }
    
    const availableSlots = timeSlots.filter(s => !s.isFull).length;
    const fullSlots = timeSlots.filter(s => s.isFull).length;
    const totalBookedInSlots = timeSlots.reduce((sum, slot) => sum + slot.bookedCount, 0);
    
    return {
      totalSlots: timeSlots.length,
      availableSlots,
      fullSlots,
      totalBookings: slotBookings.length,
      totalBookedInSlots
    };
  };

  // Render functions
  const renderDayView = () => {
    const dayEvents = getEventsForDate(currentDate);
    const today = new Date();
    const isToday = 
      currentDate.getDate() === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear();

    return (
      <div className="day-view">
        <div className="day-view-header">
          <h3 className="day-view-date">
            {currentDate.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })}
          </h3>
          {isToday && <span className="today-badge">Today</span>}
        </div>
        <div className="day-view-events">
          {dayEvents.length > 0 ? (
            dayEvents.map((event) => (
              <div
                key={event.id}
                className="day-event-card day-event-blue"
                onClick={() => {
                  setSelectedEvent(event);
                  setShowEventDetails(true);
                }}
              >
                <div className="day-event-time">{event.startTime}</div>
                <div className="day-event-content">
                  <h4 className="day-event-title">{event.title}</h4>
                  <p className="day-event-location">
                    <MapPin className="inline w-4 h-4 mr-1" />
                    {event.location}
                  </p>
                  {event.assignedHospitalName && (
                    <p className="day-event-hospital text-sm text-blue-600">
                      <Building className="inline w-3 h-3 mr-1" />
                      Destination: {event.assignedHospitalName}
                    </p>
                  )}
                  {event.locationHospitalName && (
                    <p className="day-event-venue text-sm text-green-600">
                      <MapPin className="inline w-3 h-3 mr-1" />
                      Venue: {event.locationHospitalName}
                    </p>
                  )}
                  <p className="day-event-attendees">
                    <Users className="inline w-4 h-4 mr-1" />
                    {event.currentParticipants || 0} registered • {event.slotCapacity || 0} per slot
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="no-events">
              <Calendar className="no-events-icon" />
              <p>No events scheduled for this day</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const startOfWeek = getStartOfWeek(currentDate);
    const today = new Date();
    const weekDays = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dayEvents = getEventsForDate(date);
      const isToday = 
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();

      weekDays.push(
        <div key={i} className={`week-day ${isToday ? 'week-day-today' : ''}`}>
          <div className="week-day-header">
            <div className="week-day-name">
              {date.toLocaleDateString('en-US', { weekday: 'short' })}
            </div>
            <div className={`week-day-number ${isToday ? 'week-day-number-today' : ''}`}>
              {date.getDate()}
            </div>
          </div>
          <div className="week-day-events">
            {dayEvents.map((event) => (
              <div
                key={event.id}
                className="week-event week-event-blue"
                onClick={() => {
                  setSelectedEvent(event);
                  setShowEventDetails(true);
                }}
              >
                <div className="week-event-time">{event.startTime}</div>
                <div className="week-event-title">{event.title}</div>
                {event.assignedHospitalName && (
                  <div className="text-xs text-blue-600 truncate">
                    <Building className="inline w-3 h-3 mr-1" />
                    {event.assignedHospitalName}
                  </div>
                )}
                <div className="text-xs opacity-75">{event.slotCapacity || 0} per slot</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return <div className="week-view">{weekDays}</div>;
  };

  const renderMonthView = () => {
    const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate);
    const today = new Date();
    const weeks = [];
    let days = [];

    // Add empty days for previous month
    for (let i = 0; i < startingDayOfWeek; i++) {
      const prevMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0 - (startingDayOfWeek - i - 1));
      days.push(
        <div key={`empty-${i}`} className="calendar-day calendar-day-other">
          <span className="calendar-day-number">{prevMonthDate.getDate()}</span>
        </div>
      );
    }

    // Add days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dayEvents = getEventsForDate(date);
      const isToday = 
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();
      const isSelected = 
        selectedDate &&
        date.getDate() === selectedDate.getDate() &&
        date.getMonth() === selectedDate.getMonth() &&
        date.getFullYear() === selectedDate.getFullYear();

      days.push(
        <div
          key={day}
          className={`calendar-day ${isToday ? 'calendar-day-today' : ''} ${isSelected ? 'calendar-day-selected' : ''}`}
          onClick={() => setSelectedDate(date)}
        >
          <span className="calendar-day-number">{day}</span>
          <div className="calendar-events">
            {dayEvents.slice(0, 2).map((event, index) => (
              <div
                key={index}
                className="calendar-event calendar-event-blue"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedEvent(event);
                  setShowEventDetails(true);
                }}
              >
                <div className="calendar-event-title">{event.title}</div>
                {event.assignedHospitalName && (
                  <div className="calendar-event-hospital text-xs text-blue-600 opacity-75 truncate">
                    <Building className="inline w-3 h-3 mr-1" />
                    {event.assignedHospitalName}
                  </div>
                )}
                <div className="calendar-event-slot-info">
                  {event.slotCapacity || 0} per slot • {event.currentParticipants || 0} registered
                </div>
              </div>
            ))}
            {dayEvents.length > 2 && (
              <div className="calendar-event-more">
                +{dayEvents.length - 2} more
              </div>
            )}
          </div>
        </div>
      );

      // Start new week
      if ((startingDayOfWeek + day) % 7 === 0) {
        weeks.push(<div key={`week-${weeks.length}`} className="calendar-week">{days}</div>);
        days = [];
      }
    }

    // Add remaining days for next month
    if (days.length > 0) {
      const remainingDays = 7 - days.length;
      for (let i = 1; i <= remainingDays; i++) {
        const nextMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i);
        days.push(
          <div key={`next-${i}`} className="calendar-day calendar-day-other">
            <span className="calendar-day-number">{nextMonthDate.getDate()}</span>
          </div>
        );
      }
      weeks.push(<div key={`week-${weeks.length}`} className="calendar-week">{days}</div>);
    }

    return weeks;
  };

  if (loading) {
    return (
      <Layout onNavigate={onNavigate} currentPage="manage-events-slots">
        <div className="loading-container">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <p className="loading-text">Loading events...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Calculate summary
  const summary = calculateSummary();

  return (
    <Layout onNavigate={onNavigate} currentPage="manage-events-slots">
      <div className="manage-events-slots-wrapper">
        {/* Calendar Section */}
        <div className="event-calendar-section">
          <div className="calendar-controls">
            <div className="calendar-button-group">
              <button className="today-button" onClick={goToToday}>
                Today
              </button>
              <button className="add-event-button" onClick={() => setShowAddModal(true)}>
                <Plus className="w-5 h-5" />
                Add Event
              </button>
            </div>
            <div className="calendar-navigation">
              <button className="nav-button" onClick={previousPeriod}>
                <ChevronLeft className="nav-icon" />
              </button>
              <h2 className="calendar-month-year">
                {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
              <button className="nav-button" onClick={nextPeriod}>
                <ChevronRight className="nav-icon" />
              </button>
            </div>
            <div className="view-mode-buttons">
              <button
                className={`view-button ${viewMode === 'day' ? 'view-button-active' : ''}`}
                onClick={() => setViewMode('day')}
              >
                Day
              </button>
              <button
                className={`view-button ${viewMode === 'week' ? 'view-button-active' : ''}`}
                onClick={() => setViewMode('week')}
              >
                Week
              </button>
              <button
                className={`view-button ${viewMode === 'month' ? 'view-button-active' : ''}`}
                onClick={() => setViewMode('month')}
              >
                Month
              </button>
            </div>
          </div>

          <div className="calendar-container">
            {viewMode === 'month' && (
              <>
                <div className="calendar-header">
                  {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => (
                    <div key={day} className="calendar-header-cell">{day}</div>
                  ))}
                </div>
                <div className="calendar-body">
                  {renderMonthView()}
                </div>
              </>
            )}
            {viewMode === 'week' && renderWeekView()}
            {viewMode === 'day' && renderDayView()}
          </div>

          {/* Events for Selected Date */}
          {selectedDate && viewMode === 'month' && (
            <div className="date-info-panel">
              <h3 className="date-info-title">
                <Calendar className="w-5 h-5" />
                Events on {selectedDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </h3>
              {getEventsForDate(selectedDate).length > 0 ? (
                <div className="space-y-2">
                  {getEventsForDate(selectedDate).map(event => (
                    <div
                      key={event.id}
                      className="p-3 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => {
                        setSelectedEvent(event);
                        setShowEventDetails(true);
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold text-gray-900">{event.title}</div>
                          <div className="text-sm text-gray-600">
                            {event.startTime} - {event.endTime} • {event.location}
                          </div>
                          {event.assignedHospitalName && (
                            <div className="text-sm text-blue-600 font-medium mt-1 flex items-center">
                              <Building className="w-3 h-3 mr-1" />
                              Destination: {event.assignedHospitalName}
                            </div>
                          )}
                          <div className="text-sm text-gray-500 mt-1">
                            Registered: {event.currentParticipants || 0}/{event.expectedCapacity} • 
                            Slot Capacity: {event.slotCapacity || 0}
                          </div>
                        </div>
                        <button
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenSlotsModal(event);
                          }}
                        >
                          View Slots
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="date-info-empty">No events scheduled for this date.</p>
              )}
            </div>
          )}
        </div>

        {/* Add Event Modal */}
        {showAddModal && (
          <div className="event-modal-overlay" onClick={() => { setShowAddModal(false); resetForm(); }}>
            <div className="event-modal-container" onClick={e => e.stopPropagation()}>
              <div className="event-modal-header">
                <h2 className="event-modal-title">Add New Blood Drive Event</h2>
                <button className="event-modal-close" onClick={() => { setShowAddModal(false); resetForm(); }}>
                  <X className="close-icon" />
                </button>
              </div>

              <div className="event-modal-body">
                <div className="event-form">
                  <div className="form-group">
                    <label className="form-label required">Event Title *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Blood Donation Drive"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="form-group-inline">
                    <div className="form-group-small">
                      <label className="form-label required">Start Date *</label>
                      <input
                        type="date"
                        className="form-input"
                        value={formData.startDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group-small">
                      <label className="form-label required">Start Time *</label>
                      <input
                        type="time"
                        className="form-input"
                        value={formData.startTime}
                        onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group-inline">
                    <div className="form-group-small">
                      <label className="form-label required">End Date *</label>
                      <input
                        type="date"
                        className="form-input"
                        value={formData.endDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group-small">
                      <label className="form-label required">End Time *</label>
                      <input
                        type="time"
                        className="form-input"
                        value={formData.endTime}
                        onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  {/* DESTINATION HOSPITAL (Compulsary) */}
                  <div className="form-group" ref={destinationDropdownRef}>
                    <label className="form-label required">Destination Hospital *</label>
                    <div className="hospital-search-container">
                      <div className="hospital-search-input-wrapper">
                        <Search className="hospital-search-icon" />
                        <input
                          type="text"
                          className="hospital-search-input"
                          placeholder="Search and select destination hospital..."
                          value={destinationSearch}
                          onChange={(e) => {
                            setDestinationSearch(e.target.value);
                            filterDestinationHospitals(e.target.value);
                            setShowDestinationDropdown(true);
                          }}
                          onFocus={() => setShowDestinationDropdown(true)}
                          required
                        />
                        {destinationSearch && (
                          <button
                            className="hospital-clear-button"
                            onClick={handleClearDestinationHospital}
                            type="button"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          className="hospital-dropdown-button"
                          onClick={() => setShowDestinationDropdown(!showDestinationDropdown)}
                          type="button"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {showDestinationDropdown && filteredHospitals.length > 0 && (
                        <div className="hospital-dropdown">
                          <div className="hospital-dropdown-header">
                            <span className="hospital-dropdown-title">Select Destination Hospital</span>
                            <span className="hospital-dropdown-count">
                              {filteredHospitals.length} hospital{filteredHospitals.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="hospital-dropdown-list">
                            {filteredHospitals.map((hospital) => (
                              <div
                                key={hospital.id}
                                className={`hospital-dropdown-item ${formData.assignedHospitalId === hospital.id ? 'hospital-dropdown-item-selected' : ''}`}
                                onClick={() => handleDestinationHospitalSelect(hospital)}
                              >
                                <div className="hospital-item-main">
                                  <Building className="hospital-item-icon" />
                                  <div className="hospital-item-details">
                                    <span className="hospital-item-name">{hospital.name}</span>
                                    <span className="hospital-item-location">
                                      {hospital.city}, {hospital.state}
                                    </span>
                                  </div>
                                </div>
                                {formData.assignedHospitalId === hospital.id && (
                                  <div className="hospital-item-check">
                                    ✓
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          {destinationSearch && filteredHospitals.length === 0 && (
                            <div className="hospital-no-results">
                              No hospitals found for "{destinationSearch}"
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="capacity-info">
                      Blood collected at this event will be sent to this hospital
                    </p>
                  </div>

                  {/* EVENT LOCATION (Optional with hospital search) */}
                  <div className="form-group" ref={locationDropdownRef}>
                    <label className="form-label">Event Location</label>
                    
                    {/* Location Type Toggle */}
                    <div className="flex gap-2 mb-3">
                      <button
                        type="button"
                        className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${isEventAtHospital ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                        onClick={() => handleLocationTypeChange('hospital')}
                      >
                        <Building className="inline w-4 h-4 mr-2" />
                        Hospital Venue
                      </button>
                      <button
                        type="button"
                        className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${!isEventAtHospital ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                        onClick={() => handleLocationTypeChange('other')}
                      >
                        <MapPin className="inline w-4 h-4 mr-2" />
                        Other Venue
                      </button>
                    </div>

                    {/* Location Input with Hospital Search */}
                    {isEventAtHospital ? (
                      <div className="hospital-search-container">
                        <div className="hospital-search-input-wrapper">
                          <Search className="hospital-search-icon" />
                          <input
                            type="text"
                            className="hospital-search-input"
                            placeholder="Search for hospital venue (type 'hospital', 'clinic', etc.)..."
                            value={locationSearch}
                            onChange={(e) => {
                              setLocationSearch(e.target.value);
                              filterLocationHospitals(e.target.value);
                              setShowLocationDropdown(true);
                              handleLocationInputChange(e.target.value);
                            }}
                            onFocus={() => {
                              if (locationSearch) {
                                setShowLocationDropdown(true);
                              }
                            }}
                          />
                          {locationSearch && (
                            <button
                              className="hospital-clear-button"
                              onClick={handleClearLocationHospital}
                              type="button"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            className="hospital-dropdown-button"
                            onClick={() => setShowLocationDropdown(!showLocationDropdown)}
                            type="button"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {showLocationDropdown && filteredLocationHospitals.length > 0 && (
                          <div className="hospital-dropdown">
                            <div className="hospital-dropdown-header">
                              <span className="hospital-dropdown-title">Select Hospital Venue</span>
                              <span className="hospital-dropdown-count">
                                {filteredLocationHospitals.length} hospital{filteredLocationHospitals.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="hospital-dropdown-list">
                              {filteredLocationHospitals.map((hospital) => (
                                <div
                                  key={hospital.id}
                                  className={`hospital-dropdown-item ${formData.locationHospitalId === hospital.id ? 'hospital-dropdown-item-selected' : ''}`}
                                  onClick={() => handleLocationHospitalSelect(hospital)}
                                >
                                  <div className="hospital-item-main">
                                    <Building className="hospital-item-icon" />
                                    <div className="hospital-item-details">
                                      <span className="hospital-item-name">{hospital.name}</span>
                                      <span className="hospital-item-location">
                                        {hospital.address}, {hospital.city}
                                      </span>
                                    </div>
                                  </div>
                                  {formData.locationHospitalId === hospital.id && (
                                    <div className="hospital-item-check">
                                      ✓
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                            {locationSearch && filteredLocationHospitals.length === 0 && (
                              <div className="hospital-no-results">
                                No hospitals found for "{locationSearch}"
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Enter venue address (e.g., University Hall, Shopping Mall, Community Center...)"
                        value={formData.location}
                        onChange={(e) => handleLocationInputChange(e.target.value)}
                      />
                    )}
                    <p className="capacity-info">
                      {isEventAtHospital 
                        ? "Select a hospital if event is held at a hospital/clinic" 
                        : "Enter venue details for non-hospital locations"}
                    </p>
                  </div>

                  {/* Slot Capacity */}
                  <div className="form-group">
                    <label className="form-label required">Max Donors per 30-min Slot *</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="10"
                      value={formData.slotCapacity}
                      onChange={(e) => setFormData(prev => ({ ...prev, slotCapacity: e.target.value }))}
                      min="1"
                      required
                    />
                    <p className="capacity-info">
                      Maximum number of donors allowed in each 30-minute time slot
                    </p>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Total Expected Capacity</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="100"
                      value={formData.expectedCapacity}
                      onChange={(e) => setFormData(prev => ({ ...prev, expectedCapacity: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Organizer Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="BloodConnect Team, University Club, Hospital Staff, etc."
                      value={formData.organizerName}
                      onChange={(e) => setFormData(prev => ({ ...prev, organizerName: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-input"
                      rows="3"
                      placeholder="Event description, special instructions, target donors, etc."
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="event-modal-actions">
                  <button
                    className="modal-button cancel-button"
                    onClick={() => { setShowAddModal(false); resetForm(); }}
                  >
                    Cancel
                  </button>
                  <button
                    className="modal-button save-button"
                    onClick={handleAddEvent}
                  >
                    Create Event
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Event Modal */}
        {showEditModal && selectedEvent && (
          <div className="event-modal-overlay" onClick={() => setShowEditModal(false)}>
            <div className="event-modal-container" onClick={e => e.stopPropagation()}>
              <div className="event-modal-header">
                <h2 className="event-modal-title">Edit Event</h2>
                <button className="event-modal-close" onClick={() => setShowEditModal(false)}>
                  <X className="close-icon" />
                </button>
              </div>

              <div className="event-modal-body">
                <div className="event-form">
                  <div className="form-group">
                    <label className="form-label required">Event Title *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="form-group-inline">
                    <div className="form-group-small">
                      <label className="form-label required">Start Date *</label>
                      <input
                        type="date"
                        className="form-input"
                        value={formData.startDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group-small">
                      <label className="form-label required">Start Time *</label>
                      <input
                        type="time"
                        className="form-input"
                        value={formData.startTime}
                        onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group-inline">
                    <div className="form-group-small">
                      <label className="form-label required">End Date *</label>
                      <input
                        type="date"
                        className="form-input"
                        value={formData.endDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group-small">
                      <label className="form-label required">End Time *</label>
                      <input
                        type="time"
                        className="form-input"
                        value={formData.endTime}
                        onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  {/* DESTINATION HOSPITAL in Edit Modal */}
                  <div className="form-group" ref={destinationDropdownRef}>
                    <label className="form-label required">Destination Hospital *</label>
                    <div className="hospital-search-container">
                      <div className="hospital-search-input-wrapper">
                        <Search className="hospital-search-icon" />
                        <input
                          type="text"
                          className="hospital-search-input"
                          placeholder="Search and select destination hospital..."
                          value={destinationSearch}
                          onChange={(e) => {
                            setDestinationSearch(e.target.value);
                            filterDestinationHospitals(e.target.value);
                            setShowDestinationDropdown(true);
                          }}
                          onFocus={() => setShowDestinationDropdown(true)}
                          required
                        />
                        {destinationSearch && (
                          <button
                            className="hospital-clear-button"
                            onClick={handleClearDestinationHospital}
                            type="button"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          className="hospital-dropdown-button"
                          onClick={() => setShowDestinationDropdown(!showDestinationDropdown)}
                          type="button"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {showDestinationDropdown && filteredHospitals.length > 0 && (
                        <div className="hospital-dropdown">
                          <div className="hospital-dropdown-header">
                            <span className="hospital-dropdown-title">Select Destination Hospital</span>
                            <span className="hospital-dropdown-count">
                              {filteredHospitals.length} hospital{filteredHospitals.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="hospital-dropdown-list">
                            {filteredHospitals.map((hospital) => (
                              <div
                                key={hospital.id}
                                className={`hospital-dropdown-item ${formData.assignedHospitalId === hospital.id ? 'hospital-dropdown-item-selected' : ''}`}
                                onClick={() => handleDestinationHospitalSelect(hospital)}
                              >
                                <div className="hospital-item-main">
                                  <Building className="hospital-item-icon" />
                                  <div className="hospital-item-details">
                                    <span className="hospital-item-name">{hospital.name}</span>
                                    <span className="hospital-item-location">
                                      {hospital.city}, {hospital.state}
                                    </span>
                                  </div>
                                </div>
                                {formData.assignedHospitalId === hospital.id && (
                                  <div className="hospital-item-check">
                                    ✓
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* EVENT LOCATION in Edit Modal */}
                  <div className="form-group" ref={locationDropdownRef}>
                    <label className="form-label">Event Location</label>
                    
                    <div className="flex gap-2 mb-3">
                      <button
                        type="button"
                        className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${isEventAtHospital ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                        onClick={() => handleLocationTypeChange('hospital')}
                      >
                        <Building className="inline w-4 h-4 mr-2" />
                        Hospital Venue
                      </button>
                      <button
                        type="button"
                        className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${!isEventAtHospital ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                        onClick={() => handleLocationTypeChange('other')}
                      >
                        <MapPin className="inline w-4 h-4 mr-2" />
                        Other Venue
                      </button>
                    </div>

                    {isEventAtHospital ? (
                      <div className="hospital-search-container">
                        <div className="hospital-search-input-wrapper">
                          <Search className="hospital-search-icon" />
                          <input
                            type="text"
                            className="hospital-search-input"
                            placeholder="Search for hospital venue..."
                            value={locationSearch}
                            onChange={(e) => {
                              setLocationSearch(e.target.value);
                              filterLocationHospitals(e.target.value);
                              setShowLocationDropdown(true);
                              handleLocationInputChange(e.target.value);
                            }}
                            onFocus={() => {
                              if (locationSearch) {
                                setShowLocationDropdown(true);
                              }
                            }}
                          />
                          {locationSearch && (
                            <button
                              className="hospital-clear-button"
                              onClick={handleClearLocationHospital}
                              type="button"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            className="hospital-dropdown-button"
                            onClick={() => setShowLocationDropdown(!showLocationDropdown)}
                            type="button"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {showLocationDropdown && filteredLocationHospitals.length > 0 && (
                          <div className="hospital-dropdown">
                            <div className="hospital-dropdown-list">
                              {filteredLocationHospitals.map((hospital) => (
                                <div
                                  key={hospital.id}
                                  className={`hospital-dropdown-item ${formData.locationHospitalId === hospital.id ? 'hospital-dropdown-item-selected' : ''}`}
                                  onClick={() => handleLocationHospitalSelect(hospital)}
                                >
                                  <div className="hospital-item-main">
                                    <Building className="hospital-item-icon" />
                                    <div className="hospital-item-details">
                                      <span className="hospital-item-name">{hospital.name}</span>
                                      <span className="hospital-item-location">
                                        {hospital.address}, {hospital.city}
                                      </span>
                                    </div>
                                  </div>
                                  {formData.locationHospitalId === hospital.id && (
                                    <div className="hospital-item-check">
                                      ✓
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Enter venue address..."
                        value={formData.location}
                        onChange={(e) => handleLocationInputChange(e.target.value)}
                      />
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label required">Max Donors per 30-min Slot *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.slotCapacity}
                      onChange={(e) => setFormData(prev => ({ ...prev, slotCapacity: e.target.value }))}
                      min="1"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Total Expected Capacity</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.expectedCapacity}
                      onChange={(e) => setFormData(prev => ({ ...prev, expectedCapacity: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Organizer Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.organizerName}
                      onChange={(e) => setFormData(prev => ({ ...prev, organizerName: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-input"
                      rows="3"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                      className="form-select"
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    >
                      <option value="active">Active</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>

                <div className="event-modal-actions">
                  <button
                    className="modal-button cancel-button"
                    onClick={() => setShowEditModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="modal-button save-button"
                    onClick={handleSaveEdit}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Event Details Modal */}
        {showEventDetails && selectedEvent && (
          <div className="event-modal-overlay" onClick={() => setShowEventDetails(false)}>
            <div className="event-modal-container event-details-modal" onClick={e => e.stopPropagation()}>
              <div className="event-modal-header">
                <h2 className="event-modal-title">{selectedEvent.title}</h2>
                <button className="event-modal-close" onClick={() => setShowEventDetails(false)}>
                  <X className="close-icon" />
                </button>
              </div>
              <div className="event-modal-body">
                <div className="event-details">
                  <div className="event-detail-item">
                    <Calendar className="detail-icon" />
                    <div>
                      <p className="font-semibold">Date</p>
                      <p className="text-sm text-gray-600">
                        {selectedEvent.startDate} {selectedEvent.startDate !== selectedEvent.endDate ? `to ${selectedEvent.endDate}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="event-detail-item">
                    <Clock className="detail-icon" />
                    <div>
                      <p className="font-semibold">Time</p>
                      <p className="text-sm text-gray-600">
                        {selectedEvent.startTime} - {selectedEvent.endTime}
                      </p>
                    </div>
                  </div>

                  <div className="event-detail-item">
                    <MapPin className="detail-icon" />
                    <div>
                      <p className="font-semibold">Location</p>
                      <p className="text-sm text-gray-600">{selectedEvent.location}</p>
                    </div>
                  </div>

                  {selectedEvent.assignedHospitalName && (
                    <div className="event-detail-item">
                      <div className="detail-icon bg-blue-100 text-blue-600 rounded-full p-2">
                        <Building className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold">Destination Hospital</p>
                        <p className="text-sm text-gray-600">{selectedEvent.assignedHospitalName}</p>
                      </div>
                    </div>
                  )}

                  {selectedEvent.locationType === 'hospital' && selectedEvent.locationHospitalName && (
                    <div className="event-detail-item">
                      <div className="detail-icon bg-green-100 text-green-600 rounded-full p-2">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold">Venue Hospital</p>
                        <p className="text-sm text-gray-600">{selectedEvent.locationHospitalName}</p>
                      </div>
                    </div>
                  )}

                  <div className="event-detail-item">
                    <User className="detail-icon" />
                    <div>
                      <p className="font-semibold">Organizer</p>
                      <p className="text-sm text-gray-600">{selectedEvent.organizerName}</p>
                    </div>
                  </div>

                  <div className="event-detail-item">
                    <Users className="detail-icon" />
                    <div>
                      <p className="font-semibold">Capacity</p>
                      <p className="text-sm text-gray-600">
                        Registered: {selectedEvent.currentParticipants || 0} / {selectedEvent.expectedCapacity}
                      </p>
                      <p className="text-sm text-gray-600">
                        Per Slot: {selectedEvent.slotCapacity || 0} donors per 30 minutes
                      </p>
                    </div>
                  </div>
                </div>

                {selectedEvent.description && (
                  <div className="event-description mt-4">
                    <h3 className="font-semibold text-gray-800 mb-2">Description</h3>
                    <p className="text-gray-700">{selectedEvent.description}</p>
                  </div>
                )}

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <button
                    className="w-full py-3 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center justify-center gap-2"
                    onClick={() => handleOpenSlotsModal(selectedEvent)}
                  >
                    <Clock className="w-5 h-5" />
                    View Time Slots & Bookings
                  </button>
                </div>

                <div className="event-modal-actions mt-4">
                  <button
                    className="modal-button cancel-button"
                    onClick={() => {
                      setShowDeleteConfirm(true);
                      setShowEventDetails(false);
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Event
                  </button>
                  <button
                    className="modal-button save-button"
                    onClick={() => handleEditEvent(selectedEvent)}
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    Edit Event
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="event-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
            <div className="event-modal-container delete-modal" onClick={e => e.stopPropagation()}>
              <div className="donation-confirm-icon-container">
                <AlertCircle className="donation-confirm-icon" />
              </div>
              <h3 className="donation-confirm-title">Delete Event</h3>
              <p className="donation-confirm-message">
                Are you sure you want to delete "{selectedEvent?.title}"? This action cannot be undone.
              </p>
              <div className="donation-confirm-actions">
                <button className="donation-confirm-button donation-confirm-cancel" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </button>
                <button className="donation-confirm-button donation-confirm-delete" onClick={handleDeleteEvent}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Slots Management Modal */}
        {showSlotsModal && selectedEventForSlots && (
          <div className="event-modal-overlay" onClick={() => setShowSlotsModal(false)}>
            <div className="event-modal-container slots-modal" onClick={e => e.stopPropagation()}>
              <div className="event-modal-header">
                <h2 className="event-modal-title">Time Slots Management</h2>
                <button className="event-modal-close" onClick={() => setShowSlotsModal(false)}>
                  <X className="close-icon" />
                </button>
              </div>
              <div className="event-modal-body">
                {/* Event Info */}
                <div className="slots-event-info">
                  <h3 className="text-lg font-bold text-gray-800 mb-2">{selectedEventForSlots.title}</h3>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>{selectedEventForSlots.startDate} {selectedEventForSlots.startDate !== selectedEventForSlots.endDate ? `to ${selectedEventForSlots.endDate}` : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>{selectedEventForSlots.startTime} - {selectedEventForSlots.endTime}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span>{selectedEventForSlots.location}</span>
                    </div>
                    {selectedEventForSlots.assignedHospitalName && (
                      <div className="flex items-center gap-2 text-blue-600">
                        <Building className="w-4 h-4" />
                        <span>Destination: {selectedEventForSlots.assignedHospitalName}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>Slot Capacity: {selectedEventForSlots.slotCapacity} donors per 30 minutes</span>
                    </div>
                  </div>
                </div>

                {/* Slots List */}
                <div className="slots-list-section mt-6">
                  <h3 className="slots-list-title">30-Minute Time Slots</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Auto-generated slots within event duration. Each slot allows maximum {selectedEventForSlots.slotCapacity} donors.
                  </p>
                  
                  {timeSlots.length === 0 ? (
                    <div className="no-slots">
                      <Clock className="no-slots-icon" />
                      <p>No time slots available or event times not set.</p>
                    </div>
                  ) : (
                    <div className="slots-grid">
                      {timeSlots.map((slot, index) => (
                        <div key={index} className={`slot-card ${slot.isFull ? 'slot-full' : 'slot-available'}`}>
                          <div className="slot-header">
                            <div className="slot-time">
                              <Clock className="slot-time-icon" />
                              <span className="slot-time-text">{slot.displayTime}</span>
                            </div>
                            <span className={`slot-status-badge ${slot.isFull ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                              {slot.isFull ? 'FULL' : 'AVAILABLE'}
                            </span>
                          </div>
                          
                          <div className="slot-details">
                            <div className="slot-capacity">
                              <Users className="slot-detail-icon" />
                              <span>Booked: {slot.bookedCount} / {slot.capacity}</span>
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              Available: {slot.availableSlots} slots
                            </div>
                            
                            {slot.bookedCount > 0 && (
                              <button
                                className="view-donors-button"
                                onClick={() => {
                                  setSelectedSlot(slot);
                                }}
                              >
                                View {slot.bookedCount} Donor{slot.bookedCount !== 1 ? 's' : ''}
                              </button>
                            )}
                          </div>
                          
                          <div className="slot-progress">
                            <div 
                              className="slot-progress-bar"
                              style={{ 
                                width: `${Math.min((slot.bookedCount / slot.capacity) * 100, 100)}%`,
                                backgroundColor: slot.isFull ? '#ef4444' : '#3b82f6'
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Donor Details for Selected Slot */}
                {selectedSlot && (
                  <div className="slot-details-expanded">
                    <h4 className="font-semibold text-gray-800 mb-3">Donors for {selectedSlot.displayTime}</h4>
                    <div className="booking-list">
                      {selectedSlot.bookings.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">No bookings for this slot</p>
                      ) : (
                        selectedSlot.bookings.map(booking => {
                          const donor = donorDetails[booking.userId];
                          return (
                            <div key={booking.id} className="booking-item">
                              <div className="donor-avatar">
                                {donor?.donor?.full_name?.charAt(0) || '?'}
                              </div>
                              <div className="booking-info">
                                <div className="donor-name">
                                  {donor?.donor?.full_name || 'Unknown Donor'}
                                </div>
                                <div className="donor-details">
                                  <span>Blood Type: {donor?.donor?.blood_group || 'Unknown'}</span>
                                  <span>•</span>
                                  <span>Status: {booking.bookingStatus}</span>
                                </div>
                              </div>
                              <span className={`booking-status ${booking.bookingStatus === 'confirmed' ? 'booking-status-confirmed' : 'booking-status-pending'}`}>
                                {booking.bookingStatus}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <button
                      className="w-full mt-3 py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                      onClick={() => setSelectedSlot(null)}
                    >
                      Close
                    </button>
                  </div>
                )}

                {/* Summary */}
                <div className="slots-summary mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-semibold text-gray-800 mb-2">Summary</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Total Slots:</p>
                      <p className="font-semibold">{summary.totalSlots}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Available Slots:</p>
                      <p className="font-semibold text-green-600">
                        {summary.availableSlots}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Full Slots:</p>
                      <p className="font-semibold text-red-600">
                        {summary.fullSlots}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Total Bookings:</p>
                      <p className="font-semibold">
                        {summary.totalBookings}
                      </p>
                    </div>
                  </div>
                  {summary.totalBookings !== summary.totalBookedInSlots && (
                    <div className="mt-2 p-2 bg-yellow-50 text-yellow-700 text-xs rounded">
                      <AlertCircle className="inline w-3 h-3 mr-1" />
                      Note: Some bookings ({summary.totalBookings - summary.totalBookedInSlots}) don't match slot times
                    </div>
                  )}
                </div>

                <div className="event-modal-actions mt-6">
                  <button 
                    className="modal-button save-button"
                    onClick={() => setShowSlotsModal(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ManageEventsSlots;