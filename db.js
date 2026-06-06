// db.js
const mysql = require('mysql2');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Chandini@123', // <--- TYPE YOUR REAL PASSWORD HERE INSIDE QUOTES
    database: 'github_analyzer',
    waitForConnections: true,
    connectionLimit: 10
});

module.exports = pool.promise();