const axios = require('axios');
const Redis = require('ioredis');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

// MoMo config keys
const momoPartnerCode = process.env.MOMO_PARTNER_CODE || 'MOMO';
const momoAccessKey = process.env.MOMO_ACCESS_KEY || 'F8BBA842ECF85';
const momoSecretKey = process.env.MOMO_SECRET_KEY || 'K951B6PE1waDMi640xX08PD3vg6EkVlz';

// Helper for MoMo signature calculation
function signMomoPayload(payload, secretKey) {
  const rawSignature = [
    `accessKey=${payload.accessKey}`,
    `amount=${payload.amount}`,
    `extraData=${payload.extraData}`,
    `message=${payload.message}`,
    `orderId=${payload.orderId}`,
    `orderInfo=${payload.orderInfo}`,
    `orderType=${payload.orderType}`,
    `partnerCode=${payload.partnerCode}`,
    `payType=${payload.payType}`,
    `requestId=${payload.requestId}`,
    `responseTime=${payload.responseTime}`,
    `resultCode=${payload.resultCode}`,
    `transId=${payload.transId}`,
  ].join('&');

  return crypto
    .createHmac('sha256', secretKey)
    .update(rawSignature)
    .digest('hex');
}

async function runSmokeTest() {
  console.log('==================================================');
  console.log('TICKETBOX E2E SMOKE TEST STARTED (MOMO)');
  console.log(`API URL: ${BASE_URL}`);
  console.log(`Redis: ${redisConfig.host}:${redisConfig.port}`);
  console.log('==================================================\n');

  let redis;
  try {
    redis = new Redis(redisConfig);
  } catch (err) {
    console.error('[ERROR] Failed to connect to Redis:', err.message);
    process.exit(1);
  }

  try {
    // ----------------------------------------------------
    // STEP 1: FETCH ACTIVE CONCERTS (CATALOG)
    // ----------------------------------------------------
    console.log('Step 1: Fetching active concerts...');
    const concertsRes = await axios.get(`${BASE_URL}/concerts?status=active&page=1&limit=10`);
    const concerts = concertsRes.data.data?.concerts || concertsRes.data.concerts || [];

    if (concerts.length === 0) {
      console.log('[WARNING] No active concerts found in database. Please seed the database first!');
      console.log('[INFO] Run: npm run db:seed');
      process.exit(1);
    }

    const targetConcert = concerts[0];
    console.log(`[SUCCESS] Found active concert: "${targetConcert.title}" (ID: ${targetConcert.id})`);

    // Fetch ticket types for this concert
    const ticketTypesRes = await axios.get(`${BASE_URL}/concerts/${targetConcert.id}/ticket-types`);
    const ticketTypes = ticketTypesRes.data.data || ticketTypesRes.data || [];

    if (ticketTypes.length === 0) {
      console.log('[WARNING] No ticket types configured for this concert.');
      process.exit(1);
    }

    const targetTicketType = ticketTypes[0];
    console.log(`[SUCCESS] Selected ticket type: "${targetTicketType.name}" - Price: ${targetTicketType.price} VND (Available: ${targetTicketType.availableQuantity})`);

    // ----------------------------------------------------
    // STEP 2: USER REGISTRATION
    // ----------------------------------------------------
    console.log('\nStep 2: Registering a new test user...');
    const randomSuffix = Math.floor(Math.random() * 10000);
    const email = `smoketest_${randomSuffix}@ticketbox.test`;
    const password = 'Password123!';
    const fullName = `Smoke Test User ${randomSuffix}`;

    await axios.post(`${BASE_URL}/auth/register`, {
      email,
      password,
      fullName,
    });
    console.log(`[SUCCESS] Registered user: ${email}`);

    // ----------------------------------------------------
    // STEP 3: EXTRACT OTP FROM REDIS & VERIFY
    // ----------------------------------------------------
    console.log('\nStep 3: Extracting OTP from Redis...');
    const otpKey = `otp:${email}`;
    const otp = await redis.get(otpKey);

    if (!otp) {
      throw new Error(`OTP not found in Redis for key: ${otpKey}`);
    }
    console.log(`[SUCCESS] Retrieved OTP from Redis: ${otp}`);

    console.log('Verifying OTP to activate account...');
    await axios.post(`${BASE_URL}/auth/verify-otp`, {
      email,
      otp,
    });
    console.log('[SUCCESS] Account activated successfully!');

    // ----------------------------------------------------
    // STEP 4: LOGIN TO GET JWT TOKEN
    // ----------------------------------------------------
    console.log('\nStep 4: Logging in...');
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email,
      password,
    });
    const { accessToken } = loginRes.data.data || loginRes.data;
    console.log('[SUCCESS] Logged in successfully. Token received.');

    const authHeaders = {
      Authorization: `Bearer ${accessToken}`,
      'idempotency-key': crypto.randomUUID(),
    };

    // ----------------------------------------------------
    // STEP 5: CREATE BOOKING (ORDER)
    // ----------------------------------------------------
    console.log('\nStep 5: Creating booking (ordering tickets)...');
    const bookingRes = await axios.post(
      `${BASE_URL}/bookings`,
      {
        concertId: targetConcert.id,
        items: [
          {
            ticketTypeId: targetTicketType.id,
            quantity: 1,
          },
        ],
      },
      { headers: authHeaders }
    );
 
    const bookingJob = bookingRes.data.data || bookingRes.data;
    const orderId = bookingJob.id || bookingJob.orderId;
    console.log(`[SUCCESS] Booking request accepted. Order ID: ${orderId}`);
 
    // Polling order status until it is 'pending'
    console.log('Waiting for queue worker to process booking...');
    let order = null;
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const checkRes = await axios.get(`${BASE_URL}/bookings/${orderId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      order = checkRes.data.data || checkRes.data;
      if (order.status !== 'processing') {
        break;
      }
    }
 
    if (!order || order.status !== 'pending') {
      throw new Error(`Booking processing failed. Final status: ${order?.status}`);
    }
    console.log(`[SUCCESS] Booking processed. Status: "${order.status}" - Total Amount: ${order.totalAmount} VND`);
 
    // ----------------------------------------------------
    // STEP 6: SIMULATE MOMO WEBHOOK
    // ----------------------------------------------------
    console.log('\nStep 6: Simulating MoMo payment webhook callback...');
    
    // Build parameters matching MoMo IPN format
    const momoPayload = {
      partnerCode: momoPartnerCode,
      accessKey: momoAccessKey,
      requestId: `${orderId}-${Date.now()}`,
      amount: String(order.totalAmount),
      orderId: orderId,
      orderInfo: `Payment for booking ${orderId}`,
      orderType: 'momo_wallet',
      transId: '888888888',
      resultCode: 0,
      message: 'Successful.',
      payType: 'web',
      responseTime: String(Date.now()),
      extraData: '',
    };
 
    // Calculate signature
    const signature = signMomoPayload(momoPayload, momoSecretKey);
    momoPayload.signature = signature;
 
    console.log('Sending MoMo webhook IPN to backend...');
    const webhookRes = await axios.post(`${BASE_URL}/payments/momo/webhook`, momoPayload);
    console.log('[SUCCESS] Webhook IPN response:', JSON.stringify(webhookRes.data));
 
    // ----------------------------------------------------
    // STEP 7: VERIFY FINAL ORDER AND E-TICKET STATUS
    // ----------------------------------------------------
    console.log('\nStep 7: Verifying ticket generation and order status...');
    const finalOrderRes = await axios.get(`${BASE_URL}/bookings/${orderId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const finalOrder = finalOrderRes.data.data || finalOrderRes.data;
 
    console.log(`[INFO] Final Order Status: "${finalOrder.status}"`);
 
    if (finalOrder.status !== 'paid') {
      throw new Error(`Order was not paid. Status: ${finalOrder.status}`);
    }
 
    const tickets = finalOrder.tickets || [];
    console.log(`[SUCCESS] Number of tickets generated: ${tickets.length}`);
 
    tickets.forEach((ticket, index) => {
      console.log(`Ticket #${index + 1}:`);
      console.log(`   - ID: ${ticket.id}`);
      console.log(`   - Status: ${ticket.status}`);
      console.log(`   - QR Code Hash: ${ticket.qrCodeHash}`);
    });
 
    console.log('\n==================================================');
    console.log('TICKETBOX SMOKE TEST PASSED SUCCESSFULLY (MOMO)!');
    console.log('==================================================');
  } catch (err) {
    console.error('\n[ERROR] Smoke Test failed with error:');
    if (err.response) {
      console.error(`   API Error: ${err.response.status} - ${JSON.stringify(err.response.data)}`);
    } else {
      console.error(`   ${err.message}`);
    }
  } finally {
    if (redis) {
      redis.disconnect();
    }
  }
}
 
runSmokeTest();
