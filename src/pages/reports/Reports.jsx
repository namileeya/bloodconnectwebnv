import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import Layout from '../../components/Layout';
import './Reports.css';

// Import jsPDF - we'll handle the import dynamically
let jsPDF;
let autoTable;

// Dynamically import to avoid SSR issues
if (typeof window !== 'undefined') {
  import('jspdf').then((module) => {
    jsPDF = module.default;
  });
  import('jspdf-autotable').then((module) => {
    autoTable = module.default;
  });
}

const ReportsContent = () => {
  const [reportType, setReportType] = useState('overview');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [loading, setLoading] = useState(true);
  const [donations, setDonations] = useState([]);
  const [bloodInventory, setBloodInventory] = useState([]);
  const [donorProfiles, setDonorProfiles] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [users, setUsers] = useState([]);
  const [exporting, setExporting] = useState(false);
  const refreshInterval = useRef(null);

  // Fetch all data
  const fetchAllData = async () => {
    setLoading(true);
    try {
      // 1. Fetch hospitals
      const hospitalsSnapshot = await getDocs(collection(db, 'hospitals'));
      const hospitalsData = hospitalsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setHospitals(hospitalsData);

      // 2. Fetch blood stock from ALL hospitals
      const allBloodStock = [];
      for (const hospital of hospitalsData) {
        try {
          const bloodStockRef = collection(db, 'hospitals', hospital.id, 'bloodStock');
          const bloodStockSnapshot = await getDocs(bloodStockRef);

          bloodStockSnapshot.forEach(doc => {
            allBloodStock.push({
              id: doc.id,
              hospitalId: hospital.id,
              hospitalName: hospital.name,
              ...doc.data(),
              lastUpdated: doc.data().lastUpdated?.toDate?.() || new Date()
            });
          });
        } catch (error) {
          console.error(`Error fetching blood stock for hospital ${hospital.id}:`, error);
        }
      }
      setBloodInventory(allBloodStock);

      // 3. Fetch donations
      const donationsQuery = query(
        collection(db, 'donations'),
        where('status', 'in', ['stored', 'completed'])
      );
      const donationsSnapshot = await getDocs(donationsQuery);
      const donationsData = donationsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          donation_date: data.donation_date?.toDate?.() || new Date(),
          expiry_date: data.expiry_date?.toDate?.() || null,
          created_at: data.created_at?.toDate?.() || new Date(),
          amount_ml: parseInt(data.amount_ml) || 0
        };
      });
      setDonations(donationsData);

      // 4. Fetch donor profiles
      const donorProfilesSnapshot = await getDocs(collection(db, 'donor_profiles'));
      const donorProfilesData = donorProfilesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: doc.data().created_at?.toDate?.() || new Date(),
        updated_at: doc.data().updated_at?.toDate?.() || new Date()
      }));
      setDonorProfiles(donorProfilesData);

      // 5. Fetch users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: doc.data().created_at?.toDate?.() || new Date()
      }));
      setUsers(usersData);

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Real-time listeners
  useEffect(() => {
    fetchAllData();

    refreshInterval.current = setInterval(fetchAllData, 60000);

    const unsubscribeDonations = onSnapshot(
      query(collection(db, 'donations'), where('status', 'in', ['stored', 'completed'])),
      (snapshot) => {
        const donationsData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            donation_date: data.donation_date?.toDate?.() || new Date(),
            amount_ml: parseInt(data.amount_ml) || 0
          };
        });
        setDonations(donationsData);
      }
    );

    const unsubscribeHospitals = onSnapshot(collection(db, 'hospitals'), (snapshot) => {
      const hospitalsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setHospitals(hospitalsData);
    });

    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
      unsubscribeDonations();
      unsubscribeHospitals();
    };
  }, []);

  // Date filtering
  const getFilteredDonations = () => {
    if (!dateRange.start || !dateRange.end) return donations;

    const startDate = new Date(dateRange.start);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(dateRange.end);
    endDate.setHours(23, 59, 59, 999);

    return donations.filter(donation => {
      if (!donation.donation_date) return false;
      const donationDate = donation.donation_date;
      return donationDate >= startDate && donationDate <= endDate;
    });
  };

  const handleReportChange = (type) => {
    setReportType(type);
  };

  const handleDateChange = (e) => {
    setDateRange({ ...dateRange, [e.target.name]: e.target.value });
  };

  // Calculate statistics
  const filteredDonations = getFilteredDonations();
  const totalDonations = filteredDonations.length;
  const totalVolume = filteredDonations.reduce((sum, donation) => sum + donation.amount_ml, 0);

  // Blood inventory aggregation
  const aggregatedInventory = bloodInventory.reduce((acc, item) => {
    if (!item.bloodType) return acc;

    const existing = acc.find(i => i.bloodType === item.bloodType);
    if (existing) {
      existing.quantity += item.quantity || 0;
    } else {
      acc.push({
        bloodType: item.bloodType,
        quantity: item.quantity || 0
      });
    }
    return acc;
  }, []);

  // Most frequent donors
  const donorVolumes = donations.reduce((acc, donation) => {
    const donorId = donation.donor_id;
    if (!donorId) return acc;

    const volume = donation.amount_ml || 0;

    if (!acc[donorId]) {
      acc[donorId] = {
        donorId,
        donorName: donation.donor_name || 'Unknown Donor',
        totalVolume: 0,
        donationCount: 0
      };
    }

    acc[donorId].totalVolume += volume;
    acc[donorId].donationCount += 1;
    return acc;
  }, {});

  const mostFrequentDonors = Object.values(donorVolumes)
    .sort((a, b) => b.totalVolume - a.totalVolume)
    .slice(0, 10);

  // FIXED: Simple PDF Export Function
  const exportToPDF = async () => {
    try {
      setExporting(true);

      // Dynamically import jsPDF if not already loaded
      if (!jsPDF) {
        const jsPDFModule = await import('jspdf');
        jsPDF = jsPDFModule.default;
      }
      if (!autoTable) {
        const autoTableModule = await import('jspdf-autotable');
        autoTable = autoTableModule.default;
      }

      const doc = new jsPDF('p', 'pt', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPos = 40;

      // Header
      doc.setFontSize(18);
      doc.setTextColor(40, 40, 40);
      doc.text('Blood Bank Management System', pageWidth / 2, yPos, { align: 'center' });

      yPos += 20;
      doc.setFontSize(14);
      doc.setTextColor(59, 130, 246);
      doc.text(`Report: ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`, pageWidth / 2, yPos, { align: 'center' });

      yPos += 25;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 40, yPos);
      yPos += 15;
      doc.text(`Date Range: ${dateRange.start} to ${dateRange.end}`, 40, yPos);
      yPos += 30;

      if (reportType === 'overview') {
        // Overview Report
        doc.setFontSize(12);
        doc.setTextColor(40, 40, 40);
        doc.text('Overview Statistics', 40, yPos);
        yPos += 25;

        doc.setFontSize(10);
        doc.text(`• Total Donations: ${totalDonations}`, 50, yPos);
        yPos += 20;
        doc.text(`• Total Volume: ${totalVolume} ml`, 50, yPos);
        yPos += 20;
        doc.text(`• Blood Types Available: ${aggregatedInventory.length}`, 50, yPos);
        yPos += 20;
        doc.text(`• Number of Hospitals: ${hospitals.length}`, 50, yPos);
        yPos += 30;

        // Blood Inventory Summary
        if (aggregatedInventory.length > 0) {
          doc.setFontSize(12);
          doc.text('Blood Inventory Summary', 40, yPos);
          yPos += 25;

          const inventoryData = aggregatedInventory.map(item => [
            item.bloodType,
            item.quantity.toString()
          ]);

          autoTable(doc, {
            startY: yPos,
            head: [['Blood Type', 'Units Available']],
            body: inventoryData,
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246] }
          });
        }

      } else if (reportType === 'donations') {
        // Donation History
        if (filteredDonations.length > 0) {
          const donationsData = filteredDonations.map(d => [
            d.donor_id?.substring(0, 8) + '...' || 'N/A',
            d.donor_name || 'Unknown',
            d.blood_type || 'N/A',
            d.donation_date.toLocaleDateString(),
            `${d.amount_ml} ml`,
            d.status || 'N/A'
          ]);

          autoTable(doc, {
            startY: yPos,
            head: [['Donor ID', 'Name', 'Blood Type', 'Date', 'Volume', 'Status']],
            body: donationsData,
            theme: 'striped',
            headStyles: { fillColor: [59, 130, 246] },
            styles: { fontSize: 8 },
            pageBreak: 'auto'
          });
        } else {
          doc.text('No donations found for the selected date range.', 40, yPos);
        }

      } else if (reportType === 'inventory') {
        // Blood Inventory
        if (aggregatedInventory.length > 0) {
          const inventoryData = aggregatedInventory.map(item => [
            item.bloodType,
            item.quantity.toString(),
            hospitals.length > 0 ? Math.round(item.quantity / hospitals.length).toString() : '0'
          ]);

          autoTable(doc, {
            startY: yPos,
            head: [['Blood Type', 'Total Units', 'Average per Hospital']],
            body: inventoryData,
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246] }
          });
        } else {
          doc.text('No blood inventory data available.', 40, yPos);
        }

      } else if (reportType === 'donors') {
        // Most Frequent Donors
        if (mostFrequentDonors.length > 0) {
          const donorsData = mostFrequentDonors.map((donor, index) => [
            (index + 1).toString(),
            donor.donorName,
            donor.totalVolume.toString() + ' ml',
            donor.donationCount.toString(),
            Math.round(donor.totalVolume / donor.donationCount).toString() + ' ml'
          ]);

          autoTable(doc, {
            startY: yPos,
            head: [['Rank', 'Donor Name', 'Total Volume', 'Donations', 'Average/Donation']],
            body: donorsData,
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246] }
          });
        } else {
          doc.text('No donor data available.', 40, yPos);
        }
      }

      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - 60, doc.internal.pageSize.getHeight() - 20);
        doc.text('Blood Bank Management System', 40, doc.internal.pageSize.getHeight() - 20);
      }

      // Save the PDF
      const fileName = `bloodbank-report-${reportType}-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

    } catch (error) {
      console.error('PDF Export Error:', error);
      alert('Failed to generate PDF. Please check console for details.');
    } finally {
      setExporting(false);
    }
  };

  // Calculate recent donations
  const recentDonations = filteredDonations.filter(d => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return d.donation_date >= sevenDaysAgo;
  });

  if (loading && donations.length === 0) {
    return (
      <div className="reports-content">
        <div className="reports-container">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600">Loading reports...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reports-content">
      <div className="reports-container">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h1 className="reports-title">Blood Bank Reports</h1>
          <button
            onClick={exportToPDF}
            disabled={exporting}
            className={`px-4 py-2 rounded-md transition-colors flex items-center gap-2 ${exporting
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
          >
            {exporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                Exporting...
              </>
            ) : (
              'Export to PDF'
            )}
          </button>
        </div>

        <div className="reports-filter">
          <select
            className="report-select"
            value={reportType}
            onChange={(e) => handleReportChange(e.target.value)}
          >
            <option value="overview">Overview</option>
            <option value="donations">Donation History</option>
            <option value="inventory">Blood Inventory</option>
            <option value="donors">Donor Activity</option>
          </select>
          <div className="date-filter">
            <input
              type="date"
              name="start"
              value={dateRange.start}
              onChange={handleDateChange}
              className="date-input"
              title="Start Date"
            />
            <span className="text-gray-500 mx-1">to</span>
            <input
              type="date"
              name="end"
              value={dateRange.end}
              onChange={handleDateChange}
              className="date-input"
              title="End Date"
            />
          </div>
        </div>

        {/* Reports content remains the same as before */}
        {reportType === 'overview' && (
          <div className="report-section">
            <h2 className="section-title">Overview</h2>
            <p className="text-gray-600 mb-4">
              Showing data from {dateRange.start} to {dateRange.end}
            </p>
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Total Donations</h3>
                <p>{totalDonations}</p>
                <p className="text-sm text-gray-500 mt-1">{totalVolume} ml total volume</p>
              </div>
              <div className="stat-card">
                <h3>Blood Types Available</h3>
                <p>{aggregatedInventory.length}</p>
                <p className="text-sm text-gray-500 mt-1">Across {hospitals.length} hospitals</p>
              </div>
              <div className="stat-card">
                <h3>Recent Donations</h3>
                <p>{recentDonations.length}</p>
                <p className="text-sm text-gray-500 mt-1">in last 7 days</p>
              </div>
            </div>

            {aggregatedInventory.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-gray-700 mb-3">Current Blood Inventory Summary</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3">
                  {aggregatedInventory.map((item, index) => (
                    <div key={index} className="bg-blue-50 p-3 rounded-lg text-center">
                      <div className="text-2xl font-bold text-blue-700">{item.bloodType}</div>
                      <div className="text-lg font-semibold">{item.quantity} units</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {reportType === 'donations' && (
          <div className="report-section">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
              <h2 className="section-title">Donation History</h2>
              <div className="text-gray-600 text-sm mt-1 sm:mt-0">
                Showing {filteredDonations.length} donations from {dateRange.start} to {dateRange.end}
              </div>
            </div>
            {filteredDonations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Donor ID</th>
                      <th>Name</th>
                      <th>Blood Type</th>
                      <th>Date</th>
                      <th>Volume</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDonations.map((donation) => (
                      <tr key={donation.id}>
                        <td className="font-mono text-sm">{donation.donor_id?.substring(0, 8)}...</td>
                        <td>{donation.donor_name}</td>
                        <td><span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">{donation.blood_type}</span></td>
                        <td>{donation.donation_date.toLocaleDateString()}</td>
                        <td className="font-medium">{donation.amount_ml} ml</td>
                        <td>
                          <span className={`px-2 py-1 rounded text-xs ${donation.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                            }`}>
                            {donation.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No donations found for the selected date range.
              </div>
            )}
          </div>
        )}

        {reportType === 'inventory' && (
          <div className="report-section">
            <h2 className="section-title">Blood Inventory (All Hospitals)</h2>
            <p className="text-gray-600 mb-4">Aggregated from {hospitals.length} hospitals</p>
            {aggregatedInventory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Blood Type</th>
                      <th>Total Units</th>
                      <th>Average per Hospital</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aggregatedInventory.map((item, index) => {
                      const average = hospitals.length > 0 ? Math.round(item.quantity / hospitals.length) : 0;
                      let status = 'Low';
                      let statusColor = 'bg-red-100 text-red-800';

                      if (average >= 30) {
                        status = 'High';
                        statusColor = 'bg-green-100 text-green-800';
                      } else if (average >= 10) {
                        status = 'Medium';
                        statusColor = 'bg-yellow-100 text-yellow-800';
                      }

                      return (
                        <tr key={index}>
                          <td className="font-bold text-lg">{item.bloodType}</td>
                          <td className="text-xl font-semibold">{item.quantity}</td>
                          <td>{average}</td>
                          <td>
                            <span className={`px-3 py-1 rounded-full text-sm ${statusColor}`}>
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No blood inventory data available.
              </div>
            )}
          </div>
        )}

        {reportType === 'donors' && (
          <div className="report-section">
            <h2 className="section-title">Donor Activity - Most Frequent Donors</h2>
            <p className="text-gray-600 mb-4">Top 10 donors by total donation volume (all-time)</p>
            {mostFrequentDonors.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Donor Name</th>
                      <th>Total Volume (ml)</th>
                      <th>Donation Count</th>
                      <th>Average per Donation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mostFrequentDonors.map((donor, index) => (
                      <tr key={donor.donorId}>
                        <td className="text-center">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${index === 0 ? 'bg-yellow-100 text-yellow-800' :
                            index === 1 ? 'bg-gray-100 text-gray-800' :
                              index === 2 ? 'bg-orange-100 text-orange-800' :
                                'bg-blue-50 text-blue-700'
                            }`}>
                            {index + 1}
                          </span>
                        </td>
                        <td className="font-medium">{donor.donorName}</td>
                        <td className="text-lg font-semibold">{donor.totalVolume} ml</td>
                        <td>{donor.donationCount}</td>
                        <td>{Math.round(donor.totalVolume / donor.donationCount)} ml</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No donor data available.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Main Reports Component
const Reports = ({ onNavigate }) => {
  return (
    <Layout onNavigate={onNavigate} currentPage="reports">
      <ReportsContent />
    </Layout>
  );
};

export default Reports;