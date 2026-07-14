import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    real_spike: {
      executor: 'ramping-arrival-rate',
      startRate: 50,              // Khởi đầu với 50 requests/s
      timeUnit: '1s',
      preAllocatedVUs: 100,       // Cấp phát trước 100 VUs để tránh trễ khởi tạo
      maxVUs: 1000,               // Giới hạn tối đa 1000 VUs để bảo vệ tài nguyên máy test
      stages: [
        { duration: '5s', target: 3000 },  // Trong 5 giây, giật thẳng lên 3.000 requests/s (Cơn bão F5)
        { duration: '15s', target: 3000 }, // Giữ tải đỉnh 3.000 req/s trong 15 giây để thử độ bền
        { duration: '5s', target: 50 },    // Hạ nhiệt nhanh về 50 req/s trong 5 giây
      ],
    },
  },
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
}

