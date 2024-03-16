const express = require('express');
const axios = require('axios');
const amqp = require('amqplib');
const path = require('path');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3200;
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use(express.json());
app.use(express.static(__dirname + '/public'));

const rabbitMQURL = process.env.RABBITMQ_URL || 'amqp://user:password@rabbitmq';
const jokeServiceURL = process.env.JOKE_SERVICE_URL || 'http://joke-service:3000/type';
const backupTypesFilePath = path.join(__dirname, 'backup-types.json');
let rabbitMQChannel;

async function connectRabbitMQ(retryCount = 0) {
  console.log(`Attempting to connect to RabbitMQ at ${rabbitMQURL}, attempt ${retryCount + 1}`);
  try {
    const connection = await amqp.connect(rabbitMQURL);
    rabbitMQChannel = await connection.createChannel();
    await rabbitMQChannel.assertQueue('SUBMITTED_JOKES');
    console.log("Connected to RabbitMQ and queue 'SUBMITTED_JOKES'");
  } catch (err) {
    console.error('Failed to connect to RabbitMQ:', err);
    if (retryCount < 5) {
      setTimeout(() => connectRabbitMQ(retryCount + 1), 5000 * (retryCount + 1)); // Exponential backoff
    } else {
      console.error('Failed to connect to RabbitMQ after retries:', err);
      process.exit(1);
    }
  }
}

connectRabbitMQ();

app.get('/types', async (req, res) => {
  try {
    const response = await axios.get(jokeServiceURL);
    res.json(response.data);
  } catch (error) {
    console.error('Joke service is down, serving from backup:', error.message);
    try {
      const backupTypes = JSON.parse(fs.readFileSync(backupTypesFilePath, 'utf8'));
      res.json(backupTypes);
    } catch (backupError) {
      console.error('Failed to read backup types:', backupError.message);
      res.status(500).json({ message: 'Failed to fetch joke types from backup', error: backupError.message });
    }
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
