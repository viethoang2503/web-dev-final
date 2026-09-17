/**
 * Browser checks for the account page and the header auth state (Gate 2).
 *
 *   node tests/account-check.mjs [baseUrl]
 *
 * Covers: inline validation before the request goes out, duplicate username
 * shown on the field, generic login error, submitting state, show/hide
 * password, header switching to the signed-in state, the session surviving a
 * page reload, and logout closing off protected actions.
 */
import { DatabaseSync } from 'node:sqlite';
import { withPage, check, summary } from './cdp.mjs';

const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const dbPath = process.env.DATABASE_PATH ?? './server/db/hanoi-local.sqlite';
const stamp = Date.now().toString(36);
const user = { username: `ui_${stamp}`, password: 'demo-pass-1' };

/**
 * Visibility is measured from the rendered box, not from the hidden attribute.
 * A class that sets display can override [hidden], so checking the attribute
 * alone can report a control as hidden while it still occupies space.
 */
const headerState = `
  const rendered = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return false;
    return el.getBoundingClientRect().width > 0 && getComputedStyle(el).display !== 'none';
  };
  return {
    signInVisible: rendered('[data-role="auth-sign-in"]'),
    accountVisible: rendered('[data-role="auth-account"]'),
    username: document.querySelector('[data-role="auth-username"]').textContent.trim(),
    htmlAuth: document.documentElement.dataset.auth,
  };
`;

async function checkValidationAndRegister() {
  console.log(`\n=== ${base}/account.html — validation and register ===`);

  await withPage(`${base}/account.html`, { width: 1280 }, async (page) => {
    check('starts as a guest', (await page.evaluate(headerState)).signInVisible);
    check('forms are visible for a guest', !(await page.evaluate(`document.querySelector('[data-role="forms"]').hidden`)));

    /* --- show / hide password --- */
    const before = await page.evaluate(`document.querySelector('#register-password').type`);
    await page.click('[data-form="register"] [data-action="toggle-password"]');
    const toggled = await page.evaluate(`({
      type: document.querySelector('#register-password').type,
      pressed: document.querySelector('[data-form="register"] [data-action="toggle-password"]').getAttribute('aria-pressed'),
      label: document.querySelector('[data-form="register"] [data-action="toggle-password"]').getAttribute('aria-label'),
    })`);
    check('password starts masked', before === 'password');
    check('show/hide reveals the password', toggled.type === 'text' && toggled.pressed === 'true', toggled);
    check('toggle has an accessible name', /hide password/i.test(toggled.label ?? ''), toggled.label);
    await page.click('[data-form="register"] [data-action="toggle-password"]');

    /* --- client-side validation blocks the request --- */
    await page.fill('#register-username', 'ab');
    await page.fill('#register-password', '123');
    await page.click('[data-form="register"] button[type="submit"]');
    await page.wait(250);
    const invalid = await page.evaluate(`({
      usernameError: document.querySelector('[data-form="register"] [data-error-for="username"]').textContent.trim(),
      passwordError: document.querySelector('[data-form="register"] [data-error-for="password"]').textContent.trim(),
      ariaInvalid: document.querySelector('#register-username').getAttribute('aria-invalid'),
      describedBy: document.querySelector('#register-username').getAttribute('aria-describedby'),
      stillGuest: document.documentElement.dataset.auth,
    })`);
    check('short username shows an inline error', invalid.usernameError.length > 0, invalid);
    check('short password shows an inline error', invalid.passwordError.length > 0, invalid);
    check('invalid input marks the field aria-invalid', invalid.ariaInvalid === 'true');
    check('error is linked to the input via aria-describedby', (invalid.describedBy ?? '').includes('register-username-error'), invalid.describedBy);
    check('invalid submit does not sign anyone in', invalid.stillGuest === 'guest');

    /* --- typing clears the error --- */
    await page.fill('#register-username', user.username);
    await page.wait(120);
    check('fixing the field clears its error', (await page.evaluate(`document.querySelector('[data-form="register"] [data-error-for="username"]').hidden`)) === true);

    /* --- successful registration --- */
    await page.fill('#register-password', user.password);
    await page.click('[data-form="register"] button[type="submit"]');
    await page.wait(900);

    const after = await page.evaluate(headerState);
    check('header hides Sign in after register', after.signInVisible === false, after);
    check('header shows the account chip', after.accountVisible === true, after);
    check('header shows the username', after.username === user.username, after);
    check('document is marked as signed in', after.htmlAuth === 'user', after);
    check('forms are replaced by the signed-in panel', await page.evaluate(`document.querySelector('[data-role="forms"]').hidden && !document.querySelector('[data-role="signed-in-panel"]').hidden`));
    check('signed-in panel names the user', (await page.evaluate(`document.querySelector('[data-role="signed-in-username"]').textContent.trim()`)) === user.username);

    const errors = page.errors();
    check('no script exceptions', errors.exceptions.length === 0, errors.exceptions);
    check('no console errors', errors.console.length === 0, errors.console);
  });
}

async function checkDuplicateAndLogin() {
  console.log(`\n=== ${base}/account.html — duplicate username and login ===`);

  await withPage(`${base}/account.html`, { width: 1280 }, async (page) => {
    /* --- duplicate username comes back on the username field --- */
    await page.fill('#register-username', user.username);
    await page.fill('#register-password', user.password);
    await page.click('[data-form="register"] button[type="submit"]');
    await page.wait(900);
    const duplicate = await page.evaluate(`({
      usernameError: document.querySelector('[data-form="register"] [data-error-for="username"]').textContent.trim(),
      formError: document.querySelector('[data-form="register"] [data-error-for="form"]').textContent.trim(),
      auth: document.documentElement.dataset.auth,
    })`);
    check('duplicate username is reported on the username field', /already taken/i.test(duplicate.usernameError), duplicate);
    check('duplicate does not sign the visitor in', duplicate.auth === 'guest', duplicate);

    /* --- wrong password shows the generic message --- */
    await page.fill('#login-username', user.username);
    await page.fill('#login-password', 'wrong-password');
    await page.click('[data-form="login"] button[type="submit"]');
    await page.wait(900);
    const failed = await page.evaluate(`document.querySelector('[data-form="login"] [data-error-for="form"]').textContent.trim()`);
    check('wrong password shows a generic error', /incorrect username or password/i.test(failed), failed);

    /* --- correct login --- */
    await page.fill('#login-password', user.password);
    await page.click('[data-form="login"] button[type="submit"]');
    await page.wait(900);
    check('correct login updates the header', (await page.evaluate(headerState)).username === user.username);

    const errors = page.errors();
    check('no script exceptions', errors.exceptions.length === 0, errors.exceptions);
  });
}

async function checkSessionAcrossPages() {
  console.log(`\n=== session survives navigation and reload (FORM-04) ===`);

  await withPage(`${base}/account.html`, { width: 1280 }, async (page) => {
    await page.fill('#login-username', user.username);
    await page.fill('#login-password', user.password);
    await page.click('[data-form="login"] button[type="submit"]');
    await page.wait(900);
    check('signed in before navigating', (await page.evaluate(headerState)).accountVisible);

    /* --- reload the same page --- */
    await page.evaluate(`window.location.reload(); return true;`);
    await page.wait(1600);
    check('still signed in after a reload', (await page.evaluate(headerState)).username === user.username);

    /* --- navigate to another page --- */
    await page.evaluate(`window.location.href = '/food.html'; return true;`);
    await page.wait(1800);
    const onFood = await page.evaluate(headerState);
    check('header shows the user on the Food page too', onFood.username === user.username, onFood);

    /* --- a signed-in user is not prompted to sign in --- */
    await page.click('[data-action="toggle-favorite"]');
    await page.wait(400);
    check('signed-in user gets no sign-in prompt on the heart', (await page.evaluate(`document.getElementById('sign-in-prompt').open`)) === false);

    /* --- logout from the header --- */
    await page.click('[data-action="logout"]');
    await page.wait(900);
    const afterLogout = await page.evaluate(headerState);
    check('logout brings back Sign in', afterLogout.signInVisible === true, afterLogout);
    check('logout hides the account chip', afterLogout.accountVisible === false, afterLogout);
    check('document is marked as a guest again', afterLogout.htmlAuth === 'guest', afterLogout);

    /* --- protected action is closed off again --- */
    await page.click('[data-action="toggle-favorite"]');
    await page.wait(400);
    check('after logout the heart prompts a sign-in again', (await page.evaluate(`document.getElementById('sign-in-prompt').open`)) === true);

    const errors = page.errors();
    check('no script exceptions', errors.exceptions.length === 0, errors.exceptions);
    check('no console errors', errors.console.length === 0, errors.console);
  });
}

async function checkSignedInHeaderOnMobile() {
  console.log(`\n=== signed-in header at 375px (the Log out button is extra width) ===`);

  await withPage(`${base}/account.html`, { width: 375, height: 900 }, async (page) => {
    await page.fill('#login-username', user.username);
    await page.fill('#login-password', user.password);
    await page.click('[data-form="login"] button[type="submit"]');
    await page.wait(1000);

    const layout = await page.evaluate(`({
      auth: document.documentElement.dataset.auth,
      scrollWidth: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
      logoutVisible: !!document.querySelector('.site-header [data-action="logout"]')?.offsetParent,
      nameHidden: getComputedStyle(document.querySelector('.account-chip__name')).position === 'absolute',
    })`);

    check('signed in on a narrow screen', layout.auth === 'user', layout);
    check('no horizontal overflow with the account chip', layout.scrollWidth <= layout.viewport + 1, layout);
    check('Log out stays reachable', layout.logoutVisible, layout);
    check('username is visually hidden to save room', layout.nameHidden, layout);

    /* Same page, now on Food, where the toolbar is the widest element. */
    await page.evaluate(`window.location.href = '/food.html'; return true;`);
    await page.wait(1800);
    const onFood = await page.evaluate(`({
      scrollWidth: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
      auth: document.documentElement.dataset.auth,
    })`);
    check('Food page has no overflow while signed in', onFood.scrollWidth <= onFood.viewport + 1, onFood);
    check('still signed in on Food', onFood.auth === 'user', onFood);
  });
}

await checkValidationAndRegister();
await checkDuplicateAndLogin();
await checkSessionAcrossPages();
await checkSignedInHeaderOnMobile();

/* --- cleanup: leave the database as we found it ------------------------ */
{
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON');
  const removed = db.prepare('DELETE FROM users WHERE username = ?').run(user.username);
  db.close();
  console.log(`\n(cleanup: removed ${removed.changes} test account)`);
}

process.exit(summary() === 0 ? 0 : 1);
