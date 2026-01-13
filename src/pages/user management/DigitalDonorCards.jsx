import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'dart:async';
import 'donation_page.dart';
import 'blood_drive_page.dart';
import 'notification_page.dart';
import 'find_donors_page.dart';
import '../widget/digital_donor_card.dart';
import '../widget/announcement.dart';
import 'myreward_page.dart';
import '../widget/bottom_navigation_bar.dart';
import '../navigation_helper.dart';
import '../widget/header.dart';
import 'community_page.dart';
import 'snapnshare_page.dart';
import 'donate_now_page.dart';
import 'status_page.dart';
import '../widget/raise_awareness.dart';
import 'package:bloodconnect/user_session.dart';
import 'package:bloodconnect/blood_stock_service.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

// Import the new services
import '../announcement_data_service.dart';
import '../event_service.dart';
import '../team_service.dart';

class HomePage extends StatefulWidget {
  const HomePage({ super.key });

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  // ----- SESSION START ----- //
  Map<String, dynamic>?userData;
  bool isLoading = true;

  // Add state variables for dynamic data
  List<Map<String, dynamic>> _announcements =[];
List < Map < String, dynamic >> _upcomingEvents =[];
List < Map < String, dynamic >> _communityTeams =[];
  bool _isLoadingAnnouncements = true;
  bool _isLoadingEvents = true;
  bool _isLoadingTeams = true;

@override
void initState() {
  super.initState();

  // Add listeners for page changes to update indicators
  _announcementController.addListener(() {
    if (_announcementController.page?.round() != _currentAnnouncementIndex) {
      setState(() {
        _currentAnnouncementIndex = _announcementController.page!.round();
      });
    }
  });

  _bloodDriveController.addListener(() {
    if (_bloodDriveController.page?.round() != _currentBloodDriveIndex) {
      setState(() {
        _currentBloodDriveIndex = _bloodDriveController.page!.round();
      });
    }
  });

  // Start auto-sliding timers - FIXED
  _startAutoSlideTimers();

  // Initialize blood stock data
  _initializeBloodStock();

  // Get user data
  getUserData();

  // Fetch dynamic data
  _fetchAnnouncements();
  _fetchUpcomingEvents();
  _fetchCommunityTeams();
}

// Get user data using helper class
getUserData() async {
  Map < String, dynamic >? user = await UserSession.getUser();
  print('=== USER SESSION DATA ===');
  print(user);
  print('==========================');

  setState(() {
    userData = user;
    isLoading = false;
  });

  // Optional: Check if user data exists
  if (user == null) {
    // ignore: use_build_context_synchronously
    ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No user session found')),
      );
  }
}

  // ----- SESSION END ----- //

  // Add controllers for sliding sections
  final PageController _announcementController = PageController();
  final PageController _bloodDriveController = PageController();
  
  int _currentAnnouncementIndex = 0;
  int _currentBloodDriveIndex = 0;
  int _selectedNavIndex = 0;

  // Add scroll controller for community section
  final ScrollController _communityScrollController = ScrollController();
  
  String get fullName => userData ? ['full_name'] ?? 'Not provided';
  String get idNumber => userData ? ['id_number'] ?? 'Not provided';
  String get bloodType => userData ? ['blood_group'] ?? 'Not provided';
  String get qrCode => userData ? ['qr_code_data'] ?? '';
  String get userId => userData ? ['user_id'] ??
  userData ? ['userId'] ??
    userData ? ['uid'] ??
      userData ? ['id'] ??
'';

  // Add timers for auto-sliding
  // ignore: unused_field
  late Timer _announcementTimer;
  late Timer _bloodDriveTimer;

  // Add these new variables for blood stock
  String _selectedLocation = 'National Blood Center';
Map < String, dynamic >? _currentBloodStock;
List < String > _availableLocations =[];

  // Add method to get user initials from full name
  String _getUserInitials() {
  List < String > nameParts = fullName.trim().split(' ');

  if (nameParts.isEmpty) return 'U';

  if (nameParts.length == 1) {
    return nameParts[0].substring(0, 1).toUpperCase();
  }

    // Take first letter of first name and first letter of last name
    String firstInitial = nameParts.first.substring(0, 1).toUpperCase();
    String lastInitial = nameParts.last.substring(0, 1).toUpperCase();

  return '$firstInitial$lastInitial';
}

// NEW: Fetch announcements from Firestore
Future < void> _fetchAnnouncements() async {
  try {
    setState(() {
      _isLoadingAnnouncements = true;
    });

final announcements = await AnnouncementDataService.getActiveAnnouncements();


    setState(() {
      _announcements = announcements;
      _isLoadingAnnouncements = false;
    });
  } catch (e) {
    print('Error loading announcements: $e');
    setState(() {
      _isLoadingAnnouncements = false;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Failed to load announcements: ${e.toString()}'),
        backgroundColor: Colors.red,
        duration: const Duration(seconds: 3),
        ),
      );
  }
}

// NEW: Fetch upcoming events from Firestore
Future < void> _fetchUpcomingEvents() async {
  try {
    setState(() {
      _isLoadingEvents = true;
    });

      final events = await EventService.getUpcomingEvents();

    setState(() {
      _upcomingEvents = events;
      _isLoadingEvents = false;
    });
  } catch (e) {
    print('Error loading events: $e');
    setState(() {
      _isLoadingEvents = false;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Failed to load events: ${e.toString()}'),
        backgroundColor: Colors.red,
        duration: const Duration(seconds: 3),
        ),
      );
  }
}

// NEW: Fetch community teams from Firestore
Future < void> _fetchCommunityTeams() async {
  try {
    setState(() {
      _isLoadingTeams = true;
    });

      final teams = await TeamService.getActiveTeams();

    setState(() {
      _communityTeams = teams;
      _isLoadingTeams = false;
    });
  } catch (e) {
    print('Error loading teams: $e');
    setState(() {
      _isLoadingTeams = false;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Failed to load teams: ${e.toString()}'),
        backgroundColor: Colors.red,
        duration: const Duration(seconds: 3),
        ),
      );
  }
}

void _initializeBloodStock() async {
  try {
    print('🩸 Starting blood stock initialization...');

      // Fetch locations from Firebase
      final locations = await BloodStockService.getAvailableLocations();
    print('📍 Available locations: $locations');
    print('📍 Number of locations: ${locations.length}');

    if (locations.isEmpty) {
      print('⚠️ No locations found in database');

      // Show user-friendly message
      if (mounted) {
        setState(() {
          _availableLocations = [];
          _selectedLocation = '';
          _currentBloodStock = null;
        });

        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
          content: Text('No blood bank locations available. Please check your connection.'),
            backgroundColor: Colors.orange,
              duration: const Duration(seconds: 3),
            ),
          );
      }
      return;
    }

    // Set state with locations first
    if (mounted) {
      setState(() {
        _availableLocations = locations;
        _selectedLocation = locations[0];
      });
    }

    print('✅ Selected location: $_selectedLocation');

    // Add a small delay to ensure UI updates
    await Future.delayed(const Duration(milliseconds: 100));

      // Fetch blood stock data for the first location
      final bloodStock = await BloodStockService.getBloodStockByLocation(_selectedLocation);
    print('🩸 Blood stock data received: ${bloodStock != null ? "YES" : "NO"}');

    if (bloodStock != null) {
      print('📊 Blood stock keys: ${bloodStock.keys.toList()}');
      if (bloodStock.containsKey('blood_types')) {
        print('📊 Blood types in data:');
          final bloodTypes = bloodStock['blood_types'] as Map<String, dynamic>;
        bloodTypes.forEach((key, value) {
          print('   $key: $value');
        });
      } else {
        print('⚠️ blood_types key not found in data');
      }
    }

    if (mounted) {
      setState(() {
        _currentBloodStock = bloodStock;
      });
    }

    if (bloodStock == null) {
      print('⚠️ No blood stock data for $_selectedLocation');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('No blood stock data for $_selectedLocation'),
            backgroundColor: Colors.orange,
            duration: const Duration(seconds: 2),
            ),
          );
      }
    } else {
      print('✅ Blood stock loaded successfully!');
    }
  } catch (e, stackTrace) {
    print('❌ Error initializing blood stock: $e');
    print('Stack trace: $stackTrace');

    if (mounted) {
      setState(() {
        _availableLocations = [];
        _selectedLocation = '';
        _currentBloodStock = null;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to load blood stock: ${e.toString()}'),
          backgroundColor: Colors.red,
          duration: const Duration(seconds: 4),
          ),
        );
    }
  }
}

// Add this method to handle location change
void _onLocationChanged(String ? newLocation) async {
  if (newLocation != null && newLocation.isNotEmpty) {
    print('🔄 Location changed to: $newLocation');

    setState(() {
      _selectedLocation = newLocation;
      _currentBloodStock = null; // Show loading while fetching
    });

    try {
        final newBloodStock = await BloodStockService.getBloodStockByLocation(newLocation);
      print('📊 Received data for $newLocation: ${newBloodStock != null ? "YES" : "NO"}');

      if (mounted) {
        setState(() {
          _currentBloodStock = newBloodStock;
        });
      }

      if (newBloodStock == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('No blood stock data available for $newLocation'),
              duration: const Duration(seconds: 2),
              ),
            );
        }
      }
    } catch (e) {
      print('❌ Error loading blood stock: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error loading data: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }
}

// Method to start auto-sliding timers
void _startAutoSlideTimers() {
  // Only start timers if we have data
  _bloodDriveTimer = Timer.periodic(const Duration(seconds: 7), (timer) {
    if (_bloodDriveController.hasClients && _upcomingEvents.isNotEmpty) {
      if (_currentBloodDriveIndex < _upcomingEvents.length - 1) {
        _bloodDriveController.animateToPage(
          _currentBloodDriveIndex + 1,
          duration: const Duration(milliseconds: 500),
            curve: Curves.easeInOut,
          );
      } else {
        _bloodDriveController.animateToPage(
          0,
          duration: const Duration(milliseconds: 500),
            curve: Curves.easeInOut,
          );
      }
    }
  });
}

@override
void dispose() {
  // Only cancel blood drive timer
  _bloodDriveTimer.cancel();

  // Dispose controllers
  _announcementController.dispose();
  _bloodDriveController.dispose();
  _communityScrollController.dispose();

  super.dispose();
}

// Simplified navigation handler that updates the selected index
void _updateNavIndex(int index) {
  setState(() {
    _selectedNavIndex = index;
  });
}

@override
  Widget build(BuildContext context) {
  return Scaffold(
    backgroundColor: Colors.grey[100],
    // Replace the inline AppBar with CustomHeader
    appBar: CustomHeader(
      appName: 'BloodConnect',
      userInitials: _getUserInitials(), // Use dynamic initials from profile
      onRewardsPressed: () {
        Navigator.push(
          context,
          MaterialPageRoute(builder: (context) => const MyRewardPage()),
        );
      },
      onNotificationsPressed: () {
        Navigator.push(
          context,
          MaterialPageRoute(builder: (context) => const NotificationPage()),
        );
      },
      // onProfilePressed can use default behavior from CustomHeader
    ),
    body: SafeArea(
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                // Digital Donor Card
                _buildDonorCard(),
                const SizedBox(height: 16),
    // Current Blood Stock
    _buildBloodStock(),
                const SizedBox(height: 16),
    // Announcements - now with dynamic data
    _buildAnnouncements(),
                const SizedBox(height: 16),
    // Upcoming Blood Drive - now with dynamic data
    _buildUpcomingBloodDrive(),
                const SizedBox(height: 16),
    // Action Buttons (First Row)
    _buildActionButtonsRow1(),
                const SizedBox(height: 16),
    // Find Donors, Book Appointment, Status, and Donate Now section
    _buildFindDonorsAndAppointment(),
                const SizedBox(height: 16),
    // Community Section - now with dynamic data
    _buildCommunity(),
                // Add padding at the bottom to avoid overlap with bottom navigation bar
                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
      ),
  bottomNavigationBar: CustomBottomNavigationBar(
    currentIndex: _selectedNavIndex,
    onTap: (index) => NavigationHelper.handleNavigation(context, index, _updateNavIndex),
  ),
    );
}

  // ---------------------------------------------------------------------------
  // SECTION: Digital Donor Card Widget (Home Screen)
  // ---------------------------------------------------------------------------
  // This method builds the card seen on the home screen.
  // It handles the tap event to trigger the detailed popup.
  Widget _buildDonorCard() {
  return DigitalDonorCardWidget(
    showQrCode: true,
    // When the user taps the card, we call _showDonorCardDetails to open the popup
    onTap: () {
      _showDonorCardDetails(context);
    },
  );
}

// ---------------------------------------------------------------------------
// SECTION: Digital Donor Card Popup Implementation
// ---------------------------------------------------------------------------
// This function displays the detailed popup dialog when the card is clicked.
void _showDonorCardDetails(BuildContext context) async {
    String lastDonationText = 'No donations yet';

  print('=== DEBUG: Donor Card Clicked ===');
  print('User data: $userData');
  print('User ID from getter: $userId');

  // DEBUG: Check all possible ID sources
  print('=== ID DEBUG INFO ===');
  print('QR Code: $qrCode');
  print('User ID from getter: "$userId" (length: ${userId.length})');
  print('User Data keys: ${userData?.keys.toList()}');

    // Try multiple methods to get user ID
    String effectiveUserId = '';

  // Method 1: Use the getter (existing method)
  if (userId.isNotEmpty) {
    effectiveUserId = userId;
    print('✅ Using user ID from getter: $effectiveUserId');
  }
  // Method 2: Extract from QR code
  else if (qrCode.isNotEmpty && qrCode.contains('BLOODCONNECT:USER:')) {
    effectiveUserId = qrCode.replaceFirst('BLOODCONNECT:USER:', '');
    print('✅ Using user ID from QR code: $effectiveUserId');
  }
  // Method 3: Check userData directly for various possible fields
  else if (userData != null) {
      // Check all possible field names that might contain the user ID
      final possibleIdFields = ['user_id', 'userId', 'uid', 'id', 'donor_id'];
    for (var field in possibleIdFields) {
      if (userData![field] != null) {
        effectiveUserId = userData![field].toString();
        print('✅ Found user ID in $field: $effectiveUserId');
        break;
      }
    }
  }

  if (effectiveUserId.isEmpty) {
    print('❌ Could not find any user ID!');
    print('   QR Code contains: ${qrCode.contains('BLOODCONNECT: USER: ')}');
    print('   userData is null: ${userData == null}');
  } else {
    print('🔍 Will query with effectiveUserId: $effectiveUserId');
  }

  if (effectiveUserId.isNotEmpty) {
    try {
      print('📋 Fetching donations for user ID: $effectiveUserId');
        final lastDonationDate = await _getLastDonationDate(effectiveUserId);

      if (lastDonationDate != null) {
        print('✅ Found donation: $lastDonationDate');
        lastDonationText = '${lastDonationDate.day}/${lastDonationDate.month}/${lastDonationDate.year}';
      } else {
        print('❌ No donations found for user ID: $effectiveUserId');

        // Additional debug: Try to find ANY donations for this user
        try {
            final FirebaseFirestore _firestore = FirebaseFirestore.instance;
            final testQuery = await _firestore
            .collection('donations')
            .where('donor_id', isEqualTo: effectiveUserId)
            .get();

          print('🔍 Test query found ${testQuery.docs.length} documents');
          for (var doc in testQuery.docs) {
            print('   - Document ID: ${doc.id}');
            print('     donor_id: ${doc.data()['donor_id']}');
            print('     status: ${doc.data()['status']}');
            print('     donation_date: ${doc.data()['donation_date']}');
          }
        } catch (e) {
          print('❌ Error in test query: $e');
        }
      }
    } catch (e) {
      print('❌ Error fetching last donation: $e');
      lastDonationText = 'Error loading';
    }
  } else {
    print('❌ No user ID available for donation query');
  }

  print('📝 Final last donation text: $lastDonationText');

  showDialog(
    context: context,
    builder: (BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
      child: Container(
        padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
          ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
      'Digital Donor Card',
      style: TextStyle(
        fontSize: 20,
        fontWeight: FontWeight.bold,
        color: Color(0xFFDE0D0D),
      ),
                ),
    const SizedBox(height: 20),

      Container(
        padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.grey.shade300),
          ),
            child: QrImageView(
              data: qrCode,
              version: QrVersions.auto,
              size: 200,
              backgroundColor: Colors.white,
              foregroundColor: const Color(0xFFDE0D0D),
                  ),
                ),
    const SizedBox(height: 20),

      Container(
        padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.grey[50],
            borderRadius: BorderRadius.circular(12),
          ),
            child: Column(
              children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                          const Text('Name:', style: TextStyle(fontWeight: FontWeight.bold)),
    Flexible(
      child: Text(
        fullName,
        textAlign: TextAlign.right,
        style: const TextStyle(fontSize: 14),
                            ),
                          ),
                        ],
                      ),
    const SizedBox(height: 8),
      Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
                          const Text('ID:', style: TextStyle(fontWeight: FontWeight.bold)),
    Text(idNumber),
                        ],
                      ),
    const SizedBox(height: 8),
      Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
                          const Text('Blood Type:', style: TextStyle(fontWeight: FontWeight.bold)),
    Text(
      bloodType,
      style: const TextStyle(color: Color(0xFFDE0D0D), fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
    const SizedBox(height: 8),
      Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
                          const Text('Last Donation:', style: TextStyle(fontWeight: FontWeight.bold)),
    Text(lastDonationText),
                        ],
                      ),
                    ],
                  ),
                ),
    const SizedBox(height: 20),

      ElevatedButton(
        onPressed: () => Navigator.of(context).pop(),
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFFDE0D0D),
            foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
                  ),
    child: const Text('Close'),
                ),
              ],
            ),
          ),
        );
  },
    );
}

Future < DateTime ?> _getLastDonationDate(String userId) async {
  try {
      final FirebaseFirestore _firestore = FirebaseFirestore.instance;

    print('🔍 [GET LAST DONATION] Querying donations for donor_id: "$userId"');
    print('🔍 User ID length: ${userId.length}');
    print('🔍 User ID type: ${userId.runtimeType}');

      // First, try a simple query without status filter
      final testQuery = await _firestore
      .collection('donations')
      .where('donor_id', isEqualTo: userId)
      .get();

    print('🔍 Simple query found ${testQuery.docs.length} documents');
    if (testQuery.docs.isNotEmpty) {
      for (var doc in testQuery.docs) {
          final data = doc.data();
        print('   📄 Document: ${doc.id}');
        print('     donor_id: ${data['donor_id']}');
        print('     status: ${data['status']}');
        print('     donation_date: ${data['donation_date']}');
        print('     amount_ml: ${data['amount_ml']}');
      }
    } else {
      print('❌ No documents found with donor_id: "$userId"');
      print('⚠️ Checking if collection exists...');

        // Check if donations collection has any documents
        final collectionCheck = await _firestore
        .collection('donations')
        .limit(1)
        .get();
      print('   Donations collection exists: ${collectionCheck.docs.isNotEmpty}');
    }

    // Now try the actual query with status filter
    print('🔍 [MAIN QUERY] Searching with status filter...');
      final querySnapshot = await _firestore
      .collection('donations')
      .where('donor_id', isEqualTo: userId)
      .where('status', whereIn: ['stored', 'completed'])
      .orderBy('donation_date', descending: true)
      .limit(1)
      .get();

    print('🔍 Main query returned ${querySnapshot.docs.length} documents');

    if (querySnapshot.docs.isEmpty) {
      print('❌ No donations found with donor_id: "$userId" and status "stored" or "completed"');
      return null;
    }

      final donationData = querySnapshot.docs.first.data() as Map<String, dynamic>;
    print('✅ Found donation data!');
    print('   Document keys: ${donationData.keys.toList()}');
      
      final donationDate = donationData['donation_date'];
    print('🔍 Donation date field type: ${donationDate.runtimeType}');
    print('🔍 Donation date value: $donationDate');

    if (donationDate is Timestamp) {
        final date = donationDate.toDate();
      print('✅ Converted to DateTime: $date');
      return date;
    } else if (donationDate is DateTime) {
      print('✅ Already DateTime: $donationDate');
      return donationDate;
    } else if (donationDate is String) {
      print('⚠️ Donation date is String, trying to parse');
      try {
          final date = DateTime.parse(donationDate);
        print('✅ Parsed from String: $date');
        return date;
      } catch (e) {
        print('❌ Failed to parse date string: $e');
      }
    }

    print('❌ Unexpected date type: ${donationDate.runtimeType}');
    return null;
  } catch (e, stackTrace) {
    print('❌ Error fetching last donation: $e');
    print('Stack trace: $stackTrace');

    // Check if it's an index error
    if (e.toString().contains('index')) {
      print('⚠️ This might be a Firestore index error');
      print('⚠️ Try creating index for: donations/donor_id/status/donation_date');
    }

    return null;
  }
}

  Widget _buildBloodStock() {
  return Container(
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      boxShadow: [
      BoxShadow(
        color: Colors.grey.withOpacity(0.2),
        spreadRadius: 1,
        blurRadius: 3,
        offset: const Offset(0, 1),
          ),
        ],
      ),
  padding: const EdgeInsets.all(16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
          const Text(
    'Current Blood Stock',
    style: TextStyle(
      fontWeight: FontWeight.bold,
      fontSize: 16,
    ),
          ),
  const Text(
    'Select Location',
    style: TextStyle(
      color: Colors.grey,
      fontSize: 12,
    ),
          ),
  const SizedBox(height: 8),

          // Location dropdown
          if (_availableLocations.isNotEmpty)
    Container(
      padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.grey.shade300),
        ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton < String > (
              value: _selectedLocation.isNotEmpty ? _selectedLocation : null,
            isExpanded: true,
            borderRadius: BorderRadius.circular(12),
            dropdownColor: Colors.white,
            elevation: 8,
            hint: const Text('Select a location'),
              items: _availableLocations.map < DropdownMenuItem < String >> ((String location) {
    return DropdownMenuItem < String > (
      value: location,
        child: Text(
          location,
          style: const TextStyle(fontSize: 14),
            overflow: TextOverflow.ellipsis,
                      ),
                    );
  }).toList(),
    onChanged: _onLocationChanged,
      menuMaxHeight: 300,
                ),
              ),
            )
          else
  Container(
    padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.grey[100],
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey.shade300),
      ),
        child: const Center(
          child: CircularProgressIndicator(
            color: Color(0xFFDE0D0D),
                ),
              ),
            ),

  const SizedBox(height: 16),

          // Display last updated time
          if (_currentBloodStock != null && _currentBloodStock!.containsKey('last_updated'))
    Padding(
      padding: const EdgeInsets.only(bottom: 8),
        child: Text(
          'Last Updated: ${_formatLastUpdated(_currentBloodStock!['last_updated'])}',
          style: TextStyle(
            fontSize: 10,
            color: Colors.grey[600],
            fontStyle: FontStyle.italic,
          ),
        ),
            ),

  // Blood types grid
  if (_selectedLocation.isNotEmpty)
    GridView.count(
      crossAxisCount: 4,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
        childAspectRatio: 0.75,
          children: [
            _bloodTypeStatusFromData('O-'),
            _bloodTypeStatusFromData('O+'),
            _bloodTypeStatusFromData('A-'),
            _bloodTypeStatusFromData('A+'),
            _bloodTypeStatusFromData('B-'),
            _bloodTypeStatusFromData('B+'),
            _bloodTypeStatusFromData('AB-'),
            _bloodTypeStatusFromData('AB+'),
          ],
            )
          else
  const Center(
    child: Padding(
      padding: EdgeInsets.all(20),
        child: Text(
          'Please select a location',
          style: TextStyle(color: Colors.grey),
        ),
              ),
            ),

  const SizedBox(height: 16),

    // Legend
    Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
      _stockLegendItem('assets/low.png', 'Low'),
              const SizedBox(width: 20),
    _stockLegendItem('assets/medium.png', 'Medium'),
              const SizedBox(width: 20),
    _stockLegendItem('assets/high.png', 'Full'),
            ],
          ),
        ],
      ),
    );
}

  Widget _bloodTypeStatusFromData(String bloodType) {
  // Show loading state
  if (_currentBloodStock == null) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
      SizedBox(
        width: 20,
        height: 20,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          color: Color(0xFFDE0D0D),
        ),
      ),
          const SizedBox(height: 4),
      Text(
        bloodType,
        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
          ),
        ],
      );
  }

  // Check if blood_types key exists
  if (!_currentBloodStock!.containsKey('blood_types')) {
    print('❌ No blood_types key in _currentBloodStock');
    print('   Available keys: ${_currentBloodStock!.keys.toList()}');
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
      Icon(Icons.error_outline, color: Colors.orange, size: 30),
          const SizedBox(height: 4),
      Text(
        bloodType,
        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
          ),
    Text(
      'No data',
      style: TextStyle(color: Colors.orange, fontSize: 10),
    ),
        ],
      );
  }

    // Safely cast blood_types to Map<String, dynamic>
    final bloodTypesRaw = _currentBloodStock!['blood_types'];
  print('🔍 Raw blood_types type: ${bloodTypesRaw.runtimeType}');
  print('🔍 Raw blood_types: $bloodTypesRaw');
    
    final Map < String, dynamic > bloodTypesMap = Map < String, dynamic >.from(bloodTypesRaw as Map);

  // Check if specific blood type exists
  if (!bloodTypesMap.containsKey(bloodType)) {
    print('⚠️ Blood type $bloodType not found in bloodTypesMap');
    print('   Available blood types: ${bloodTypesMap.keys.toList()}');
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
      Icon(Icons.help_outline, color: Colors.grey, size: 30),
          const SizedBox(height: 4),
      Text(
        bloodType,
        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
          ),
    Text(
      'N/A',
      style: TextStyle(color: Colors.grey, fontSize: 10),
    ),
        ],
      );
  }

  try {
      final bloodTypeData = bloodTypesMap[bloodType] as Map<String, dynamic>;
    print('🔍 Blood type data for $bloodType: $bloodTypeData');
      
      final status = (bloodTypeData['status'] as String??? 'Medium').toLowerCase();
      final units = bloodTypeData['units'] as int??? 0;

    // DEBUG: Print the status for troubleshooting
    print('🔍 Blood type $bloodType: status="$status", units=$units');

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
      // Use getStatusImage from BloodStockService
      _buildStatusImage(status),
          const SizedBox(height: 4),
      Text(
        bloodType,
        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
          ),
    Text(
      _formatStatusForDisplay(status),
      style: TextStyle(
        color: _getStatusColor(status),
        fontSize: 10,
        fontWeight: FontWeight.w600,
      ),
    ),
      Text(
        '$units units',
        style: TextStyle(
          color: Colors.grey[600],
          fontSize: 8,
        ),
      ),
        ],
      );
  } catch (e) {
    print('❌ Error displaying blood type $bloodType: $e');
    print('   Blood type data: ${bloodTypesMap[bloodType]}');
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
      Icon(Icons.error, color: Colors.red, size: 30),
          const SizedBox(height: 4),
      Text(
        bloodType,
        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
          ),
    Text(
      'Error',
      style: TextStyle(color: Colors.red, fontSize: 10),
    ),
        ],
      );
  }
}

  Widget _buildStatusImage(String status) {
  try {
      // Get the image path from BloodStockService
      final imagePath = BloodStockService.getStatusImage(status);

    // Try to load the image with better error handling
    return Image.asset(
      imagePath,
      height: 40,
      width: 40,
      fit: BoxFit.contain,
      errorBuilder: (context, error, stackTrace) {
        print('⚠️ Failed to load image: $imagePath');
        print('Error: $error');

        // Fallback to colored icon based on status
        return Icon(
          Icons.water_drop,
          size: 40,
          color: _getStatusColor(status),
        );
      },
    );
  } catch (e) {
    print('❌ Error in _buildStatusImage: $e');
    return Icon(
      Icons.error_outline,
      size: 40,
      color: Colors.red,
    );
  }
}

  String _formatStatusForDisplay(String status) {
  switch (status.toLowerCase()) {
    case 'low':
      return 'Low';
    case 'medium':
      return 'Medium';
    case 'high':
    case 'full':
      return 'Full';
    case 'very_low':
      return 'Very Low';
    case 'empty':
      return 'Empty';
    default:
      return status.capitalize();
  }
}

  Color _getStatusColor(String status) {
    final statusLower = status.toLowerCase();
  switch (statusLower) {
    case 'low':
    case 'very_low':
    case 'empty':
      return Colors.red;
    case 'high':
    case 'full':
      return Colors.green;
    case 'medium':
      return Colors.orange;
    default:
      print('⚠️ Unknown status color for: $status');
      return Colors.grey;
  }
}

  Widget _stockLegendItem(String imageAsset, String label) {
  return Row(
    children: [
    Image.asset(imageAsset, height: 20, width: 20),
        const SizedBox(width: 4),
    Text(label, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
      ],
    );
}

  String _formatLastUpdated(String isoString) {
  try {
      final DateTime dateTime = DateTime.parse(isoString);
      final DateTime now = DateTime.now();
      final Duration difference = now.difference(dateTime);

    if (difference.inMinutes < 60) {
      return '${difference.inMinutes} min ago';
    } else if (difference.inHours < 24) {
      return '${difference.inHours} hour${difference.inHours > 1 ? 's' : ''} ago';
    } else {
      return '${difference.inDays} day${difference.inDays > 1 ? 's' : ''} ago';
    }
  } catch (e) {
    return 'Recently updated';
  }
}

  Widget _buildAnnouncements() {
  if (_isLoadingAnnouncements) {
    return _buildLoadingSection('Loading announcements...');
  }

  if (_announcements.isEmpty) {
    return _buildEmptySection(
      'No announcements',
      'Check back later for updates',
      Icons.announcement,
    );
  }

  return Container(
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      boxShadow: [
      BoxShadow(
        color: Colors.grey.withOpacity(0.2),
        spreadRadius: 1,
        blurRadius: 3,
        offset: const Offset(0, 1),
          ),
        ],
      ),
  padding: const EdgeInsets.all(16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
      Row(
        children: const [
          Icon(Icons.announcement, color: Color(0xFFDE0D0D), size: 22),
  SizedBox(width: 6),
    Text(
      'Announcements',
      style: TextStyle(
        fontWeight: FontWeight.bold,
        fontSize: 16,
      ),
    ),
            ],
          ),
  const SizedBox(height: 12),
    SizedBox(
      height: 120,
      child: PageView.builder(
        controller: _announcementController,
        itemCount: _announcements.length,
        itemBuilder: (context, index) {
                final announcement = _announcements[index];
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
            Text(
              announcement['title'] ?? 'No Title',
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 16,
                color: Color(0xFFDE0D0D),
                      ),
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
    ),
                    const SizedBox(height: 8),
    Expanded(
      child: Text(
        announcement['content'] ?? 'No content',
        style: const TextStyle(fontSize: 14),
          maxLines: 3,
            overflow: TextOverflow.ellipsis,
                      ),
                    ),
  const SizedBox(height: 8),
    Text(
      _formatDate(announcement['date']),
      style: TextStyle(
        fontSize: 12,
        color: Colors.grey[600],
        fontStyle: FontStyle.italic,
      ),
    ),
                  ],
                );
},
            ),
          ),
const SizedBox(height: 12),
  Row(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
              for (int i = 0; i < _announcements.length; i++)
Container(
  width: 8,
  height: 8,
  margin: const EdgeInsets.symmetric(horizontal: 4),
    decoration: BoxDecoration(
      shape: BoxShape.circle,
      color: _currentAnnouncementIndex == i
      ? const Color(0xFFDE0D0D)
                        : Colors.grey[300],
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildUpcomingBloodDrive() {
  if (_isLoadingEvents) {
    return _buildLoadingSection('Loading blood drives...', isRed: true);
  }

  if (_upcomingEvents.isEmpty) {
    return _buildEmptySection(
      'No upcoming blood drives',
      'Check back for scheduled events',
      Icons.event,
      isRed: true,
    );
  }

  return Container(
    decoration: BoxDecoration(
      color: const Color(0xFFDE0D0D),
        borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFFDE0D0D).withOpacity(0.3),
                spreadRadius: 1,
                  blurRadius: 4,
                    offset: const Offset(0, 2),
        ),
      ],
    ),
  padding: const EdgeInsets.all(16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Row(
        children: [
          Icon(
            Icons.event,
          color: Colors.white,
          size: 22,
            ),
    SizedBox(width: 6),
    Text(
      'Upcoming Blood Drive',
      style: TextStyle(
        color: Colors.white,
        fontWeight: FontWeight.bold,
        fontSize: 16,
      ),
    ),
          ],
        ),
  const SizedBox(height: 10),
    // PageView for sliding blood drives - Now shows ONLY upcoming events
    SizedBox(
      height: 130,
      child: PageView.builder(
        controller: _bloodDriveController,
        itemCount: _upcomingEvents.length,
        itemBuilder: (context, index) {
              final bloodDrive = _upcomingEvents[index];
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
            Text(
              bloodDrive['title'] ?? 'No Title',
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 16,
              ),
                maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 8),
    _bloodDriveInfoRow(Icons.calendar_month, bloodDrive['displayDate'] ?? 'Date not set'),
                  const SizedBox(height: 4),
    _bloodDriveInfoRow(Icons.location_on, bloodDrive['location'] ?? 'Location not set'),
                  const SizedBox(height: 4),
    _bloodDriveInfoRow(Icons.access_time, bloodDrive['displayTime'] ?? 'Time not set'),
                  const SizedBox(height: 4),
    _bloodDriveInfoRow(Icons.local_hospital, bloodDrive['organizers'] ?? 'Organizer not set'),
                ],
              );
},
          ),
        ),
const SizedBox(height: 8),
  Row(
    mainAxisAlignment: MainAxisAlignment.spaceBetween,
    children: [
    Row(
      children: [
                for (int i = 0; i < _upcomingEvents.length; i++)
GestureDetector(
  onTap: () {
    _bloodDriveController.animateToPage(
      i,
      duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
                      );
                    },
child: Container(
  width: 8,
  height: 8,
  margin: const EdgeInsets.symmetric(horizontal: 4),
    decoration: BoxDecoration(
      shape: BoxShape.circle,
      color: _currentBloodDriveIndex == i
      ? Colors.white
      : Colors.white.withOpacity(0.5),
    ),
                    ),
                  ),
              ],
            ),
InkWell(
  onTap: () {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const BloodDrivePage()),
    );
  },
  child: Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
        child: const Text(
          'See All',
          style: TextStyle(
            color: Color(0xFFDE0D0D),
            fontWeight: FontWeight.bold,
            fontSize: 12,
          ),
                ),
              ),
            ),
          ],
        ),
      ],
    ),
  );
}

  Widget _bloodDriveInfoRow(IconData icon, String text) {
  return Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
    Icon(
      icon,
      color: Colors.white,
      size: 16,
    ),
        const SizedBox(width: 6),
    Expanded(
      child: Text(
        text,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 12,
        ),
          maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
}

  Widget _buildActionButtonsRow1() {
  return Container(
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      boxShadow: [
      BoxShadow(
        color: Colors.grey.withOpacity(0.2),
        spreadRadius: 1,
        blurRadius: 3,
        offset: const Offset(0, 1),
          ),
        ],
      ),
  padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
      // Snap and Share Button
      InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const SnapAndSharePage()),
          );
        },
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
          Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              color: const Color(0xFFDE0D0D).withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
                  ),
  child: const Center(
    child: Icon(
      Icons.camera_alt,
      color: Color(0xFFDE0D0D),
        size: 26,
                    ),
                  ),
                ),
  const SizedBox(height: 6),
                const Text(
    'Snap and\nShare',
    style: TextStyle(
      fontSize: 10,
      fontWeight: FontWeight.bold,
    ),
      textAlign: TextAlign.center,
                ),
              ],
            ),
          ),

  // Raise Awareness Button - NOW USES NATIVE SHARE
  InkWell(
    onTap: () {
      RaiseAwarenessHelper.showRaiseAwarenessShareSheet(context);
    },
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
      Container(
        width: 54,
        height: 54,
        decoration: BoxDecoration(
          color: const Color(0xFFDE0D0D).withOpacity(0.1),
            borderRadius: BorderRadius.circular(12),
                  ),
  child: const Center(
    child: Icon(
      Icons.campaign,
      color: Color(0xFFDE0D0D),
        size: 26,
                    ),
                  ),
                ),
  const SizedBox(height: 6),
                const Text(
    'Raise\nAwareness',
    style: TextStyle(
      fontSize: 10,
      fontWeight: FontWeight.bold,
    ),
      textAlign: TextAlign.center,
                ),
              ],
            ),
          ),

  // Community Button
  InkWell(
    onTap: () {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => const CommunityPage()),
      );
    },
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
      Container(
        width: 54,
        height: 54,
        decoration: BoxDecoration(
          color: const Color(0xFFDE0D0D).withOpacity(0.1),
            borderRadius: BorderRadius.circular(12),
                  ),
  child: const Center(
    child: Icon(
      Icons.people,
      color: Color(0xFFDE0D0D),
        size: 26,
                    ),
                  ),
                ),
  const SizedBox(height: 6),
                const Text(
    'Community\n',
    style: TextStyle(
      fontSize: 10,
      fontWeight: FontWeight.bold,
    ),
      textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
  // Status Button
  InkWell(
    onTap: () {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => const StatusPage()),
      );
    },
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
      Container(
        width: 54,
        height: 54,
        decoration: BoxDecoration(
          color: const Color(0xFFDE0D0D).withOpacity(0.1),
            borderRadius: BorderRadius.circular(12),
                  ),
  child: const Center(
    child: Icon(
      Icons.assignment,
      color: Color(0xFFDE0D0D),
        size: 26,
                    ),
                  ),
                ),
  const SizedBox(height: 6),
                const Text(
    'Status\n',
    style: TextStyle(
      fontSize: 10,
      fontWeight: FontWeight.bold,
    ),
      textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ],
      ),
    );
}

  Widget _buildFindDonorsAndAppointment() {
  return Container(
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      boxShadow: [
      BoxShadow(
        color: Colors.grey.withOpacity(0.2),
        spreadRadius: 1,
        blurRadius: 3,
        offset: const Offset(0, 1),
          ),
        ],
      ),
  padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
      // Book Appointment Button
      InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const DonationPage()),
          );
        },
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
          Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              color: const Color(0xFFDE0D0D).withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
                  ),
  child: const Center(
    child: Icon(
      Icons.medical_services,
      color: Color(0xFFDE0D0D),
        size: 26,
                    ),
                  ),
                ),
  const SizedBox(height: 6),
                const Text(
    'Book\nAppointment',
    style: TextStyle(
      fontSize: 10,
      fontWeight: FontWeight.bold,
    ),
      textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
  // Find Donors Button
  InkWell(
    onTap: () {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => const FindDonorsPage()),
      );
    },
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
      Container(
        width: 54,
        height: 54,
        decoration: BoxDecoration(
          color: const Color(0xFFDE0D0D).withOpacity(0.1),
            borderRadius: BorderRadius.circular(12),
                  ),
  child: const Center(
    child: Icon(
      Icons.search,
      color: Color(0xFFDE0D0D),
        size: 26,
                    ),
                  ),
                ),
  const SizedBox(height: 6),
                const Text(
    'Find\nDonors',
    style: TextStyle(
      fontSize: 10,
      fontWeight: FontWeight.bold,
    ),
      textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
  // Donate Now Button
  InkWell(
    onTap: () {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => const DonateNowPage()),
      );
    },
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
      Container(
        width: 54,
        height: 54,
        decoration: BoxDecoration(
          color: const Color(0xFFDE0D0D).withOpacity(0.1),
            borderRadius: BorderRadius.circular(12),
                  ),
  child: const Center(
    child: Icon(
      Icons.volunteer_activism,
      color: Color(0xFFDE0D0D),
        size: 26,
                    ),
                  ),
                ),
  const SizedBox(height: 6),
                const Text(
    'Donate\nNow',
    style: TextStyle(
      fontSize: 10,
      fontWeight: FontWeight.bold,
    ),
      textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
  // Blood Drive Button with updated icon
  InkWell(
    onTap: () {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => const BloodDrivePage()),
      );
    },
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
      Container(
        width: 54,
        height: 54,
        decoration: BoxDecoration(
          color: const Color(0xFFDE0D0D).withOpacity(0.1),
            borderRadius: BorderRadius.circular(12),
                  ),
  child: const Center(
    child: Icon(
      Icons.bloodtype,
      color: Color(0xFFDE0D0D),
        size: 26,
                    ),
                  ),
                ),
  const SizedBox(height: 6),
                const Text(
    'Blood\nDrive',
    style: TextStyle(
      fontSize: 10,
      fontWeight: FontWeight.bold,
    ),
      textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ],
      ),
    );
}

  Widget _buildCommunity() {
  if (_isLoadingTeams) {
    return _buildLoadingSection('Loading community teams...');
  }

  if (_communityTeams.isEmpty) {
    return _buildEmptySection(
      'No active teams',
      'Join or create a team in the Community section',
      Icons.people,
    );
  }

  return Container(
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      boxShadow: [
      BoxShadow(
        color: Colors.grey.withOpacity(0.2),
        spreadRadius: 1,
        blurRadius: 3,
        offset: const Offset(0, 1),
          ),
        ],
      ),
  padding: const EdgeInsets.all(16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
      Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
        Row(
          children: const [
            Icon(
              Icons.people,
              size: 24,
                color: Color(0xFFDE0D0D),
                  ),
  SizedBox(width: 6),
    Text(
      'Community',
      style: TextStyle(
        fontWeight: FontWeight.bold,
        fontSize: 16,
      ),
    ),
                ],
              ),
  InkWell(
    onTap: () {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => const CommunityPage(initialTabIndex: 1),
                    ),
      );
    },
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(0xFFDE0D0D),
            borderRadius: BorderRadius.circular(16),
                  ),
  child: const Text(
    'See All',
    style: TextStyle(
      color: Colors.white,
      fontWeight: FontWeight.bold,
      fontSize: 12,
    ),
                  ),
                ),
              ),
            ],
          ),
  const SizedBox(height: 12),
          const Text(
    'Teams',
    style: TextStyle(
      fontSize: 14,
      color: Colors.grey,
    ),
          ),
  const SizedBox(height: 8),
    SizedBox(
      height: 100,
      child: Row(
        children: [
        IconButton(
          icon: const Icon(Icons.arrow_back_ios, size: 16, color: Color(0xFFDE0D0D)),
  onPressed: () {
                    final double currentPosition = _communityScrollController.position.pixels;
                    final double newPosition = currentPosition - 100;
    _communityScrollController.animateTo(
      newPosition < 0 ? 0 : newPosition,
      duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
                    );
  },
                ),
  Expanded(
    child: ListView(
      controller: _communityScrollController,
      scrollDirection: Axis.horizontal,
      children: _communityTeams.map((team) {
        return _communityItemClickable(
          team['name'] ?? 'Unknown Team',
          team['icon'] ?? Icons.group,
          team['memberCount'] ?? 0,
        );
      }).toList(),
    ),
  ),
    IconButton(
      icon: const Icon(Icons.arrow_forward_ios, size: 16, color: Color(0xFFDE0D0D)),
  onPressed: () {
                    final double currentPosition = _communityScrollController.position.pixels;
                    final double maxPosition = _communityScrollController.position.maxScrollExtent;
                    final double newPosition = currentPosition + 100;
    _communityScrollController.animateTo(
      newPosition > maxPosition ? maxPosition : newPosition,
      duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
                    );
  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
}

  Widget _communityItemClickable(String title, IconData icon, int memberCount) {
  return GestureDetector(
    onTap: () {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => const CommunityPage(initialTabIndex: 1),
          ),
      );
    },
    child: Container(
      width: 85,
      margin: const EdgeInsets.symmetric(horizontal: 6),
        child: Column(
          children: [
          Container(
            height: 60,
            alignment: Alignment.center,
            child: Container(
              padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFDE0D0D).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(25),
                ),
  child: Icon(
    icon,
    color: const Color(0xFFDE0D0D),
      size: 24,
                ),
              ),
            ),
  const SizedBox(height: 8),
    Text(
      title,
      style: const TextStyle(
        fontSize: 10,
        fontWeight: FontWeight.bold,
      ),
        textAlign: TextAlign.center,
          maxLines: 2,
            overflow: TextOverflow.ellipsis,
            ),
  Text(
    '$memberCount members',
    style: TextStyle(
      fontSize: 8,
      color: Colors.grey[600],
    ),
  ),
          ],
        ),
      ),
    );
}

  // Helper methods for loading/empty states
  Widget _buildLoadingSection(String message, { bool isRed = false }) {
  return Container(
    decoration: BoxDecoration(
      color: isRed ? const Color(0xFFDE0D0D) : Colors.white,
        borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.grey.withOpacity(0.2),
              spreadRadius: 1,
              blurRadius: 3,
              offset: const Offset(0, 1),
          ),
        ],
      ),
  padding: const EdgeInsets.all(16),
    child: Center(
      child: Column(
        children: [
        CircularProgressIndicator(
          color: isRed ? Colors.white : const Color(0xFFDE0D0D),
            ),
  const SizedBox(height: 12),
    Text(
      message,
      style: TextStyle(
        color: isRed ? Colors.white : Colors.grey[600],
      ),
    ),
          ],
        ),
      ),
    );
}

  Widget _buildEmptySection(String title, String subtitle, IconData icon, { bool isRed = false }) {
  return Container(
    decoration: BoxDecoration(
      color: isRed ? const Color(0xFFDE0D0D) : Colors.white,
        borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.grey.withOpacity(0.2),
              spreadRadius: 1,
              blurRadius: 3,
              offset: const Offset(0, 1),
          ),
        ],
      ),
  padding: const EdgeInsets.all(16),
    child: Center(
      child: Column(
        children: [
        Icon(
          icon,
          color: isRed ? Colors.white : const Color(0xFFDE0D0D),
            size: 40,
            ),
  const SizedBox(height: 12),
    Text(
      title,
      style: TextStyle(
        color: isRed ? Colors.white : Colors.grey[800],
        fontWeight: FontWeight.bold,
      ),
    ),
            const SizedBox(height: 6),
    Text(
      subtitle,
      style: TextStyle(
        color: isRed ? Colors.white.withOpacity(0.8) : Colors.grey[600],
        fontSize: 12,
      ),
      textAlign: TextAlign.center,
    ),
          ],
        ),
      ),
    );
}

  String _formatDate(dynamic date) {
  try {
    if (date is Timestamp) {
        final DateTime dateTime = date.toDate();
      return '${dateTime.day}/${dateTime.month}/${dateTime.year}';
    } else if (date is String) {
      return date;
    }
    return 'Date not available';
  } catch (e) {
    return 'Date not available';
  }
}
}

// String extension for capitalization
extension StringExtension on String {
  String capitalize() {
    if (isEmpty) return this;
    return this[0].toUpperCase() + substring(1).toLowerCase();
  }
}