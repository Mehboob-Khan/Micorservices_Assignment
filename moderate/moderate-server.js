const express = require('express');
const axios = require('axios');
const amqp = require('amqplib');

const app = express();
const port = 3100;
app.use(express.json());
app.use(express.static('public'));

let rabbitMQChannel;
let connection; // Make connection accessible for SIGINT handler
let currentJoke = null;

async function connectToRabbitMQ(retryCount = 0) {
  try {
    connection = await amqp.connect('amqp://user:password@rabbitmq');
    rabbitMQChannel = await connection.createChannel();

    await rabbitMQChannel.assertQueue('SUBMITTED_JOKES');
    await rabbitMQChannel.assertQueue('MODERATED_JOKES');

    rabbitMQChannel.consume('SUBMITTED_JOKES', (msg) => {
      if (!currentJoke) { // Load the first available joke for moderation
        currentJoke = JSON.parse(msg.content.toString());
        console.log('Received joke for moderation:', currentJoke);
      }
      rabbitMQChannel.ack(msg);
    });

    console.log('Connected to RabbitMQ and waiting for messages...');
  } catch (error) {
    console.error('Failed to connect to RabbitMQ:', error);
    if (retryCount < 5) {
      setTimeout(() => connectToRabbitMQ(retryCount + 1), 5000); // Retry connection
    }
  }
}

app.get('/types', async (req, res) => {
  try {
    const response = await axios.get('http://joke-service:3000/type');
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching joke types from joke service, serving from backup:', error);
    res.json(require('./backup-types.json'));
  }
});

app.get('/mod', (req, res) => {
  if (currentJoke) {
    res.json(currentJoke);
  } else {
    // Respond with a friendly message instead of a 404 status
    res.status(200).json({ message: 'No joke available for moderation at the moment. Please check back later.' });
  }
});

app.post('/mod', async (req, res) => {
  console.log('POST /mod:', req.body);

  const moderatedJoke = req.body; // Assuming the body already has the setup, punchline, and type

  try {
    await rabbitMQChannel.sendToQueue('MODERATED_JOKES', Buffer.from(JSON.stringify(moderatedJoke)));
    currentJoke = null; // Prepare for the next joke
    res.status(200).json({ message: 'Joke moderated and submitted successfully.' });
  } catch (error) {
    console.error('Error submitting moderated joke:', error);
    res.status(500).json({ message: 'Error submitting moderated joke', error: error.message });
  }
});

app.delete('/mod', (req, res) => {
  currentJoke = null; // Prepare for the next joke
  res.status(200).json({ message: 'Joke deleted successfully. Ready for the next joke.' });
});

connectToRabbitMQ().catch(console.error);

process.on('SIGINT', async () => {
  console.log('Closing RabbitMQ channel and connection...');
  if (rabbitMQChannel) {
    await rabbitMQChannel.close();
  }
  if (connection) {
    await connection.close();
  }
  process.exit();
});

app.listen(port, () => {
  console.log(`Moderate service running on http://localhost:${port}`);
});
