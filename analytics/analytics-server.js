require('dotenv').config(); // Reads .env file and merges it into process.env
const express = require('express');
const { MongoClient } = require('mongodb');
const bodyParser = require('body-parser');

// Constants for the MongoDB connection.
const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
  console.error('MongoDB connection string is not set in environment variables.');
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 3300;

// Middleware for parsing JSON bodies.
app.use(bodyParser.json());

// Create a new MongoClient.
const client = new MongoClient(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Connect to MongoDB.
client.connect(err => {
  if (err) {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  }
  console.log('Connected to MongoDB');
  db = client.db(); // No need to specify the database name; it's included in the connection string.
});

// Endpoint to post analytics data.
app.post('/analytics', async (req, res) => {
  try {
    const result = await db.collection('logs').insertOne(req.body);
    res.status(201).json({ id: result.insertedId });
  } catch (error) {
    console.error('Failed to insert analytics data', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to get analytics data.
app.get('/analytics', async (req, res) => {
  try {
    const logs = await db.collection('logs').find({}).toArray();
    res.status(200).json(logs);
  } catch (error) {
    console.error('Failed to retrieve analytics data', error);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Analytics service running on http://localhost:${port}`);
});
