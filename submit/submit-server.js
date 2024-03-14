const express = require('express');
const axios = require('axios');
const amqp = require('amqplib');
const path = require('path');
const app = express();
const port = process.env.PORT || 3200;
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use(express.json());
app.use(express.static('public'));

let rabbitMQChannel;

const jokeServiceURL = process.env.JOKE_SERVICE_URL || 'http://joke-service:3000/type';
const rabbitMQURL = process.env.RABBITMQ_URL || 'amqp://user:password@rabbitmq';

async function connectRabbitMQ(retryCount = 0) {
  try {
    const connection = await amqp.connect(rabbitMQURL);
    rabbitMQChannel = await connection.createChannel();
    await rabbitMQChannel.assertQueue('SUBMITTED_JOKES');
    console.log("Connected to RabbitMQ and queue 'SUBMITTED_JOKES'");
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

// Enhanced error handling for joke types fetch
app.get('/types', async (req, res) => {
  try {
    const response = await axios.get(jokeServiceURL);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching joke types from joke service, serving from backup:', error);
    res.json(require('./backup-types.json'));
  }
});

app.post('/sub', async (req, res) => {
  try {
    const { setup, punchline, type } = req.body;
    await rabbitMQChannel.sendToQueue('SUBMITTED_JOKES', Buffer.from(JSON.stringify({ setup, punchline, type })));
    res.status(200).json({ message: 'Joke submitted to queue successfully.' });
  } catch (error) {
    console.error('Error submitting joke to RabbitMQ:', error);
    res.status(500).json({ message: 'Error submitting joke', error: error.message });
  }
});

app.listen(port, () => console.log(`Submit service listening at http://localhost:${port}`));
