/**
 * TRANG ĐĂNG NHẬP: hai form (đăng nhập, tạo tài khoản) và nút Google dùng chung một vùng báo lỗi.
 * Sau khi thành công, chuyển tới ?next= (chỉ chấp nhận đường dẫn nội bộ), mặc định là trang chủ.
 */
import { authApi, initAuth, mountGoogleButton, safeNext } from '../shared/auth.js';

const params = new URLSearchParams(location.search);
const next = safeNext(params.get('next'));

const ui = Object.fromEntries(
  ['account-title', 'account-note', 'account-error', 'tab-login', 'tab-register', 'login-form', 'register-form', 'google-area', 'google-button']
    .map((id) => [id, document.getElementById(id)])
);

function showError(text) {
  ui['account-error'].textContent = text;
  ui['account-error'].hidden = !text;
}

function setMode(mode) {
  const registering = mode === 'register';
  ui['login-form'].hidden = registering;
  ui['register-form'].hidden = !registering;
  ui['tab-login'].setAttribute('aria-pressed', String(!registering));
  ui['tab-register'].setAttribute('aria-pressed', String(registering));
  ui['account-title'].textContent = registering ? 'Create your account' : 'Sign in';
  document.title = `${registering ? 'Create account' : 'Sign in'} - Hanoi Local`;
  showError('');
}

function done() {
  location.assign(next);
}

/** Gửi form tới API; khóa nút trong lúc chờ để tránh gửi hai lần. */
function handleForm(form, path) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showError('');
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await authApi(path, { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      done();
    } catch (error) {
      showError(error.message);
      button.disabled = false;
    }
  });
}

ui['tab-login'].addEventListener('click', () => setMode('login'));
ui['tab-register'].addEventListener('click', () => setMode('register'));
handleForm(ui['login-form'], 'login');
handleForm(ui['register-form'], 'register');

if (next.startsWith('/plan')) {
  ui['account-note'].textContent = 'Sign in or create a free account to use Plan your day.';
  ui['account-note'].hidden = false;
}
setMode(params.get('mode') === 'register' ? 'register' : 'login');

// Đã đăng nhập thì không cần ở lại trang này.
const user = await initAuth();
if (user) done();
else {
  mountGoogleButton(ui['google-button'], { onUser: done, onError: showError }).then((shown) => {
    ui['google-area'].hidden = !shown;
  });
}
