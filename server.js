// server.js  (MAIN SERVER FILE - create this in project root)
const express = require('express');
const app = express();

// Import your Firebase config
const firebase = require('./firebase'); // or your firebase config file

// Your routes and middleware here
app.get('/', (req, res) => {
    res.send('Server is running with Firebase!');
});

// API endpoints
app.get('/api/data', (req, res) => {
    // Use Firebase here
    res.json({ message: 'Firebase data' });
});

// ⭐⭐⭐ PORT BINDING GOES HERE ⭐⭐⭐
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`✅ Firebase is connected and ready`);
});