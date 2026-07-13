import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const users = new SharedArray('users', function () {
  return JSON.parse(open('./users-tokens.json'));
});

export const options = {
  scenarios: {
    payment_rate_limit_test: {
      executor: 'per-vu-iterations',
      vus: 1,         // 1 virtual user
      iterations: 6,  // Try 6 payment attempts in sequence
      maxDuration: '20s',
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const user = users[0];
  const url = `${BASE_URL}/api/v1/payments/momo`;
  
  const payload = JSON.stringify({}); // Empty payload triggers 400 validation error in NestJS

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${user.token}`,
      'Idempotency-Key': 'test-idempotency-key-' + Math.random(),
    },
    tags: { name: 'PaymentRateLimit' },
  };

  const res = http.post(url, payload, params);

  // In ra log để dễ dàng quan sát kết quả của từng request trên Terminal
  console.log(`[Request ${__ITER + 1}/6] Status Code: ${res.status} | RateLimit-Source: ${res.headers['X-Ratelimit-Source'] || 'none'}`);

  // The first 3 requests should hit the backend (getting 400/409/etc).
  // The 4th request onwards should get HTTP 429 and X-RateLimit-Source = gateway-user.
  check(res, {
    'status is 400, 409, or 429': (r) => [400, 409, 429].includes(r.status),
    'rate limited request is 429 with correct header': (r) => r.status !== 429 || (r.status === 429 && r.headers['X-Ratelimit-Source'] === 'gateway-user'),
  });


  // Short sleep to run sequentially
  sleep(0.1);
}
