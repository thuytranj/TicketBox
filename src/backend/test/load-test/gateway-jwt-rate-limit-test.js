import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const users = new SharedArray('users', function () {
  return JSON.parse(open('./users-tokens.json'));
});

export const options = {
  scenarios: {
    gateway_jwt_limit_test: {
      executor: 'per-vu-iterations',
      vus: 1,         // Just 1 virtual user
      iterations: 15, // Try 15 booking attempts in sequence
      maxDuration: '30s',
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const CONCERT_ID = __ENV.CONCERT_ID || '019f4747-645c-7049-8bf3-c49cc8da77af';
const TICKET_TYPE_ID = __ENV.TICKET_TYPE_ID || '019f4747-645c-7e21-a972-6a3ce99c6811';

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function () {
  // Use user 0
  const user = users[0];
  const url = `${BASE_URL}/api/v1/bookings`;
  
  const payload = JSON.stringify({
    concertId: CONCERT_ID,
    items: [
      {
        ticketTypeId: TICKET_TYPE_ID,
        quantity: 1,
      },
    ],
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${user.token}`,
      'Idempotency-Key': uuidv4(),
    },
    tags: { name: 'GatewayJWTLimitBooking' },
  };

  const res = http.post(url, payload, params);

  // The first 10 requests should hit the backend (getting 202/400/409).
  // The 11th request onwards should get HTTP 429 and X-RateLimit-Source = gateway-user.
  check(res, {
    'status is 202, 400, or 429': (r) => [202, 400, 429].includes(r.status),
    'rate limited request is 429 with correct header': (r) => r.status !== 429 || (r.status === 429 && r.headers['X-Ratelimit-Source'] === 'gateway-user'),
  });

  // Short sleep to run sequentially
  sleep(0.1);
}
