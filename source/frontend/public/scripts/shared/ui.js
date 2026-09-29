/** Tạo DOM an toàn: dữ liệu từ API đi qua textContent. */
export function el(tag, className = '', text = '') {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text) item.textContent = text;
  return item;
}

export function link(text, href, className = '') {
  const item = el('a', className, text);
  item.href = href;
  if (href.startsWith('https://')) {
    item.target = '_blank';
    item.rel = 'noopener noreferrer';
  }
  return item;
}

export function picture(src, alt, className = '') {
  const item = el('img', className);
  item.src = src;
  item.alt = alt;
  item.loading = 'lazy';
  item.width = 900;
  item.height = 675;
  return item;
}
