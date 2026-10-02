/**
 * TRANG ĐỊA ĐIỂM: lọc danh mục kind=place, tìm theo tên/nhóm/quận và dựng thẻ bằng DOM.
 * Mỗi thẻ hiển thị thời gian tham quan, vé và link sang Google Maps hoặc trang Plan.
 */
import { loadSpots, mapsSearch } from '../shared/guide.js';
import { el, link, picture } from '../shared/ui.js';
import { initAuth } from '../shared/auth.js';

initAuth();

const search = document.querySelector('#places-search');
const grid = document.querySelector('#places-list');
const count = document.querySelector('#places-count');
let places = [];

// Tìm chuỗi nhập trong tên, nhóm hoặc quận (không phân biệt hoa thường), rồi dựng lại danh sách.
function render() {
  const query = search.value.trim().toLocaleLowerCase('vi');
  const shown = places.filter((spot) => `${spot.name} ${spot.category} ${spot.district}`.toLocaleLowerCase('vi').includes(query));
  count.textContent = `${shown.length} places`;
  grid.replaceChildren(...shown.map((spot) => {
    const card = el('article', 'guide-card');
    card.id = spot.id;
    card.append(picture(spot.image, spot.name, 'guide-card__photo'));
    const copy = el('div', 'guide-card__copy');
    copy.append(el('p', 'eyebrow', spot.category), el('h2', '', spot.name), el('p', '', spot.shortDescription));
    copy.append(el('p', 'guide-card__meta', `${spot.district} · ${spot.durationMinutes} minutes · ${spot.admission === 0 ? 'Free entry' : `${Number(spot.admission).toLocaleString('en-US')} VND`}`));
    const actions = el('div', 'guide-card__actions');
    // Query ?place=... chỉ chọn sẵn địa điểm ở Plan; người dùng vẫn bấm nút thêm để đưa vào lịch.
    actions.append(link('View on Maps', mapsSearch(spot.name, spot.address)), link('Add to plan', `/plan.html?place=${encodeURIComponent(spot.id)}`, 'button button--primary'));
    copy.append(actions);
    card.append(copy);
    return card;
  }));
}

search.addEventListener('input', render);
// Sau khi tải và dựng thẻ, hash #id giúp cuộn tới địa điểm được chọn từ trang chủ.
try {
  places = (await loadSpots()).filter((spot) => spot.kind === 'place');
  render();
  if (location.hash && document.getElementById(location.hash.slice(1))) {
    document.getElementById(location.hash.slice(1)).scrollIntoView();
  }
} catch (error) {
  count.textContent = error.message;
}
