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

async function insertJoke(joke) {
  const { setup, punchline, type } = joke;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    if (!await typeExists(type, connection)) {
      await insertType(type, connection);
    }

    const sql = 'INSERT INTO jokes (setup, punchline, type) VALUES (?, ?, ?)';
    const [result] = await connection.query(sql, [setup, punchline, type]);

    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

// Helper function to check if a joke type exists in the database
async function typeExists(type) {
  const [rows] = await pool.query('SELECT DISTINCT type FROM jokes WHERE type = ?', [type]);
  return rows.length > 0;
}


// Modified function to insert joke into the database
async function insertJoke(joke) {
  const { setup, punchline, type } = joke;
  const sql = 'INSERT INTO jokes (setup, punchline, type) VALUES (?, ?, ?)';
  try {
    const [result] = await pool.query(sql, [setup, punchline, type]);
    return result;
  } catch (err) {
    console.error('Failed to insert joke:', err.message);
    throw err;
  }
}



// Function to consume messages from RabbitMQ queue and insert into MySQL
async function startETLConsumer() {
  try {
    const connection = await amqp.connect('amqp://user:password@rabbitmq');
    const channel = await connection.createChannel();
    await channel.assertQueue('SUBMITTED_JOKES');

    console.log("ETL Service: Waiting for messages in 'SUBMITTED_JOKES'. To exit press CTRL+C");
    channel.consume('SUBMITTED_JOKES', async (msg) => {
      const joke = JSON.parse(msg.content.toString());
      console.log("ETL Service: Received a joke:", joke.setup);

      try {
        const insertResult = await insertJoke(joke);
        console.log("ETL Service: Joke inserted into the database with ID:", insertResult.insertId);
        channel.ack(msg);
      } catch (err) {
        console.error("ETL Service: Failed to insert joke into the database:", err.message);
        // Requeue the message to try again
        channel.nack(msg, false, true);
      }
    }, {
      noAck: false
    });
  } catch (err) {
    console.error('ETL Service: Failed to consume messages:', err);
  }
}

startETLConsumer();
