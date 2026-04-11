import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // montée
    { duration: '6m', target: 150 },   // forte charge
    { duration: '2m', target: 0 },     // descente
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const res = http.get('http://nginx.local/');
  check(res, { 
    'status is 200': (r) => r.status === 200,
  });
  sleep(0.5);
}
