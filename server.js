const express = require('express');
const http = require('http'); // Import HTTP module
const { Server } = require('socket.io'); // Import Server class from socket.io
const mysql = require('mysql2/promise');
const amqp = require('amqplib');

const app = express();
const server = http.createServer(app); // Wrap the express app with HTTP server
const io = new Server(server); // Initialize a new instance of socket.io by passing the HTTP server object

const port = 3000;

app.use(express.json());
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


let rabbitMQChannel;

async function connectRabbitMQ(retryCount = 0) {
  try {
    const connection = await amqp.connect('amqp://user:password@rabbitmq');
    rabbitMQChannel = await connection.createChannel();
    await rabbitMQChannel.assertQueue('SUBMITTED_JOKES');
    console.log("Connected to RabbitMQ");

    // Listen for messages in the queue and emit them to connected clients
    rabbitMQChannel.consume('SUBMITTED_JOKES', (msg) => {
      const joke = JSON.parse(msg.content.toString());
      // Emit the joke to all connected clients
      io.emit('new_joke', joke);
      rabbitMQChannel.ack(msg);
    }, { noAck: false });

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

// POST endpoint to submit a new joke (Updated)
app.post('/joke', async (req, res) => {
  try {
    const { setup, punchline, type } = req.body;
    // Validate joke data here...

    await rabbitMQChannel.sendToQueue(
      'MODERATED_JOKES', // Assuming this is the queue for moderated (approved) jokes
      Buffer.from(JSON.stringify({ setup, punchline, type }))
    );
    res.status(200).json({ message: 'Joke submitted for moderation.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error submitting joke for moderation', error: err.message });
  }
});


server.listen(port, () => {
  console.log(`Joke service listening at http://localhost:${port}`);
});
