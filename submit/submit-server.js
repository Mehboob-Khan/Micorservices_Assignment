const express = require('express');
const axios = require('axios'); // For making HTTP requests to the Joke service
const amqp = require('amqplib');
const path = require('path');
const app = express();
const port = 3200; // Different port from the Joke service
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');


// Serve the Swagger documentation at the /docs endpoint
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use(express.json());
app.use(express.static('public')); 

let rabbitMQChannel;

async function connectRabbitMQ(retryCount = 0) {
  try {
    const amqpConnectionString = `amqp://${process.env.RABBITMQ_DEFAULT_USER}:${process.env.RABBITMQ_DEFAULT_PASS}@rabbitmq`;
const connection = await amqp.connect(amqpConnectionString);

    rabbitMQChannel = await connection.createChannel();
    await rabbitMQChannel.assertQueue('SUBMITTED_JOKES');
    console.log("Connected to RabbitMQ and queue 'SUBMITTED_JOKES'");
  } catch (err) {
    console.error('Failed to connect to RabbitMQ:', err);
    const retryDelay = 5000; // milliseconds
    const maxRetries = 5;
    if (retryCount < maxRetries) {
      console.log(`Retrying to connect to RabbitMQ (${retryCount + 1}/${maxRetries})...`);
      setTimeout(() => connectRabbitMQ(retryCount + 1), retryDelay);
    } else {
      console.error('Failed to connect to RabbitMQ after retries:', err);
    }
  }
}

connectRabbitMQ().catch(console.error);

// Endpoint to fetch joke types from the Joke service or from a backup file
app.get('/types', async (req, res) => {
  try {
    const response = await axios.get('http://joke-service:3000/type');
    res.json(response.data);
  } catch (error) {
    // If the Joke service is down, serve from a backup file
    res.json(require('./backup-types.json'));
  }
});

// Endpoint to receive new jokes and send them to the message queue
app.post('/sub', async (req, res) => {
  try {
    const { setup, punchline, type } = req.body;
    await rabbitMQChannel.sendToQueue('SUBMITTED_JOKES', Buffer.from(JSON.stringify({ setup, punchline, type })));
    res.status(200).json({ message: 'Joke submitted to queue successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error submitting joke', error: error.message });
  }
});



app.listen(port, () => console.log(`Submit service listening at http://localhost:${port}`));
