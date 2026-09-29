/** Điều khiển giao diện Plan; không đọc/ghi dữ liệu chuyến đi. */
export function createPicker(root) {
  const buttons = [...root.querySelectorAll('[data-picker]')];
  function select(name, focus = false) {
    for (const button of buttons) {
      const active = button.dataset.picker === name;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      document.getElementById(button.getAttribute('aria-controls')).hidden = !active;
      if (active && focus) button.focus();
    }
  }
  buttons.forEach((button, index) => {
    button.addEventListener('click', () => select(button.dataset.picker));
    button.addEventListener('keydown', (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const offset = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
        : offset ? (index + offset + buttons.length) % buttons.length : null;
      if (next === null) return;
      event.preventDefault();
      select(buttons[next].dataset.picker, true);
    });
  });
  return select;
}

/** Dialog HTML xử lý focus, Tab và Escape. Chỉ chạy hàm thay thế khi xác nhận. */
export function createConfirmation(dialog) {
  let onConfirm = null;
  dialog.addEventListener('close', () => {
    const action = onConfirm;
    onConfirm = null;
    if (dialog.returnValue === 'confirm') action?.();
  });
  return (title, text, buttonText, action) => {
    dialog.querySelector('#confirm-title').textContent = title;
    dialog.querySelector('#confirm-text').textContent = text;
    dialog.querySelector('#confirm-apply').textContent = buttonText;
    dialog.returnValue = '';
    onConfirm = action;
    dialog.showModal();
  };
}
