/**
 * TRANG QUẢN TRỊ: hai bảng (món/địa điểm, người dùng) và một form thêm/sửa dùng chung.
 * Mọi thao tác gọi /api/admin/*; server kiểm tra quyền admin và dữ liệu, trang chỉ hiển thị kết quả.
 * Chữ từ API luôn đi qua textContent (hàm el) nên không bị hiểu thành HTML.
 */
import { initAuth } from '../shared/auth.js';
import { el } from '../shared/ui.js';

const me = await initAuth();
if (me?.role !== 'admin') location.assign('/');

const ui = Object.fromEntries(
  ['tab-spots', 'tab-users', 'spots-panel', 'users-panel', 'admin-status', 'spots-body', 'users-body', 'spots-count', 'users-count',
    'spots-filter', 'add-spot', 'spot-form', 'spot-form-title', 'spot-kind', 'spot-error', 'cancel-spot']
    .map((id) => [id, document.getElementById(id)])
);
const form = ui['spot-form'];
let spots = [];
let editingId = null;

async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(`/api/admin/${path}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401 || response.status === 403) location.assign('/');
  if (!response.ok) throw new Error(payload.error?.message ?? 'Request failed.');
  return payload.data;
}

function status(text, isError = false) {
  ui['admin-status'].textContent = text;
  ui['admin-status'].hidden = !text;
  ui['admin-status'].classList.toggle('admin-status--error', isError);
}

function button(text, onClick, className = 'admin-action') {
  const item = el('button', className, text);
  item.type = 'button';
  item.addEventListener('click', onClick);
  return item;
}

/** Chạy một thao tác và báo kết quả; lỗi hiện ở dòng trạng thái thay vì làm vỡ trang. */
async function run(action, successText) {
  try {
    await action();
    status(successText);
  } catch (error) {
    status(error.message, true);
  }
}

// ---- Món ăn / địa điểm ------------------------------------------------------------

function renderSpots() {
  const kind = ui['spots-filter'].value;
  const shown = spots.filter((spot) => !kind || spot.kind === kind);
  ui['spots-count'].textContent = `(${shown.length})`;
  ui['spots-body'].replaceChildren(...shown.map((spot) => {
    const row = el('tr');
    const name = el('th', '', spot.name);
    name.scope = 'row';
    row.append(
      name,
      el('td', '', spot.kind === 'food' ? 'Food' : 'Place'),
      el('td', '', spot.category),
      el('td', '', spot.district),
      el('td', '', spot.rating ?? '–')
    );
    const actions = el('td', 'admin-actions');
    actions.append(
      button('Edit', () => openForm(spot)),
      button('Delete', () => {
        if (!confirm(`Delete "${spot.name}"? This cannot be undone.`)) return;
        run(async () => { await api(`spots/${encodeURIComponent(spot.id)}`, { method: 'DELETE' }); await loadSpots(); }, `Deleted "${spot.name}".`);
      }, 'admin-action admin-action--danger')
    );
    row.append(actions);
    return row;
  }));
}

async function loadSpots() {
  spots = await api('spots');
  renderSpots();
}

/** Hiện các ô riêng của món ăn hoặc địa điểm theo loại đang chọn. */
function syncKindFields() {
  for (const field of form.querySelectorAll('[data-for]')) {
    field.hidden = field.dataset.for !== ui['spot-kind'].value;
  }
}

function openForm(spot = null) {
  editingId = spot?.id ?? null;
  form.reset();
  ui['spot-error'].hidden = true;
  ui['spot-form-title'].textContent = spot ? `Edit "${spot.name}"` : 'Add new';
  ui['spot-kind'].disabled = Boolean(spot); // Loại không đổi được sau khi tạo.
  if (spot) {
    for (const [key, value] of Object.entries(spot)) {
      const field = form.elements[key];
      if (!field || key === 'venues') continue;
      if (field.type === 'checkbox') field.checked = Boolean(value);
      else field.value = value ?? '';
    }
  }
  syncKindFields();
  form.hidden = false;
  form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  form.elements.name.focus();
}

function closeForm() {
  form.hidden = true;
  editingId = null;
}

/** Đọc form thành JSON: ô trống thành chuỗi rỗng, server sẽ đổi thành null hoặc báo lỗi. */
function formBody() {
  const body = {};
  for (const field of form.elements) {
    if (!field.name || field.closest('[hidden]')) continue;
    body[field.name] = field.type === 'checkbox' ? field.checked : field.value;
  }
  body.kind = ui['spot-kind'].value;
  return body;
}

ui['spots-filter'].addEventListener('change', renderSpots);
ui['spot-kind'].addEventListener('change', syncKindFields);
ui['add-spot'].addEventListener('click', () => openForm());
ui['cancel-spot'].addEventListener('click', closeForm);
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  ui['spot-error'].hidden = true;
  try {
    const saved = await api(editingId ? `spots/${encodeURIComponent(editingId)}` : 'spots', {
      method: editingId ? 'PUT' : 'POST',
      body: formBody(),
    });
    closeForm();
    await loadSpots();
    status(`Saved "${saved.name}".`);
  } catch (error) {
    ui['spot-error'].textContent = error.message;
    ui['spot-error'].hidden = false;
  }
});

// ---- Người dùng -------------------------------------------------------------------

function renderUsers(users) {
  ui['users-count'].textContent = `(${users.length})`;
  ui['users-body'].replaceChildren(...users.map((user) => {
    const isSelf = user.id === me.id;
    const methods = [user.hasPassword && 'Password', user.hasGoogle && 'Google'].filter(Boolean).join(' + ');
    const row = el('tr');
    const name = el('th', '', isSelf ? `${user.name} (you)` : user.name);
    name.scope = 'row';
    row.append(name, el('td', '', user.email), el('td', '', methods), el('td', '', user.role), el('td', '', user.role === 'admin' ? 'Premium (admin)' : user.plan), el('td', '', user.createdAt.slice(0, 10)));

    const actions = el('td', 'admin-actions');
    if (user.role !== 'admin') {
      const nextPlan = user.plan === 'premium' ? 'free' : 'premium';
      actions.append(button(nextPlan === 'premium' ? 'Give Premium' : 'Remove Premium', () => run(async () => {
        await api(`users/${user.id}`, { method: 'PATCH', body: { plan: nextPlan } });
        await loadUsers();
      }, `${user.name} is now on the ${nextPlan} plan.`)));
    }
    if (!isSelf) {
      const nextRole = user.role === 'admin' ? 'user' : 'admin';
      actions.append(
        button(nextRole === 'admin' ? 'Make admin' : 'Remove admin', () => run(async () => {
          await api(`users/${user.id}`, { method: 'PATCH', body: { role: nextRole } });
          await loadUsers();
        }, `${user.name} is now ${nextRole === 'admin' ? 'an admin' : 'a regular user'}.`)),
        button('Delete', () => {
          if (!confirm(`Delete the account of ${user.name} (${user.email})?`)) return;
          run(async () => { await api(`users/${user.id}`, { method: 'DELETE' }); await loadUsers(); }, `Deleted ${user.email}.`);
        }, 'admin-action admin-action--danger')
      );
    }
    row.append(actions);
    return row;
  }));
}

async function loadUsers() {
  renderUsers(await api('users'));
}

// ---- Tab -------------------------------------------------------------------------------

function showTab(name) {
  const users = name === 'users';
  ui['spots-panel'].hidden = users;
  ui['users-panel'].hidden = !users;
  ui['tab-spots'].setAttribute('aria-pressed', String(!users));
  ui['tab-users'].setAttribute('aria-pressed', String(users));
  status('');
}

ui['tab-spots'].addEventListener('click', () => showTab('spots'));
ui['tab-users'].addEventListener('click', () => { showTab('users'); run(loadUsers, ''); });

run(loadSpots, '');
