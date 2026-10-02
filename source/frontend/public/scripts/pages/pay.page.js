/**
 * TRANG THANH TOÁN GIẢ LẬP (mở từ mã QR): đọc ?order=, hiện số tiền và nút xác nhận.
 * Xác nhận xong, trang Upgrade ở máy kia tự phát hiện đơn đã trả và nâng cấp tài khoản.
 */
const code = new URLSearchParams(location.search).get('order') ?? '';

const ui = Object.fromEntries(
  ['pay-loading', 'pay-facts', 'pay-amount', 'pay-memo', 'pay-message', 'pay-error', 'pay-confirm']
    .map((id) => [id, document.getElementById(id)])
);

async function api(method) {
  const response = await fetch(`/api/billing/pay/${encodeURIComponent(code)}`, { method });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message ?? 'Something went wrong. Please try again.');
  return payload.data;
}

function showMessage(text) {
  ui['pay-message'].textContent = text;
  ui['pay-message'].hidden = !text;
}

function showError(text) {
  ui['pay-error'].textContent = text;
  ui['pay-error'].hidden = !text;
}

try {
  const order = await api('GET');
  ui['pay-loading'].hidden = true;
  ui['pay-amount'].textContent = `${order.amountVnd.toLocaleString('en-US')}₫`;
  ui['pay-memo'].textContent = order.memo;
  ui['pay-facts'].hidden = false;
  if (order.status === 'paid') showMessage('This order is already paid. You can close this page.');
  else if (order.status === 'expired') showError('This QR code has expired. Create a new one on the upgrade page.');
  else ui['pay-confirm'].hidden = false;
} catch (error) {
  ui['pay-loading'].hidden = true;
  showError(error.message);
}

ui['pay-confirm'].addEventListener('click', async () => {
  showError('');
  ui['pay-confirm'].disabled = true;
  try {
    await api('POST');
    ui['pay-confirm'].hidden = true;
    showMessage('Payment confirmed. Your account is being upgraded - you can close this page.');
  } catch (error) {
    showError(error.message);
    ui['pay-confirm'].disabled = false;
  }
});
