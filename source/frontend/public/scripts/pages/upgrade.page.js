/**
 * TRANG NÂNG CẤP: tạo đơn, hiện mã QR và hỏi server mỗi 2 giây xem đơn đã được thanh toán chưa.
 * Khi đơn "paid" (người dùng xác nhận ở trang pay.html, thường trên điện thoại), trang tự báo thành công và vẽ lại header.
 * Server là nơi nâng gói; trang chỉ hiển thị.
 */
import { initAuth } from '../shared/auth.js';
import { el, link } from '../shared/ui.js';

const POLL_MS = 2000;

const ui = Object.fromEntries(
  ['price', 'upgrade-action', 'checkout', 'checkout-price', 'checkout-memo', 'checkout-timer', 'checkout-status', 'qr-image',
    'open-pay', 'cancel-pay', 'new-qr', 'upgrade-error', 'upgrade-done']
    .map((id) => [id, document.getElementById(id)])
);

let order = null;
let pollTimer = null;
let clockTimer = null;

const formatVnd = (amount) => `${amount.toLocaleString('en-US')}₫`;

async function api(path, options) {
  const response = await fetch(`/api/billing/${path}`, { credentials: 'same-origin', ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message ?? 'Something went wrong. Please try again.');
  return payload.data;
}

function showError(text) {
  ui['upgrade-error'].textContent = text;
  ui['upgrade-error'].hidden = !text;
}

function stopTimers() {
  clearInterval(pollTimer);
  clearInterval(clockTimer);
  pollTimer = clockTimer = null;
}

function tickClock() {
  const left = Math.max(0, Math.round((order.expiresAt - Date.now()) / 1000));
  ui['checkout-timer'].textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}

function showExpired() {
  stopTimers();
  ui['checkout-status'].textContent = 'This QR code has expired.';
  ui['new-qr'].hidden = false;
}

async function showPaid(user) {
  stopTimers();
  ui.checkout.hidden = true;
  ui['upgrade-action'].replaceChildren();
  ui['upgrade-done'].hidden = false;
  ui['upgrade-done'].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.querySelector('.auth')?.remove(); // Vẽ lại header để hiện huy hiệu Premium.
  await initAuth();
  return user;
}

async function poll() {
  try {
    const current = await api(`orders/${order.code}`);
    if (current.status === 'paid') await showPaid(current.user);
    else if (current.status === 'expired') showExpired();
  } catch {
    // Mất kết nối thoáng qua: thử lại ở lần hỏi kế tiếp.
  }
}

async function startCheckout() {
  showError('');
  stopTimers();
  ui['new-qr'].hidden = true;
  try {
    order = await api('orders', { method: 'POST' });
  } catch (error) {
    showError(error.message);
    ui.checkout.hidden = false;
    return;
  }
  ui['qr-image'].src = `/api/billing/orders/${order.code}/qr.svg`;
  ui['checkout-price'].textContent = formatVnd(order.amountVnd);
  ui['checkout-memo'].textContent = order.memo;
  ui['checkout-status'].textContent = 'Waiting for payment…';
  ui['open-pay'].href = order.payUrl;
  ui.checkout.hidden = false;
  tickClock();
  clockTimer = setInterval(() => (Date.now() >= order.expiresAt ? showExpired() : tickClock()), 1000);
  pollTimer = setInterval(poll, POLL_MS);
}

async function loadPrice() {
  try {
    ui.price.textContent = formatVnd((await api('plans')).premium.priceVnd);
  } catch {
    // Giữ giá mặc định trong HTML.
  }
}

const [user] = await Promise.all([initAuth(), loadPrice()]);

if (!user) {
  ui['upgrade-action'].append(link('Sign in to upgrade', '/login.html?next=%2Fupgrade.html', 'button button--primary'));
} else if (user.premium) {
  ui['upgrade-action'].append(el('p', 'upgrade-owned', user.role === 'admin' ? 'Admins always have Premium.' : 'This is your current plan.'));
} else {
  const upgrade = el('button', 'button button--primary', 'Upgrade to Premium');
  upgrade.type = 'button';
  upgrade.addEventListener('click', async () => {
    await startCheckout();
    ui.checkout.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  ui['upgrade-action'].append(upgrade);
}

ui['new-qr'].addEventListener('click', startCheckout);
ui['cancel-pay'].addEventListener('click', () => { stopTimers(); ui.checkout.hidden = true; showError(''); });
