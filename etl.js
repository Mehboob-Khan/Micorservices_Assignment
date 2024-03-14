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



// Start the ETL Consumer function (Updated)
async function startETLConsumer() {
  try {
    const connection = await amqp.connect('amqp://user:password@rabbitmq');
    const channel = await connection.createChannel();
    await channel.assertQueue('MODERATED_JOKES'); // Listen to the MODERATED_JOKES queue

    console.log("ETL Service: Waiting for messages in 'MODERATED_JOKES'. To exit press CTRL+C");
    channel.consume('MODERATED_JOKES', async (msg) => {
      const joke = JSON.parse(msg.content.toString());
      console.log("ETL Service: Received a moderated joke:", joke.setup);

      try {
        const insertResult = await insertJoke(joke);
        console.log("ETL Service: Moderated joke inserted into the database with ID:", insertResult.insertId);
        channel.ack(msg);
      } catch (err) {
        console.error("ETL Service: Failed to insert moderated joke into the database:", err.message);
        channel.nack(msg, false, true);
      }
    }, {
      noAck: false
    });
  } catch (err) {
    console.error('ETL Service: Failed to consume moderated jokes:', err);
  }
}


startETLConsumer();
