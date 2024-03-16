const express = require('express');
const axios = require('axios');
const amqp = require('amqplib');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3100;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let rabbitMQChannel;
let connection;
let currentJoke = null;

async function connectToRabbitMQ() {
  const rabbitMQURL = 'amqp://user:password@rabbitmq'; // Update with actual credentials and host
  try {
    connection = await amqp.connect(rabbitMQURL);
    rabbitMQChannel = await connection.createChannel();

    await rabbitMQChannel.assertQueue('SUBMITTED_JOKES');
    await rabbitMQChannel.assertQueue('MODERATED_JOKES');

    console.log('Waiting for messages in SUBMITTED_JOKES...');
    rabbitMQChannel.consume('SUBMITTED_JOKES', (msg) => {
      if (msg) {
        console.log("Received a joke for moderation");
        currentJoke = JSON.parse(msg.content.toString());
        rabbitMQChannel.ack(msg);
      }
    });

  } catch (error) {
    console.error('Failed to connect to RabbitMQ:', error);
  }
}

connectToRabbitMQ();

app.get('/types', async (req, res) => {
  try {
    const response = await axios.get('http://joke-service:3000/type');
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching joke types from joke service:', error.message);
    // Serve from backup if joke service is down
    const backupTypes = JSON.parse(fs.readFileSync(path.join(__dirname, 'backup-types.json'), 'utf8'));
    res.json(backupTypes);
  }
});

app.get('/mod', (req, res) => {
  if (currentJoke) {
    res.json(currentJoke);
  } else {
    res.status(200).json({ message: 'No jokes available for moderation. Please check back later or add a new joke manually.' });
  }
});

app.post('/mod', async (req, res) => {
  const { setup, punchline, type, action } = req.body;
  if (action === 'submit') {
    try {
      // Submit the joke to MODERATED_JOKES or directly to your database as needed
      await rabbitMQChannel.sendToQueue('MODERATED_JOKES', Buffer.from(JSON.stringify({ setup, punchline, type })));
      currentJoke = null; // Reset current joke
      res.json({ message: 'Joke approved and submitted successfully.' });
    } catch (error) {
      console.error('Error submitting joke:', error);
      res.status(500).json({ message: 'Failed to submit joke', error: error.message });
    }
  } else if (action === 'delete') {
    currentJoke = null; // Simply discard the current joke
    res.json({ message: 'Joke discarded successfully.' });
  } else {
    res.status(400).json({ message: 'Invalid action specified.' });
  }
});

// No need for explicit authentication as per the current request

process.on('SIGINT', async () => {
  console.log('Closing RabbitMQ channel and connection...');
  if (rabbitMQChannel) await rabbitMQChannel.close();
  if (connection) await connection.close();
  process.exit();
});

app.listen(port, () => console.log(`Moderate service running on http://localhost:${port}`));
