/* eslint-disable no-console */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

// الرابط الجديد بتاعك على Render بعد ما بقى Live
const BASE = process.env.SMOKE_BASE_URL || 'https://msa-api-2u3z.onrender.com';

// كلمة السر الافتراضية - خليها زي ما هي أو غيرها لو حابب
const PASSWORD = process.env.SEED_DEFAULT_PASSWORD || 'ChangeMe!2026';

const roleAccounts = [
  { role: 'Founder', email: 'amr@msa-agency.com' },
  { role: 'Strategist', email: 'sally@msa-agency.com' },
  { role: 'Creative', email: 'menna@msa-agency.com' },
  { role: 'Analyst', email: 'ibrahim@msa-agency.com' },
  { role: 'News', email: 'newsdesk@msa-agency.com' },
  { role: 'Growth_Manager', email: 'growth@msa-agency.com' },
  { role: 'Operations', email: 'ops@msa-agency.com' },
];

const tests = [
  { key: 'success.get', method: 'GET', path: '/api/admin/success', body: null, allowed: ['Founder', 'Strategist', 'News', 'Operations'] },
  { key: 'success.post', method: 'POST', path: '/api/admin/success', body: {}, allowed: ['Founder', 'Strategist', 'News', 'Operations'] },
  { key: 'team.get', method: 'GET', path: '/api/admin/users', body: null, allowed: ['Founder'] },
  { key: 'team.post', method: 'POST', path: '/api/admin/users', body: {}, allowed: ['Founder'] },
  {
    key: 'team.password',
    method: 'PUT',
    path: '/api/admin/users/000000000000000000000001/password',
    body: { password: '12345678' },
    allowed: ['Founder'],
  },
  { key: 'plans.get', method: 'GET', path: '/api/admin/plans', body: null, allowed: ['Founder', 'Growth_Manager'] },
  { key: 'plans.post', method: 'POST', path: '/api/admin/plans', body: {}, allowed: ['Founder', 'Growth_Manager'] },
  { key: 'partners.get', method: 'GET', path: '/api/admin/partners', body: null, allowed: ['Founder', 'Strategist', 'News', 'Operations'] },
  { key: 'partners.post', method: 'POST', path: '/api/admin/partners', body: {}, allowed: ['Founder', 'Strategist', 'News', 'Operations'] },
  {
    key: 'partners.put',
    method: 'PUT',
    path: '/api/admin/partners/000000000000000000000001',
    body: {},
    allowed: ['Founder', 'Strategist', 'News', 'Operations'],
  },
  {
    key: 'partners.delete',
    method: 'DELETE',
    path: '/api/admin/partners/000000000000000000000001',
    body: null,
    allowed: ['Founder', 'Strategist', 'News', 'Operations'],
  },
  { key: 'settings.get', method: 'GET', path: '/api/admin/settings', body: null, allowed: ['Founder'] },
  { key: 'settings.put', method: 'PUT', path: '/api/admin/settings', body: {}, allowed: ['Founder'] },
];

function classifyStatus(status) {
  if (status === 403) return 'forbidden';
  if (status === 401) return 'unauthorized';
  if (status >= 200 && status < 300) return 'ok';
  if (status >= 400 && status < 500) return 'client_error';
  if (status >= 500) return 'server_error';
  return 'unknown';
}

function isExpectationMatch(role, status, allowedRoles) {
  const shouldAllow = allowedRoles.includes(role);
  if (shouldAllow) {
    return status !== 401 && status !== 403;
  }
  return status === 403;
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  let body;
  try {
    body = await res.json();
  } catch (_error) {
    body = null;
  }
  return { status: res.status, body };
}

async function login(email, password) {
  const result = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (result.status !== 200 || !result.body?.token) {
    throw new Error(`Login failed (${result.status})`);
  }

  return result.body.token;
}

async function ensureRoleUsers(founderToken) {
  const targets = [
    { name: 'Strategist User', email: 'sally@msa-agency.com', role: 'Strategist' },
    { name: 'Creative User', email: 'menna@msa-agency.com', role: 'Creative' },
    { name: 'Analyst User', email: 'ibrahim@msa-agency.com', role: 'Analyst' },
    { name: 'Growth Manager', email: 'growth@msa-agency.com', role: 'Growth_Manager' },
    { name: 'Operations', email: 'ops@msa-agency.com', role: 'Operations' },
  ];

  const listRes = await request('/api/admin/users', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${founderToken}`,
    },
  });

  const existingUsers = Array.isArray(listRes.body) ? listRes.body : [];

  for (const user of targets) {
    const found = existingUsers.find((item) => String(item.email || '').toLowerCase() === user.email.toLowerCase());

    if (!found) {
      const createRes = await request('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${founderToken}`,
        },
        body: JSON.stringify({ ...user, password: PASSWORD }),
      });

      if (![201, 409].includes(createRes.status)) {
        console.log(`WARN: could not create user ${user.role} (status ${createRes.status})`);
      }
      continue;
    }

    const resetRes = await request(`/api/admin/users/${found._id}/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${founderToken}`,
      },
      body: JSON.stringify({ password: PASSWORD }),
    });

    if (resetRes.status !== 200) {
      console.log(`WARN: could not reset password for ${user.role} (status ${resetRes.status})`);
    }
  }
}

async function run() {
  const health = await request('/api/health');
  if (health.status !== 200) {
    throw new Error(`Backend is not healthy at ${BASE} (status ${health.status})`);
  }

  const founderToken = await login('amr@msa-agency.com', PASSWORD);
  await ensureRoleUsers(founderToken);

  const tokens = {};
  for (const account of roleAccounts) {
    try {
      tokens[account.role] = await login(account.email, PASSWORD);
    } catch (error) {
      tokens[account.role] = null;
      console.log(`LOGIN_FAIL ${account.role} ${account.email}: ${error.message}`);
    }
  }

  const failures = [];

  for (const account of roleAccounts) {
    const token = tokens[account.role];
    if (!token) {
      failures.push({
        role: account.role,
        test: 'login',
        status: 0,
        expected: 'token',
        ok: false,
      });
      continue;
    }

    for (const test of tests) {
      const headers = {
        Authorization: `Bearer ${token}`,
      };
      if (test.body !== null) headers['Content-Type'] = 'application/json';

      const result = await request(test.path, {
        method: test.method,
        headers,
        ...(test.body !== null ? { body: JSON.stringify(test.body) } : {}),
      });

      const ok = isExpectationMatch(account.role, result.status, test.allowed);
      if (!ok) {
        failures.push({
          role: account.role,
          test: test.key,
          status: result.status,
          expected: test.allowed.includes(account.role) ? 'not 401/403' : '403',
          class: classifyStatus(result.status),
          body: result.body,
          ok,
        });
      }
    }
  }

  if (!failures.length) {
    console.log('SMOKE_CHECK_RESULT: PASS');
    console.log(`Checked roles: ${roleAccounts.map((r) => r.role).join(', ')}`);
    console.log(`Checked tests: ${tests.length} endpoints/actions`);
    return;
  }

  console.log('SMOKE_CHECK_RESULT: FAIL');
  failures.forEach((failure) => {
    console.log(
      JSON.stringify({
        role: failure.role,
        test: failure.test,
        status: failure.status,
        expected: failure.expected,
        class: failure.class || 'n/a',
        body: failure.body || null,
      })
    );
  });
  process.exitCode = 1;
}

run().catch((error) => {
  console.error('SMOKE_CHECK_ERROR:', error.message);
  process.exit(1);
});
