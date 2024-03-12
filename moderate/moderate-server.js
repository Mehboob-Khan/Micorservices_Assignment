const express = require('express');
const axios = require('axios');
const amqp = require('amqplib');

const app = express();
const port = 3100; // Port for the moderate service
app.use(express.json());
app.use(express.static('public')); // Serve static files from the public directory

let rabbitMQChannel;
let currentJoke = null;

async function connectToRabbitMQ() {
  try {
    const connection = await amqp.connect('amqp://user:password@rabbitmq'); // Update with actual credentials
    rabbitMQChannel = await connection.createChannel();
    
    await rabbitMQChannel.assertQueue('SUBMITTED_JOKES');
    await rabbitMQChannel.assertQueue('MODERATED_JOKES');
    
    rabbitMQChannel.consume('SUBMITTED_JOKES', msg => {
      console.log('Message received from SUBMITTED_JOKES');
      currentJoke = JSON.parse(msg.content.toString());
      rabbitMQChannel.ack(msg);
    }, { noAck: false });
    
    console.log('Moderate service connected to RabbitMQ');
  } catch (error) {
    console.error('Failed to connect to RabbitMQ:', error);
  }
}

app.get('/types', async (req, res) => {
  try {
    const response = await axios.get('http://joke-service:3000/type');
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching joke types:', error);
    res.json(require('./backup-types.json'));
  }
});

app.get('/mod', (req, res) => {
  if (currentJoke) {
    res.json(currentJoke);
  } else {
    res.status(404).send('No joke available for moderation');
  }
});

app.post('/mod', async (req, res) => {
  const { setup, punchline, type, originalType, moderatorId } = req.body;
  const moderatedJoke = { setup, punchline, type };
  const isChanged = originalType !== type;

  try {
    await rabbitMQChannel.sendToQueue('MODERATED_JOKES', Buffer.from(JSON.stringify(moderatedJoke)));
    
    if (isChanged) {
      const logEntry = {
        submittedJoke: currentJoke,
        moderatedJoke,
        changed: isChanged,
        moderatorId,
        dateRead: new Date(),
        dateSubmitted: new Date()
      };
      await rabbitMQChannel.sendToQueue('LOGGED_JOKES_QUEUE', Buffer.from(JSON.stringify(logEntry)));
    }

    currentJoke = null;
    res.status(200).send('Joke moderated and submitted.');
  } catch (error) {
    console.error('Error in submitting moderated joke:', error);
    res.status(500).send('Error submitting moderated joke');
  }
});

connectToRabbitMQ().catch(console.error);

process.on('SIGINT', async () => {
  console.log('Closing RabbitMQ channel and connection...');
  await rabbitMQChannel.close();
  await connection.close();
  process.exit();
});

app.listen(port, () => console.log(`Moderate service running on http://localhost:${port}`));
