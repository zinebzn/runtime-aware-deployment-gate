import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 40 },   // montée rapide
    { duration: '8m', target: 60 },   // forte saturation stable
    { duration: '2m', target: 0 },    // descente
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'],   // tolérance réaliste en stress
    http_req_failed: ['rate<0.05'],      // 5% max
  },
};

export default function () {
  const baseUrl = 'http://magento.local';

  let res1 = http.get(`${baseUrl}/`);
  check(res1, { 'home 200': (r) => r.status === 200 });

  let res2 = http.get(`${baseUrl}/customer/account/create/`);
  check(res2, { 'account page': (r) => r.status === 200 });

  let res3 = http.get(`${baseUrl}/privacy-policy-cookie-restriction-mode`);
  check(res3, { 'privacy page': (r) => r.status === 200 });

  sleep(1);
}
