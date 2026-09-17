/**
 * account.js - the register and login page (FORM-01, FORM-02, FORM-04).
 *
 * Validation happens twice on purpose. Here it is for fast feedback; the same
 * rules run again on the server, which is the copy that actually protects the
 * database. When the server disagrees, the server wins and its per-field
 * messages are shown.
 */
import { ApiError } from './api.js';
import { getUser, initAuthUI, login, register } from './auth.js';
import { initFavorites } from './favorites.js';
import { initItinerary } from './itinerary.js';
import { initLayout, showToast } from './layout.js';

/** Mirrors server/services/users.service.js. Keep the two in step. */
const RULES = {
  usernameMin: 3,
  usernameMax: 20,
  usernamePattern: /^[a-zA-Z0-9._-]+$/,
  passwordMin: 6,
};

const elements = {
  forms: document.querySelector('[data-role="forms"]'),
  signedInPanel: document.querySelector('[data-role="signed-in-panel"]'),
  signedInUsername: document.querySelector('[data-role="signed-in-username"]'),
};

/* ==========================================================================
   Field errors
   ========================================================================== */

function showFieldError(form, field, message) {
  const target = form.querySelector(`[data-error-for="${field}"]`);
  const input = form.querySelector(`[name="${field}"]`);

  if (target) {
    target.textContent = message;
    target.hidden = !message;
  }

  if (input) {
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      // Point the input at its message so a screen reader reads them together.
      const errorId = `${input.id}-error`;
      if (target) target.id = errorId;
      input.setAttribute('aria-describedby', [input.dataset.hintId, errorId].filter(Boolean).join(' '));
    } else {
      input.removeAttribute('aria-invalid');
      if (input.dataset.hintId) {
        input.setAttribute('aria-describedby', input.dataset.hintId);
      } else {
        input.removeAttribute('aria-describedby');
      }
    }
  }
}

function clearErrors(form) {
  for (const field of ['username', 'password', 'form']) {
    showFieldError(form, field, '');
  }
}

/** Client-side rules. Returns a details object shaped like the API's. */
function validate({ username, password }, { forLogin }) {
  const details = {};

  if (!username) {
    details.username = 'Enter a username.';
  } else if (username.length < RULES.usernameMin || username.length > RULES.usernameMax) {
    details.username = `Username must be ${RULES.usernameMin} to ${RULES.usernameMax} characters.`;
  } else if (!RULES.usernamePattern.test(username)) {
    details.username = 'Use letters, numbers, dot, hyphen or underscore only.';
  }

  if (!password) {
    details.password = 'Enter a password.';
  } else if (!forLogin && password.length < RULES.passwordMin) {
    details.password = `Password must be at least ${RULES.passwordMin} characters.`;
  }

  return details;
}

/* ==========================================================================
   Submitting
   ========================================================================== */

function setBusy(form, busy) {
  const button = form.querySelector('button[type="submit"]');
  if (!button) return;
  button.disabled = busy;
  if (busy) {
    button.dataset.busy = 'true';
    button.setAttribute('aria-busy', 'true');
  } else {
    delete button.dataset.busy;
    button.removeAttribute('aria-busy');
  }
}

function focusFirstError(form, details) {
  const field = ['username', 'password'].find((name) => details[name]);
  form.querySelector(`[name="${field}"]`)?.focus();
}

function handleForm(form, submit, { forLogin }) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(form);

    const data = new FormData(form);
    const credentials = {
      username: String(data.get('username') ?? '').trim(),
      password: String(data.get('password') ?? ''),
    };

    const details = validate(credentials, { forLogin });
    if (Object.keys(details).length > 0) {
      Object.entries(details).forEach(([field, message]) => showFieldError(form, field, message));
      focusFirstError(form, details);
      return;
    }

    setBusy(form, true);

    try {
      const user = await submit(credentials);
      showToast(`Welcome, ${user.username}.`, { variant: 'success' });
      form.reset();
      renderSignedIn(user);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError('Something went wrong.');

      if (apiError.details && typeof apiError.details === 'object') {
        // Per-field messages from the backend.
        Object.entries(apiError.details).forEach(([field, message]) =>
          showFieldError(form, field, String(message))
        );
        focusFirstError(form, apiError.details);
      } else if (apiError.code === 'CONFLICT') {
        // A taken username is a username problem, so it belongs on that field.
        showFieldError(form, 'username', apiError.message);
        form.querySelector('[name="username"]')?.focus();
      } else {
        showFieldError(form, 'form', apiError.message);
        form.querySelector('[data-error-for="form"]')?.scrollIntoView({ block: 'nearest' });
      }
    } finally {
      setBusy(form, false);
    }
  });

  // Clear a field's error as soon as the user starts fixing it.
  form.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', () => {
      if (input.getAttribute('aria-invalid') === 'true') {
        showFieldError(form, input.name, '');
      }
    });
  });
}

/* ==========================================================================
   Show / hide password
   ========================================================================== */

function initPasswordToggles() {
  document.querySelectorAll('[data-action="toggle-password"]').forEach((button) => {
    const input = button.closest('.password')?.querySelector('input');
    if (!input) return;

    const apply = (visible) => {
      input.type = visible ? 'text' : 'password';
      button.textContent = visible ? 'Hide' : 'Show';
      button.setAttribute('aria-pressed', String(visible));
      // Accessible name says what the control does, not just "Show".
      button.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
    };

    apply(false);
    button.addEventListener('click', () => apply(input.type === 'password'));
  });
}

/* ==========================================================================
   Signed-in state
   ========================================================================== */

function renderSignedIn(user) {
  const signedIn = Boolean(user);
  if (elements.forms) elements.forms.hidden = signedIn;
  if (elements.signedInPanel) elements.signedInPanel.hidden = !signedIn;
  if (elements.signedInUsername && user) elements.signedInUsername.textContent = user.username;
}

/* ==========================================================================
   Start
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  initLayout();
  // The header Favorites and My Day entry points work here too.
  initFavorites();
  initItinerary();
  initPasswordToggles();

  // Remember which hint each input already points at, so error wiring can
  // restore it instead of dropping it.
  document.querySelectorAll('input[aria-describedby]').forEach((input) => {
    input.dataset.hintId = input.getAttribute('aria-describedby');
  });

  const loginForm = document.querySelector('[data-form="login"]');
  const registerForm = document.querySelector('[data-form="register"]');
  if (loginForm) handleForm(loginForm, login, { forLogin: true });
  if (registerForm) handleForm(registerForm, register, { forLogin: false });

  await initAuthUI();
  renderSignedIn(getUser());
});
