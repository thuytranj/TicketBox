import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

// Load pre-generated user tokens
const users = new SharedArray('users', function () {
  return JSON.parse(open('./users-tokens.json'));
});

export const options = {
  scenarios: {
    user_limit_test: {
      executor: 'per-vu-iterations',
      vus: 10,         // 10 concurrent connections
      iterations: 1,   // Each VU runs exactly once
      maxDuration: '10s',
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const CONCERT_ID = __ENV.CONCERT_ID || '019f4747-645c-7049-8bf3-c49cc8da77af'; // Rock Storm 2026
const TICKET_TYPE_ID = __ENV.TICKET_TYPE_ID || '019f4747-645c-7e21-a972-6a3ce99c6811'; // Rock VIP Pit (limit 2 per account)

// Helper function to generate UUID v4 for Idempotency-Key
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function () {
  // All 10 VUs will use the exact SAME user (user 0) to check concurrency limits per-user
  const user = users[0];

  const url = `${BASE_URL}/api/v1/bookings`;
  
  const payload = JSON.stringify({
    concertId: CONCERT_ID,
    items: [
      {
        ticketTypeId: TICKET_TYPE_ID,
        quantity: 1, // Order 1 ticket
      },
    ],
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${user.token}`,
      'Idempotency-Key': uuidv4(), // Every request needs a unique idempotency key
    },
    tags: { name: 'PerUserLimitBooking' },
  };

  const res = http.post(url, payload, params);

  // Since the user is limited to 4 tickets for Rock VIP Pit:
  // - Exactly 4 requests should return HTTP 202 (Accepted)
  // - Remaining requests should return HTTP 400 (Bad Request - Purchase limit exceeded)
  check(res, {
    'status is 202 or 400': (r) => r.status === 202 || r.status === 400,
    'status is 202 (Success)': (r) => r.status === 202,
    'status is 400 (Limit Exceeded)': (r) => r.status === 400,
  });

  sleep(1);
}
