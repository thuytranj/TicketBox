import http from 'k6/http';
import { check, sleep } from 'k6';

// k6 configuration options
export const options = {
  stages: [
    { duration: '20s', target: 200 },  // Ramp-up to 200 users
    { duration: '40s', target: 200 },  // Stay at 200 users for 40s
    { duration: '10s', target: 0 },    // Ramp-down to 0 users
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],    // Error rate must be less than 1%
    http_req_duration: ['avg<50'],     // Average latency must be below 50ms (Cache requirement)
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
// Fallback Concert ID in case the listing is empty
const FALLBACK_CONCERT_ID = __ENV.CONCERT_ID || '0190a618-97e3-7b44-904b-32435e12f6b8';

export default function () {
  // 1. GET /api/v1/concerts (Read concert list)
  const listUrl = `${BASE_URL}/api/v1/concerts`;
  const listRes = http.get(listUrl, {
    tags: { name: 'GetConcertList' },
  });

  const listOk = check(listRes, {
    'get concerts status is 200': (r) => r.status === 200,
    'get concerts body has data': (r) => r.json() && r.json().data && r.json().data.concerts && r.json().data.concerts.length > 0,
  });

  let concertId = FALLBACK_CONCERT_ID;

  if (listOk) {
    const concerts = listRes.json().data.concerts;
    if (concerts && concerts.length > 0) {
      // Pick a random concert from the list to simulate real user behavior
      const randomIndex = Math.floor(Math.random() * concerts.length);
      concertId = concerts[randomIndex].id;
    }
  }

  sleep(1); // Sleep for 1 second

  // 2. GET /api/v1/concerts/:id (Read concert details - checking Cache)
  const detailUrl = `${BASE_URL}/api/v1/concerts/${concertId}`;
  const detailRes = http.get(detailUrl, {
    tags: { name: 'GetConcertDetail' },
  });

  check(detailRes, {
    'get concert detail status is 200': (r) => r.status === 200,
    'get concert detail has correct id': (r) => r.json() && r.json().data && r.json().data.id === concertId,
  });

  sleep(1);
}
