const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from src/backend/.env
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433', 10),
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || '123123123',
  database: process.env.DB_DATABASE || 'ticketbox',
};

const JWT_SECRET = process.env.JWT_SECRET || '4fjAifDnpexXnXf9vlmLUGV2hZTTwzBSFfYUzbGgNTw=';

async function main() {
  console.log('Connecting to database:', dbConfig.database, 'on', dbConfig.host + ':' + dbConfig.port);
  const client = new Client(dbConfig);
  await client.connect();

  try {
    console.log('Generating 1000 load-test users...');
    const users = [];
    const tokens = [];

    // We will generate the users list
    for (let i = 1; i <= 1000; i++) {
      const userId = crypto.randomUUID();
      const email = `loadtest_user_${i.toString().padStart(4, '0')}@ticketbox.test`;
      const fullName = `LoadTest User ${i}`;
      // A dummy bcrypt hash for password (not used during load test, but required by schema)
      const passwordHash = '$2b$10$K4.c2pM3p4sMv1r5G6s7eOwU5uC9D6g9H9I9J9K9L9M9N9O9P9Q9R';

      users.push({
        id: userId,
        email,
        passwordHash,
        fullName,
        role: 'audience',
        status: 'active',
      });
    }

    // Insert users using a transaction & batch INSERT
    console.log('Starting transaction to insert users into DB...');
    await client.query('BEGIN');
    
    // To support re-running the script, we can clean up old loadtest users first
    console.log('Cleaning up existing load-test tickets, orders, and users...');
    await client.query(`
      DELETE FROM tickets 
      WHERE order_id IN (
        SELECT id FROM orders 
        WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'loadtest_user_%@ticketbox.test')
      )
    `);
    await client.query(`
      DELETE FROM orders 
      WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'loadtest_user_%@ticketbox.test')
    `);
    await client.query("DELETE FROM users WHERE email LIKE 'loadtest_user_%@ticketbox.test'");


    console.log('Inserting users...');
    // We can construct a multi-value INSERT statement
    const values = [];
    const valuePlaceholders = [];
    let paramIndex = 1;

    for (const u of users) {
      valuePlaceholders.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5})`);
      values.push(u.id, u.email, u.passwordHash, u.fullName, u.role, u.status);
      paramIndex += 6;
    }

    const insertQuery = `
      INSERT INTO users (id, email, password_hash, full_name, role, status)
      VALUES ${valuePlaceholders.join(', ')}
    `;

    await client.query(insertQuery, values);
    await client.query('COMMIT');
    console.log('Successfully inserted 1000 users into database.');

    // Now sign JWT tokens
    console.log('Signing JWT tokens for users...');
    for (const u of users) {
      const token = jwt.sign(
        { userId: u.id, email: u.email, role: u.role },
        JWT_SECRET,
        { expiresIn: '30d' } // Long expiration for testing purposes
      );

      tokens.push({
        userId: u.id,
        email: u.email,
        token,
      });
    }

    // Write tokens to file
    const outputPath = path.join(__dirname, '../users-tokens.json');
    fs.writeFileSync(outputPath, JSON.stringify(tokens, null, 2), 'utf-8');
    console.log('Successfully wrote user tokens to:', outputPath);

  } catch (err) {
    console.error('Error during execution:', err);
    await client.query('ROLLBACK');
  } finally {
    await client.end();
  }
}

main();
