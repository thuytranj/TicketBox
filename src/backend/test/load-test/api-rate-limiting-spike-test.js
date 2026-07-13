import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 200 },  // Quick ramp-up to 200 VUs to generate high request rate
    { duration: '20s', target: 200 },  // Maintain VUs
    { duration: '10s', target: 0 },    // Ramp-down
  ],
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const url = `${BASE_URL}/api/v1/concerts`;
  const res = http.get(url, {
    tags: { name: 'GetConcertsRateLimit' },
  });

  // Since all requests come from the same IP, k6 will exceed 50 req/s very quickly.
  // We expect Nginx to return 429 when the limit is exceeded.
  check(res, {
    'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
    'status is 429 (Rate Limited)': (r) => r.status === 429,
    'rate limit header is gateway': (r) => r.headers['X-Ratelimit-Source'] === 'gateway',
  });

  // Small sleep to control request rate per VU, but 200 VUs will easily exceed 50 req/s
  sleep(0.1); 
}
