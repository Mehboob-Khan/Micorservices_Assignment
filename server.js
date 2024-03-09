const express = require('express');
const mysql = require('mysql2/promise');
const amqp = require('amqplib');

const app = express();
const port = 3000;

app.use(express.json()); // Middleware for parsing application/json
app.use(express.static('public'));

// MySQL connection settings with pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'db', // Use the environment variable or default to 'db'
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'jokesDB',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// RabbitMQ setup
let rabbitMQChannel;

// Retry connect to RabbitMQ
async function connectRabbitMQ(retryCount = 0) {
  try {
    const connection = await amqp.connect('amqp://user:password@rabbitmq');
    rabbitMQChannel = await connection.createChannel();
    await rabbitMQChannel.assertQueue('SUBMITTED_JOKES');
    console.log("Connected to RabbitMQ");
  } catch (err) {
    console.error('Failed to connect to RabbitMQ:', err);
    if (retryCount < 5) {
      setTimeout(() => connectRabbitMQ(retryCount + 1), 5000);
    } else {
      console.error('Failed to connect to RabbitMQ after retries:', err);
    }
  }
}

connectRabbitMQ();

// Connect to RabbitMQ
connectRabbitMQ().catch(err => console.error('Failed to connect to RabbitMQ:', err));

// GET endpoint for joke types with async/await
app.get('/type', async (req, res) => {
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

// POST endpoint to submit a new joke
app.post('/submit-joke', async (req, res) => {
  try {
    const { setup, punchline, type } = req.body;
    // Validate joke data here...

    await rabbitMQChannel.sendToQueue(
      'SUBMITTED_JOKES',
      Buffer.from(JSON.stringify({ setup, punchline, type }))
    );
    res.status(200).json({ message: 'Joke submitted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error submitting joke', error: err.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Joke service listening at http://localhost:${port}`);
});
