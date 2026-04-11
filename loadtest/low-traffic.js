import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 5 },  // montée douce
    { duration: '6m', target: 5 },  // trafic stable
    { duration: '2m', target: 0 },  // arrêt progressif
  ],
  thresholds: {
    http_req_duration: ['p(95)<1500'], // 95% < 1.5s
    http_req_failed: ['rate<0.01'],    // <1% d’erreurs
  },
};

const BASE_URL = 'http://magento.local';

export default function () {
  // Home page
  let home = http.get(`${BASE_URL}/`);
  check(home, {
    'home status 200': (r) => r.status === 200,
  });
  sleep(1);

  // Category page (ex: women/tops)
  let category = http.get(`${BASE_URL}/privacy-policy-cookie-restriction-mode`);
  check(category, {
    'category loaded': (r) => r.status === 200,
  });
  sleep(1);

  // Product page
  let product = http.get(`${BASE_URL}/customer/account/create/`);
  check(product, {
    'product page loaded': (r) => r.status === 200,
  });
  sleep(2);
}
