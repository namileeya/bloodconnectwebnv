import { db } from '../firebase';
import {
    collection,
    query,
    where,
    getDocs,
    getCountFromServer,
    orderBy,
    limit,
    Timestamp,
    onSnapshot,
} from 'firebase/firestore';

class DashboardService {
    // Collections
    collections = {
        users: 'users',
        donations: 'donations',
        bloodRequests: 'blood_requests',
        bloodDriveEvents: 'blood_drive_events',
        stories: 'stories',
        teams: 'teams',
        hospitals: 'hospitals',
        appointments: 'appointments',
        eligibilityRequests: 'eligibility_requests',
        slotBookings: 'slot_bookings',
        notifications: 'notifications',
        donorProfiles: 'donor_profiles',
        announcements: 'announcements',
        rewards: 'rewards'
    };

    // Get ALL dashboard statistics
    async getDashboardStats() {
        try {
            console.log('Loading dashboard stats...');

            // Get current date for monthly calculations
            const now = new Date();
            const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

            // Execute all queries in parallel
            const promises = {
                // Core Statistics
                totalUsers: this.getCollectionCount(this.collections.users),
                totalDonations: this.getCollectionCount(this.collections.donations),
                livesSaved: this.getCountWithFilter(this.collections.donations, 'status', '==', 'used'),

                // User & Donor Statistics
                communityMembers: this.getCountWithFilter(this.collections.users, 'role', '==', 'blood_donor'),
                totalDonorCards: this.getCollectionCount(this.collections.donorProfiles),

                // Event & Campaign Statistics
                activeCampaigns: this.getCountWithFilter(this.collections.bloodDriveEvents, 'status', '==', 'active'),
                totalEvents: this.getCollectionCount(this.collections.bloodDriveEvents),

                // Blood Request Statistics - Include 'critical' and 'high' status
                pendingRequests: this.getPendingBloodRequestsCount(),

                // Donation Statistics
                completedThisMonth: this.getDonationsThisMonth(currentMonthStart, currentMonthEnd),

                // Content Statistics
                communityGroups: this.getCollectionCount(this.collections.teams),
                communityContent: this.getCountWithFilter(this.collections.stories, 'status', '==', 'approved'),
                communityBanners: this.getCountWithFilter(this.collections.announcements, 'status', '==', 'active'),

                // Appointment Statistics
                totalAppointments: this.getCollectionCount(this.collections.appointments),
                pendingAppointments: this.getCountWithFilter(this.collections.appointments, 'status', '==', 'pending'),
                confirmedAppointments: this.getCountWithFilter(this.collections.appointments, 'status', '==', 'confirmed'),

                // Blood Inventory Statistics - Use donations expiry dates
                bloodStockStats: this.getExpiryBasedInventory(),

                // Eligibility Statistics
                eligibilityStats: this.getEligibilityStats(),

                // Rewards Statistics
                rewardsStats: this.getRewardsStats()
            };

            // Wait for all promises
            const results = await Promise.allSettled(Object.values(promises));

            // Extract results
            const [
                totalUsers, totalDonations, livesSaved,
                communityMembers, totalDonorCards,
                activeCampaigns, totalEvents,
                pendingRequests, completedThisMonth,
                communityGroups, communityContent, communityBanners,
                totalAppointments, pendingAppointments, confirmedAppointments,
                bloodStockStats, eligibilityStats, rewardsStats
            ] = results;

            // Return all statistics
            return {
                // Core metrics
                livesSaved: this.getValue(livesSaved),
                totalDonations: this.getValue(totalDonations),
                communityParticipation: this.getValue(communityMembers),
                activeCampaigns: this.getValue(activeCampaigns),
                pendingRequests: this.getValue(pendingRequests),
                completedThisMonth: this.getValue(completedThisMonth),

                // User metrics
                totalUsers: this.getValue(totalUsers),
                totalDonorCards: this.getValue(totalDonorCards),

                // Event metrics
                totalEvents: this.getValue(totalEvents),

                // Community metrics
                communityGroups: this.getValue(communityGroups),
                communityContent: this.getValue(communityContent),
                communityBanners: this.getValue(communityBanners),

                // Appointment metrics
                totalAppointments: this.getValue(totalAppointments),
                pendingAppointments: this.getValue(pendingAppointments),
                confirmedAppointments: this.getValue(confirmedAppointments),

                // Donation records
                totalDonationRecords: this.getValue(totalDonations),

                // Registration metrics
                totalRegistrations: 0,
                pendingRegistrations: 0,

                // Eligibility metrics
                eligibleDonors: eligibilityStats.value?.eligible || 0,
                deferredDonors: eligibilityStats.value?.deferred || 0,
                ineligibleDonors: eligibilityStats.value?.ineligible || 0,

                // Blood inventory metrics - Use expiry based calculation
                totalBloodStock: bloodStockStats.value?.total || 0,
                critical: bloodStockStats.value?.critical || 0,
                urgent: bloodStockStats.value?.urgent || 0,

                // Rewards metrics
                totalRewards: rewardsStats.value?.total || 0,
                activeRewards: rewardsStats.value?.active || 0
            };

        } catch (error) {
            console.error('Error in getDashboardStats:', error);
            return this.getDefaultStats();
        }
    }

    // Helper: Get collection count
    async getCollectionCount(collectionName) {
        try {
            const snapshot = await getCountFromServer(collection(db, collectionName));
            return snapshot.data().count;
        } catch (error) {
            console.error(`Error counting ${collectionName}:`, error);
            return 0;
        }
    }

    // Helper: Get count with filter
    async getCountWithFilter(collectionName, field, operator, value) {
        try {
            const q = query(collection(db, collectionName), where(field, operator, value));
            const snapshot = await getCountFromServer(q);
            return snapshot.data().count;
        } catch (error) {
            console.error(`Error counting ${collectionName} with filter:`, error);
            return 0;
        }
    }

    // Get pending blood requests count - Include 'critical' and 'high' status
    async getPendingBloodRequestsCount() {
        try {
            // Get all pending, critical, or high requests
            const requestsQuery = query(
                collection(db, this.collections.bloodRequests),
                where('status', 'in', ['pending', 'critical', 'high'])
            );

            const snapshot = await getCountFromServer(requestsQuery);
            return snapshot.data().count;
        } catch (error) {
            console.error('Error counting blood requests:', error);
            return 0;
        }
    }

    // Get donations this month
    async getDonationsThisMonth(start, end) {
        try {
            const q = query(
                collection(db, this.collections.donations),
                where('donation_date', '>=', Timestamp.fromDate(start)),
                where('donation_date', '<=', Timestamp.fromDate(end))
            );
            const snapshot = await getCountFromServer(q);
            return snapshot.data().count;
        } catch (error) {
            console.error('Error getting donations this month:', error);
            return 0;
        }
    }

    // Get blood inventory from donations expiry dates
    async getExpiryBasedInventory() {
        try {
            console.log('Calculating inventory from donations expiry...');

            const donationsSnapshot = await getDocs(collection(db, this.collections.donations));

            let totalStock = 0;
            let criticalStock = 0;
            let urgentStock = 0;

            donationsSnapshot.forEach((doc) => {
                const data = doc.data();
                const quantity = 1; // Each donation = 1 unit
                const expiryDate = data.expiry_date?.toDate();

                if (!expiryDate) return;

                totalStock += quantity;

                // Calculate days remaining
                const now = new Date();
                const timeDiff = expiryDate.getTime() - now.getTime();
                const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));

                if (daysRemaining <= 3 && daysRemaining >= 0) {
                    criticalStock += quantity;
                } else if (daysRemaining <= 7 && daysRemaining > 3) {
                    urgentStock += quantity;
                }
            });

            console.log('Expiry-based inventory:', {
                total: totalStock,
                critical: criticalStock,
                urgent: urgentStock
            });

            return {
                total: totalStock,
                critical: criticalStock,
                urgent: urgentStock
            };

        } catch (error) {
            console.error('Error getting expiry based inventory:', error);
            return { total: 0, critical: 0, urgent: 0 };
        }
    }

    // Get blood type distribution - Use hospitals bloodstock
    async getBloodTypeDistribution() {
        try {
            console.log('Fetching blood type distribution from hospitals...');

            const hospitalsSnapshot = await getDocs(collection(db, this.collections.hospitals));
            const distribution = {};
            const colors = {
                'O+': '#EF4444', 'A+': '#F59E0B', 'B+': '#10B981', 'AB+': '#3B82F6',
                'O-': '#8B5CF6', 'A-': '#EC4899', 'B-': '#14B8A6', 'AB-': '#6366F1'
            };

            // Initialize all blood types with 0
            Object.keys(colors).forEach(type => {
                distribution[type] = 0;
            });

            const hospitalPromises = hospitalsSnapshot.docs.map(async (hospitalDoc) => {
                try {
                    const bloodStockRef = collection(db, `${this.collections.hospitals}/${hospitalDoc.id}/bloodstock`);
                    const bloodStockSnapshot = await getDocs(bloodStockRef);

                    bloodStockSnapshot.forEach((doc) => {
                        const data = doc.data();
                        const bloodType = data.bloodType; // Should be like "O+", "A+", etc.
                        const quantity = Number(data.quantity) || 0;

                        if (bloodType && distribution.hasOwnProperty(bloodType)) {
                            distribution[bloodType] += quantity;
                        }
                    });
                } catch (error) {
                    console.error(`Error processing blood stock for hospital ${hospitalDoc.id}:`, error);
                }
            });

            await Promise.all(hospitalPromises);

            // Convert to array and filter out zero values
            const result = Object.entries(distribution)
                .filter(([_, value]) => value > 0)
                .map(([name, value]) => ({
                    name,
                    value,
                    color: colors[name] || '#999999'
                }));

            console.log('Blood type distribution:', result);

            return result;

        } catch (error) {
            console.error('Error getting blood type distribution:', error);
            return [];
        }
    }

    // Get urgent blood requests - Include 'critical' and 'high' status
    async getUrgentRequests(limitCount = 5) {
        try {
            console.log('Fetching urgent blood requests (including critical and high)...');

            // Include pending, critical, and high status
            const requestsQuery = query(
                collection(db, this.collections.bloodRequests),
                where('status', 'in', ['pending', 'critical', 'high']),
                orderBy('created_at', 'desc'),
                limit(limitCount)
            );

            const snapshot = await getDocs(requestsQuery);
            console.log(`Found ${snapshot.size} pending/critical/high blood requests`);

            const requests = [];

            snapshot.forEach((doc) => {
                const data = doc.data();
                const requestTime = data.created_at?.toDate();

                // Determine urgency: use status if it's critical or high, otherwise based on timestamp
                let urgency = data.status || 'medium';

                // If status is not critical/high, calculate based on time
                if (urgency !== 'critical' && urgency !== 'high' && requestTime) {
                    const hoursAgo = (new Date() - requestTime) / (1000 * 60 * 60);
                    if (hoursAgo < 6) urgency = 'critical';
                    else if (hoursAgo < 24) urgency = 'high';
                }

                // Use patient_location (state) from the data
                const location = data.patient_location || 'Location not specified';

                // Extract state name from location
                let state = location;
                const malaysianStates = [
                    'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan',
                    'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Sabah',
                    'Sarawak', 'Selangor', 'Terengganu', 'Kuala Lumpur', 'Labuan', 'Putrajaya'
                ];

                for (const malaysianState of malaysianStates) {
                    if (location.includes(malaysianState)) {
                        state = malaysianState;
                        break;
                    }
                }

                requests.push({
                    id: doc.id,
                    bloodType: data.blood_group || 'Unknown',
                    units: data.units || 1,
                    state: state,
                    location: location,
                    urgency: urgency,
                    time: this.formatTimeAgo(requestTime),
                    patientName: data.patient_name || 'Patient'
                });
            });

            console.log('Urgent requests loaded:', requests);
            return requests;

        } catch (error) {
            console.error('Error getting urgent requests:', error);
            return [];
        }
    }

    // Get recent activities
    async getRecentActivities(limitCount = 10) {
        try {
            const activities = [];
            const now = new Date();

            // Get recent donations
            try {
                const donationsQuery = query(
                    collection(db, this.collections.donations),
                    orderBy('created_at', 'desc'),
                    limit(5)
                );
                const donationsSnapshot = await getDocs(donationsQuery);

                donationsSnapshot.forEach((doc) => {
                    const data = doc.data();
                    activities.push({
                        id: doc.id,
                        type: 'donation',
                        user: data.donor_name || 'Donor',
                        action: `donated ${data.blood_type || ''} blood`,
                        time: this.formatTimeAgo(data.created_at?.toDate() || now),
                        status: data.status || 'completed',
                        timestamp: data.created_at
                    });
                });
            } catch (error) {
                console.error('Error loading donations for activities:', error);
            }

            // Get recent blood requests
            try {
                const requestsQuery = query(
                    collection(db, this.collections.bloodRequests),
                    orderBy('created_at', 'desc'),
                    limit(3)
                );
                const requestsSnapshot = await getDocs(requestsQuery);

                requestsSnapshot.forEach((doc) => {
                    const data = doc.data();
                    activities.push({
                        id: doc.id,
                        type: 'request',
                        user: data.requester_name || data.patient_name || 'Patient',
                        action: `requested ${data.blood_group || ''} blood`,
                        time: this.formatTimeAgo(data.created_at?.toDate() || now),
                        status: data.status || 'pending',
                        timestamp: data.created_at
                    });
                });
            } catch (error) {
                console.error('Error loading blood requests for activities:', error);
            }

            // Get recent stories
            try {
                const storiesQuery = query(
                    collection(db, this.collections.stories),
                    orderBy('createdAt', 'desc'),
                    limit(2)
                );
                const storiesSnapshot = await getDocs(storiesQuery);

                storiesSnapshot.forEach((doc) => {
                    const data = doc.data();
                    activities.push({
                        id: doc.id,
                        type: 'story',
                        user: data.author || 'Community Member',
                        action: 'shared a donation story',
                        time: this.formatTimeAgo(data.createdAt?.toDate() || now),
                        status: data.status || 'published',
                        timestamp: data.createdAt
                    });
                });
            } catch (error) {
                console.error('Error loading stories for activities:', error);
            }

            // Sort by timestamp and limit
            return activities
                .filter(activity => activity.timestamp)
                .sort((a, b) => {
                    const timeA = a.timestamp?.toMillis?.() || 0;
                    const timeB = b.timestamp?.toMillis?.() || 0;
                    return timeB - timeA;
                })
                .slice(0, limitCount);

        } catch (error) {
            console.error('Error getting recent activities:', error);
            return [];
        }
    }

    // Get donation trends (last 6 months)
    async getDonationTrends() {
        try {
            const trends = [];
            const now = new Date();

            // Get last 6 months
            for (let i = 5; i >= 0; i--) {
                const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

                try {
                    const monthQuery = query(
                        collection(db, this.collections.donations),
                        where('donation_date', '>=', Timestamp.fromDate(month)),
                        where('donation_date', '<=', Timestamp.fromDate(monthEnd))
                    );

                    const snapshot = await getCountFromServer(monthQuery);

                    trends.push({
                        month: month.toLocaleDateString('en-US', { month: 'short' }),
                        donations: snapshot.data().count,
                        year: month.getFullYear()
                    });
                } catch (error) {
                    console.error(`Error getting donations for ${month.toLocaleDateString()}:`, error);
                    trends.push({
                        month: month.toLocaleDateString('en-US', { month: 'short' }),
                        donations: 0,
                        year: month.getFullYear()
                    });
                }
            }

            console.log('Donation trends:', trends);
            return trends;

        } catch (error) {
            console.error('Error getting donation trends:', error);
            return [];
        }
    }

    // Get eligibility statistics
    async getEligibilityStats() {
        try {
            const eligibilitySnapshot = await getDocs(collection(db, this.collections.eligibilityRequests));

            let eligible = 0;
            let deferred = 0;
            let ineligible = 0;

            eligibilitySnapshot.forEach((doc) => {
                const data = doc.data();
                const decision = data.admin_decision || data.status;

                if (decision === 'eligible' || decision === 'approved') {
                    eligible++;
                } else if (decision === 'deferred') {
                    deferred++;
                } else if (decision === 'ineligible' || decision === 'rejected') {
                    ineligible++;
                }
            });

            return { eligible, deferred, ineligible };
        } catch (error) {
            console.error('Error getting eligibility stats:', error);
            return { eligible: 0, deferred: 0, ineligible: 0 };
        }
    }

    // Get rewards statistics
    async getRewardsStats() {
        try {
            const totalSnapshot = await getCountFromServer(collection(db, this.collections.rewards));

            const now = Timestamp.now();
            const activeQuery = query(
                collection(db, this.collections.rewards),
                where('isActive', '==', true),
                where('expiryDate', '>', now)
            );
            const activeSnapshot = await getCountFromServer(activeQuery);

            return {
                total: totalSnapshot.data().count,
                active: activeSnapshot.data().count
            };
        } catch (error) {
            console.error('Error getting rewards stats:', error);
            return { total: 0, active: 0 };
        }
    }

    // Get top donors
    async getTopDonors(limitCount = 5) {
        try {
            const donationsSnapshot = await getDocs(collection(db, this.collections.donations));
            const donorMap = new Map();

            donationsSnapshot.forEach((doc) => {
                const data = doc.data();
                const donorId = data.donor_id;

                if (!donorId) return;

                if (!donorMap.has(donorId)) {
                    donorMap.set(donorId, {
                        id: donorId,
                        name: data.donor_name || `Donor ${donorId.substring(0, 6)}`,
                        bloodType: data.blood_type || 'Unknown',
                        donationCount: 0,
                        lastDonation: data.donation_date || data.created_at
                    });
                }

                const donor = donorMap.get(donorId);
                donor.donationCount++;

                const currentDate = data.donation_date || data.created_at;
                if (currentDate?.toMillis?.() > (donor.lastDonation?.toMillis?.() || 0)) {
                    donor.lastDonation = currentDate;
                }
            });

            const topDonors = Array.from(donorMap.values())
                .sort((a, b) => b.donationCount - a.donationCount)
                .slice(0, limitCount)
                .map(donor => ({
                    ...donor,
                    lastDonation: donor.lastDonation ?
                        this.formatTimeAgo(donor.lastDonation.toDate()) :
                        'No donations'
                }));

            return topDonors;
        } catch (error) {
            console.error('Error getting top donors:', error);
            return [];
        }
    }

    // Get upcoming events
    async getUpcomingEvents(limitCount = 3) {
        try {
            const now = new Date();
            const eventsQuery = query(
                collection(db, this.collections.bloodDriveEvents),
                orderBy('startDate'),
                limit(limitCount * 2)
            );

            const snapshot = await getDocs(eventsQuery);
            const events = [];

            snapshot.forEach((doc) => {
                const data = doc.data();
                const eventDate = new Date(data.startDate);

                if (eventDate >= now) {
                    events.push({
                        id: doc.id,
                        title: data.title || 'Blood Donation Drive',
                        date: this.formatDate(data.startDate),
                        time: data.startTime || '09:00 AM',
                        location: data.location || 'Location TBD',
                        participants: data.currentParticipants || 0,
                        capacity: data.expectedCapacity || 50,
                        status: data.status || 'scheduled'
                    });
                }
            });

            return events.slice(0, limitCount);
        } catch (error) {
            console.error('Error getting upcoming events:', error);
            return [];
        }
    }

    // Get monthly comparison
    async getMonthlyComparison() {
        try {
            const now = new Date();
            const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

            // Get current month stats
            const currentMonthQuery = query(
                collection(db, this.collections.donations),
                where('donation_date', '>=', Timestamp.fromDate(currentMonth))
            );
            const currentSnapshot = await getDocs(currentMonthQuery);

            let currentCompleted = 0;
            let currentPending = 0;
            let currentRejected = 0;

            currentSnapshot.forEach((doc) => {
                const status = doc.data().status?.toLowerCase();
                if (status === 'used' || status === 'completed') currentCompleted++;
                else if (status === 'pending') currentPending++;
                else if (status === 'rejected' || status === 'expired') currentRejected++;
            });

            // Get last month stats
            const lastMonthQuery = query(
                collection(db, this.collections.donations),
                where('donation_date', '>=', Timestamp.fromDate(lastMonth)),
                where('donation_date', '<=', Timestamp.fromDate(lastMonthEnd))
            );
            const lastSnapshot = await getDocs(lastMonthQuery);

            let lastCompleted = 0;
            let lastPending = 0;
            let lastRejected = 0;

            lastSnapshot.forEach((doc) => {
                const status = doc.data().status?.toLowerCase();
                if (status === 'used' || status === 'completed') lastCompleted++;
                else if (status === 'pending') lastPending++;
                else if (status === 'rejected' || status === 'expired') lastRejected++;
            });

            return [
                {
                    month: lastMonth.toLocaleDateString('en-US', { month: 'short' }),
                    completed: lastCompleted,
                    pending: lastPending,
                    rejected: lastRejected
                },
                {
                    month: currentMonth.toLocaleDateString('en-US', { month: 'short' }),
                    completed: currentCompleted,
                    pending: currentPending,
                    rejected: currentRejected
                }
            ];
        } catch (error) {
            console.error('Error getting monthly comparison:', error);
            return [];
        }
    }

    // Helper: Format time ago
    formatTimeAgo(date) {
        if (!date || !(date instanceof Date)) return 'recently';

        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    }

    // Helper: Format date
    formatDate(dateString) {
        if (!dateString) return 'Date not set';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        } catch (error) {
            return dateString;
        }
    }

    // Helper: Extract value from Promise result
    getValue(promiseResult) {
        return promiseResult.status === 'fulfilled' ? promiseResult.value : 0;
    }

    // Default stats
    getDefaultStats() {
        return {
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
        };
    }

    // Subscribe to real-time updates
    subscribeToDashboardData(callback) {
        const unsubscribers = [];

        const collectionsToWatch = [
            this.collections.donations,
            this.collections.bloodRequests,
            this.collections.bloodDriveEvents,
            this.collections.appointments
        ];

        collectionsToWatch.forEach(collectionName => {
            try {
                const unsubscribe = onSnapshot(
                    collection(db, collectionName),
                    () => {
                        callback('dataChanged');
                    },
                    (error) => {
                        console.error(`Error listening to ${collectionName}:`, error);
                    }
                );
                unsubscribers.push(unsubscribe);
            } catch (error) {
                console.error(`Failed to subscribe to ${collectionName}:`, error);
            }
        });

        return () => {
            unsubscribers.forEach(unsubscribe => unsubscribe());
        };
    }
}

export default new DashboardService();