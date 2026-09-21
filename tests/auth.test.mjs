/**
 * API checks for authentication, matching the auth rows of the test matrix in
 * docs/05-testing-and-scoring.md section 2 and the Gate 2 criteria.
 *
 *   node tests/auth.test.mjs [baseUrl]
 *
 * Uses fetch with a tiny cookie jar, so it exercises the same session cookie a
 * browser would carry. It also reads the database directly to prove the
 * password was hashed and that sessions are stored as rows.
 */
import { DatabaseSync } from 'node:sqlite';
import { requireAuth } from '../backend/src/middleware/auth.middleware.js';
import { check, summary } from './helpers/browser.mjs';

const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const dbPath = process.env.DATABASE_PATH ?? './backend/data/hanoi-local.sqlite';

/** Unique per run so the script can be re-run without resetting the database. */
const stamp = Date.now().toString(36);
const userA = { username: `qa_${stamp}`, password: 'demo-pass-1' };
const userB = { username: `qb_${stamp}`, password: 'demo-pass-2' };

/* --- minimal cookie jar ------------------------------------------------ */

function createClient() {
  const jar = new Map();

  return {
    get cookieValue() {
      return jar.get('hanoi.sid') ?? null;
    },

    lastSetCookie: null,

    async request(path, { method = 'GET', body } = {}) {
      const headers = { Accept: 'application/json' };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (jar.size) {
        headers.Cookie = [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
      }

      const response = await fetch(`${base}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      for (const raw of response.headers.getSetCookie?.() ?? []) {
        this.lastSetCookie = raw;
        const [pair] = raw.split(';');
        const index = pair.indexOf('=');
        const name = pair.slice(0, index);
        const value = pair.slice(index + 1);
        if (value === '') {
          jar.delete(name);
        } else {
          jar.set(name, value);
        }
      }

      const text = await response.text();
      let payload = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = { raw: text };
      }

      return { status: response.status, body: payload, rawBody: text };
    },
  };
}

const client = createClient();

/* --- guest ------------------------------------------------------------- */

console.log('\n=== guest state ===');
{
  const me = await client.request('/api/auth/me');
  check('GET /api/auth/me answers 200 for a guest', me.status === 200, me);
  check('guest gets user: null', me.body?.data?.user === null, me.body);
  check('no session cookie is issued to a guest', client.cookieValue === null, client.cookieValue);
}

/* --- validation -------------------------------------------------------- */

console.log('\n=== registration validation (backend copy) ===');
{
  const short = await client.request('/api/auth/register', {
    method: 'POST',
    body: { username: 'ab', password: 'demo-pass-1' },
  });
  check('username under 3 characters is rejected', short.status === 400, short);
  check('error code is VALIDATION_ERROR', short.body?.error?.code === 'VALIDATION_ERROR', short.body);
  check('username field carries its own message', Boolean(short.body?.error?.details?.username), short.body?.error?.details);

  const weak = await client.request('/api/auth/register', {
    method: 'POST',
    body: { username: `w_${stamp}`, password: '123' },
  });
  check('password under 6 characters is rejected', weak.status === 400, weak);
  check('password field carries its own message', Boolean(weak.body?.error?.details?.password), weak.body?.error?.details);

  const weird = await client.request('/api/auth/register', {
    method: 'POST',
    body: { username: 'has space', password: 'demo-pass-1' },
  });
  check('username with a space is rejected', weird.status === 400, weird);

  const missing = await client.request('/api/auth/register', { method: 'POST', body: {} });
  check('empty body is rejected, not crashed', missing.status === 400, missing);
}

/* --- register ---------------------------------------------------------- */

console.log('\n=== register ===');
{
  const created = await client.request('/api/auth/register', { method: 'POST', body: userA });
  check('valid registration returns 201', created.status === 201, created);
  check('response contains the public user', created.body?.data?.user?.username === userA.username, created.body);
  check('response has no password_hash', !created.rawBody.includes('password_hash') && !created.rawBody.includes('$2b$'), created.rawBody.slice(0, 120));
  check('session cookie was issued', Boolean(client.cookieValue));
  check('cookie is HttpOnly', /HttpOnly/i.test(client.lastSetCookie ?? ''), client.lastSetCookie);
  check('cookie is SameSite=Lax', /SameSite=Lax/i.test(client.lastSetCookie ?? ''), client.lastSetCookie);
  check('cookie is not Secure in development', !/Secure/i.test(client.lastSetCookie ?? ''), client.lastSetCookie);

  const me = await client.request('/api/auth/me');
  check('GET /api/auth/me now returns the user', me.body?.data?.user?.username === userA.username, me.body);

  const duplicate = await client.request('/api/auth/register', { method: 'POST', body: userA });
  check('duplicate username returns 409', duplicate.status === 409, duplicate);
  check('duplicate error code is CONFLICT', duplicate.body?.error?.code === 'CONFLICT', duplicate.body);
}

/* --- database evidence ------------------------------------------------- */

console.log('\n=== database evidence ===');
{
  const db = new DatabaseSync(dbPath);

  const row = db.prepare('SELECT password_hash FROM users WHERE username = ?').get(userA.username);
  check('password is stored as a bcrypt hash', row?.password_hash?.startsWith('$2'), row?.password_hash?.slice(0, 7));
  check('plaintext password is not in the row', row?.password_hash !== userA.password);

  const sessions = db.prepare('SELECT COUNT(*) AS total FROM sessions').get();
  check('session is stored as a database row', sessions.total >= 1, sessions);

  const duplicates = db
    .prepare('SELECT COUNT(*) AS total FROM users WHERE username = ?')
    .get(userA.username);
  check('only one row exists for the username', duplicates.total === 1, duplicates);

  db.close();
}

/* --- logout ------------------------------------------------------------ */

console.log('\n=== logout ===');
{
  const cookieBefore = client.cookieValue;
  const out = await client.request('/api/auth/logout', { method: 'POST' });
  check('logout returns 200', out.status === 200, out);
  check('logout reports user: null', out.body?.data?.user === null, out.body);

  const me = await client.request('/api/auth/me');
  check('after logout the user is a guest again', me.body?.data?.user === null, me.body);

  const db = new DatabaseSync(dbPath);
  const sid = decodeURIComponent(cookieBefore ?? '').replace(/^s:/, '').split('.')[0];
  const row = db.prepare('SELECT COUNT(*) AS total FROM sessions WHERE sid = ?').get(sid);
  check('session row was deleted on logout', row.total === 0, row);
  db.close();
}

/* --- login ------------------------------------------------------------- */

console.log('\n=== login ===');
{
  const wrongPassword = await client.request('/api/auth/login', {
    method: 'POST',
    body: { username: userA.username, password: 'not-the-password' },
  });
  const wrongUser = await client.request('/api/auth/login', {
    method: 'POST',
    body: { username: `nobody_${stamp}`, password: 'not-the-password' },
  });

  check('wrong password is rejected', wrongPassword.status === 400, wrongPassword);
  check(
    'wrong username and wrong password give the identical message',
    wrongPassword.body?.error?.message === wrongUser.body?.error?.message,
    { a: wrongPassword.body?.error?.message, b: wrongUser.body?.error?.message }
  );
  check(
    'the message does not say which field was wrong',
    /incorrect username or password/i.test(wrongPassword.body?.error?.message ?? ''),
    wrongPassword.body?.error?.message
  );
  check('failed login leaves the client a guest', (await client.request('/api/auth/me')).body?.data?.user === null);

  const beforeLogin = client.cookieValue;
  const ok = await client.request('/api/auth/login', { method: 'POST', body: userA });
  check('correct credentials return 200', ok.status === 200, ok);
  check('login returns the user', ok.body?.data?.user?.username === userA.username, ok.body);
  check('login response has no hash', !ok.rawBody.includes('$2b$'));
  check('session id changed on login (no session fixation)', client.cookieValue !== beforeLogin);

  const me = await client.request('/api/auth/me');
  check('session works on the next request', me.body?.data?.user?.username === userA.username, me.body);
}

/* --- separate users ---------------------------------------------------- */

console.log('\n=== users are separate ===');
{
  const second = createClient();
  await second.request('/api/auth/register', { method: 'POST', body: userB });

  const meA = await client.request('/api/auth/me');
  const meB = await second.request('/api/auth/me');
  check('client A is still user A', meA.body?.data?.user?.username === userA.username, meA.body);
  check('client B is user B', meB.body?.data?.user?.username === userB.username, meB.body);
  check('the two sessions have different ids', client.cookieValue !== second.cookieValue);
}

/* --- requireAuth middleware (AUTH-06) ---------------------------------- */

console.log('\n=== requireAuth middleware ===');
{
  const run = (session) =>
    new Promise((resolve) => {
      const req = { session };
      requireAuth(req, {}, (error) => resolve({ error, req }));
    });

  const guest = await run({});
  check('guest is rejected', guest.error?.status === 401, guest.error?.status);
  check('rejection code is UNAUTHENTICATED', guest.error?.code === 'UNAUTHENTICATED', guest.error?.code);
  check('guest gets no req.user', !guest.req.user);

  const db = new DatabaseSync(dbPath);
  const { id } = db.prepare('SELECT id FROM users WHERE username = ?').get(userA.username);
  db.close();

  const signedIn = await run({ userId: id });
  check('signed-in request passes through', signedIn.error === undefined, signedIn.error);
  check('req.user is attached', signedIn.req.user?.username === userA.username, signedIn.req.user);
  check('req.user carries no password_hash', !('password_hash' in (signedIn.req.user ?? {})));

  const stale = await run({ userId: 999999, destroy: (cb) => cb() });
  check('session for a deleted account is rejected', stale.error?.status === 401, stale.error?.status);
}

/* --- cleanup ----------------------------------------------------------- */

// Leave the database as we found it, so repeated QA runs do not pile up
// accounts that then show up in the demo.
{
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON');
  const removed = db
    .prepare('DELETE FROM users WHERE username IN (?, ?)')
    .run(userA.username, userB.username);
  db.close();
  console.log(`\n(cleanup: removed ${removed.changes} test accounts)`);
}

process.exit(summary() === 0 ? 0 : 1);
