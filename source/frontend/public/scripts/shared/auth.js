/**
 * TÀI KHOẢN Ở TRÌNH DUYỆT: gọi /api/auth, vẽ khu vực đăng nhập ở header và dựng nút Google.
 * Server mới là nơi quyết định ai được vào trang plan/admin; code ở đây chỉ hiển thị trạng thái.
 */
import { el, link } from './ui.js';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const GATED_PAGES = ['/plan.html', '/plan', '/admin.html', '/admin'];

/** Gọi API JSON; ném Error với thông báo của server khi lỗi. */
export async function authApi(path, { method = 'GET', body } = {}) {
  const response = await fetch(`/api/auth/${path}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message ?? 'Something went wrong. Please try again.');
  return payload.data;
}

/** Chỉ nhận đường dẫn nội bộ ("/plan.html?x=1"); chặn "//evil.com" và "https://..." để tránh chuyển hướng ra ngoài. */
export function safeNext(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : '/';
}

function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Could not load Google sign-in'));
    document.head.append(script);
  });
}

/**
 * Vẽ nút "Sign in with Google" vào `container`. Không làm gì nếu server chưa có Client ID
 * hoặc không tải được script Google. `onUser(user)` chạy sau khi server xác nhận token.
 */
export async function mountGoogleButton(container, { onUser, onError }) {
  try {
    const { googleClientId } = await authApi('config');
    if (!googleClientId) return false;
    await loadGoogleScript();
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: async ({ credential }) => {
        try {
          onUser(await authApi('google', { method: 'POST', body: { credential } }));
        } catch (error) {
          onError(error.message);
        }
      },
    });
    window.google.accounts.id.renderButton(container, { theme: 'outline', size: 'large', text: 'continue_with', width: 320 });
    return true;
  } catch {
    return false;
  }
}

function avatarFor(user) {
  if (user.picture) {
    const image = el('img', 'auth__avatar');
    image.src = user.picture;
    image.alt = '';
    image.referrerPolicy = 'no-referrer';
    image.width = image.height = 36;
    return image;
  }
  const initial = el('span', 'auth__avatar auth__avatar--initial', (user.name || user.email).trim().charAt(0).toUpperCase());
  initial.setAttribute('aria-hidden', 'true');
  return initial;
}

function renderUser(slot, user) {
  slot.replaceChildren(avatarFor(user), el('span', 'auth__name', user.name));
  if (user.premium) slot.append(el('span', 'auth__badge', 'Premium'));
  if (user.role === 'admin') slot.append(link('Admin', '/admin.html', 'auth__link'));
  if (!user.premium) slot.append(link('Upgrade', '/upgrade.html', 'auth__link auth__link--primary'));

  const signOut = el('button', 'auth__signout', 'Sign out');
  signOut.type = 'button';
  signOut.addEventListener('click', async () => {
    try { await authApi('logout', { method: 'POST' }); } catch { /* cookie hết hạn cũng coi như đã thoát */ }
    window.google?.accounts?.id.disableAutoSelect();
    // Trang plan/admin cần đăng nhập nên quay về trang chủ; các trang khác chỉ vẽ lại header.
    if (GATED_PAGES.includes(location.pathname)) location.assign('/');
    else renderGuest(slot);
  });
  slot.append(signOut);
}

function renderGuest(slot) {
  const next = encodeURIComponent(location.pathname + location.search);
  slot.replaceChildren(link('Sign in', `/login.html?next=${next}`, 'auth__link'), link('Create account', `/login.html?mode=register&next=${next}`, 'auth__link auth__link--primary'));
}

/** Gắn khu vực tài khoản vào cuối header; trả về người dùng hiện tại hoặc null. */
export async function initAuth() {
  const host = document.querySelector('.site-header__inner');
  if (!host) return null;
  const slot = el('div', 'auth');
  host.append(slot);

  try {
    const user = await authApi('me');
    if (user) renderUser(slot, user);
    else if (location.pathname !== '/login.html') renderGuest(slot);
    return user;
  } catch {
    return null; // API không trả lời: bỏ qua, không chặn trang.
  }
}
