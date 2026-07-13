import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

// Load pre-generated user tokens
const users = new SharedArray('users', function () {
  return JSON.parse(open('./users-tokens.json'));
});

export const options = {
  scenarios: {
    booking_concurrency: {
      executor: 'per-vu-iterations',
      vus: 500,        // 500 concurrent virtual users
      iterations: 1,   // Each user makes exactly 1 attempt
      maxDuration: '30s',
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const CONCERT_ID = __ENV.CONCERT_ID || '019f4747-645c-7049-8bf3-c49cc8da77af'; // Rock Storm 2026
const TICKET_TYPE_ID = __ENV.TICKET_TYPE_ID || '019f4747-645c-7e21-a972-6a3ce99c6811'; // Rock VIP Pit (200 qty)

// Helper function to generate UUID v4 for Idempotency-Key
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function () {
  // Select user based on virtual user index (VU starts at 1)
  const userIndex = (__VU - 1) % users.length;
  const user = users[userIndex];

  const url = `${BASE_URL}/api/v1/bookings`;
  
  const payload = JSON.stringify({
    concertId: CONCERT_ID,
    items: [
      {
        ticketTypeId: TICKET_TYPE_ID,
        quantity: 1, // Attempt to buy 1 ticket
      },
    ],
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${user.token}`,
      'Idempotency-Key': uuidv4(),
    },
    tags: { name: 'CreateBooking' },
  };

  // Send POST request
  const res = http.post(url, payload, params);

  // We check response codes. Since there are only 200 tickets available:
  // - 200 requests should return 202 (Accepted)
  // - 300 requests should return 400 (Bad Request - Insufficient Stock)
  check(res, {
    'status is 202 or 400': (r) => r.status === 202 || r.status === 400,
    'status is 202 (Success)': (r) => r.status === 202,
    'status is 400 (Sold out)': (r) => r.status === 400,
  });

  sleep(0.5);
}
