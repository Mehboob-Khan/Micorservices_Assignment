const amqp = require('amqplib');
const mysql = require('mysql2/promise');

// MySQL pool for database connections
const pool = mysql.createPool({
  host: 'db',
  user: 'root',
  password: 'password',
  database: 'jokesDB',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Insert a joke into the database if it does not already exist
async function insertJoke(joke) {
  const { setup, punchline, type } = joke;
  try {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      if (!await jokeExists(setup, punchline, connection)) {
        if (!await typeExists(type, connection)) {
          await insertType(type, connection);
        }
        const sql = 'INSERT INTO jokes (setup, punchline, type) VALUES (?, ?, ?)';
        await connection.query(sql, [setup, punchline, type]);
      }
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Failed to insert joke:', err.message);
    throw err;
  }
}

// Check if the joke already exists in the database
async function jokeExists(setup, punchline, connection) {
  const sql = 'SELECT COUNT(*) as count FROM jokes WHERE setup = ? AND punchline = ?';
  const [rows] = await connection.query(sql, [setup, punchline]);
  return rows[0].count > 0;
}

// Check if a joke type exists in the database
async function typeExists(type, connection) {
  const [rows] = await connection.query('SELECT COUNT(*) as count FROM jokes WHERE type = ?', [type]);
  return rows[0].count > 0;
}

// Insert a new joke type (placeholder function, implement as needed)
async function insertType(type, connection) {
  // Placeholder: Implement actual insertion logic for new types
  console.log(`Inserting new type '${type}' into database.`);
}

// Start the ETL Consumer function
async function startETLConsumer() {
  let connection, channel;
  try {
    connection = await amqp.connect('amqp://user:password@rabbitmq');
    channel = await connection.createChannel();
    await channel.assertQueue('MODERATED_JOKES');

    console.log("ETL Service: Waiting for messages in 'MODERATED_JOKES'. To exit press CTRL+C");
    channel.consume('MODERATED_JOKES', async (msg) => {
      const joke = JSON.parse(msg.content.toString());
      console.log("ETL Service: Received a moderated joke:", joke.setup);
      try {
        await insertJoke(joke);
        console.log("ETL Service: Joke processed successfully.");
        channel.ack(msg);
      } catch (err) {
        console.error("ETL Service: Failed to process joke:", err.message);
        // Consider delaying or routing the message to a "dead letter" queue for later analysis
        channel.nack(msg, false, true);
      }
    }, { noAck: false });
  } catch (err) {
    console.error('ETL Service: Failed to start:', err);
    if (channel) channel.close();
    if (connection) connection.close();
  }
}

startETLConsumer();
