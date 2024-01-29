const express = require('express');
const mysql = require('mysql2/promise'); // Change to mysql2/promise for pool support

const app = express();
const port = 3000;

// Static content directory for the UI
app.use(express.static('public'));

// MySQL connection settings with pool
const pool = mysql.createPool({
  host: 'db',
  user: 'root',
  password: 'password',
  database: 'jokesDB',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// GET endpoint for joke types with async/await
app.get('/types', async (req, res) => {
  try {
    const [results] = await pool.query('SELECT DISTINCT type FROM jokes');
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching joke types', error: err.message });
  }
});

// GET endpoint for random joke with async/await
app.get('/joke', async (req, res) => {
  const type = req.query.type || 'any';
  const count = parseInt(req.query.count, 10) || 1;

  let query = 'SELECT * FROM jokes ';
  let queryParams = [];

  if (type !== 'any') {
    query += 'WHERE type = ? ';
    queryParams.push(type);
  }

  query += 'ORDER BY RAND() LIMIT ?';
  queryParams.push(count);

  try {
    const [results] = await pool.query(query, queryParams);
    res.json(results[0] || { message: 'No jokes found' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching joke', error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Joke service listening at http://localhost:${port}`);
});
