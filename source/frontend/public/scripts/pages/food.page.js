/**
 * TRANG MÓN ĂN: tải danh mục một lần, tìm theo tên ngay trong trình duyệt và xếp quán theo mốc xuất phát.
 * Save dish lưu id món vào localStorage; Add to plan chuyển món/quán qua URL sang trang lập lịch.
 */
import { ORIGINS, approxKm, loadSpots, mapsDirections, readFavorites, readTrip, saveTrip, sortedVenues, toggleFavorite } from '../shared/guide.js';
import { el, link, picture } from '../shared/ui.js';
import { initAuth } from '../shared/auth.js';

initAuth();

const search = document.querySelector('#food-search');
const originSelect = document.querySelector('#food-origin');
const grid = document.querySelector('#food-list');
const count = document.querySelector('#food-count');
let foods = [];

for (const origin of ORIGINS) {
  const option = el('option', '', origin.name);
  option.value = origin.id;
  originSelect.append(option);
}
originSelect.value = readTrip().originId;

// Lấy từ khóa và mốc xuất phát hiện tại, lọc món rồi thay danh sách thẻ cũ bằng kết quả mới.
function renderFood() {
  const origin = ORIGINS.find((item) => item.id === originSelect.value) ?? ORIGINS[0];
  const searchText = search.value.trim().toLocaleLowerCase('vi');
  const shown = foods.filter((food) => food.name.toLocaleLowerCase('vi').includes(searchText));
  count.textContent = `${shown.length} dishes`;
  const saved = new Set(readFavorites());
  grid.replaceChildren(...shown.map((food) => {
    const card = el('article', 'guide-card');
    card.id = food.id;
    // Ảnh món được nhóm chọn; không gán là ảnh chụp tại một quán cụ thể.
    const photo = el('figure', 'food-photo');
    photo.append(picture(food.image, food.name, 'guide-card__photo'), el('figcaption', '', 'Dish illustration. Restaurant servings may vary.'));
    if (food.id === 'food-pho-cuon') {
      photo.querySelector('figcaption').append(' Photo: ', link('Vietnam Tourism / VOV', 'https://www.vietnamtourism.org.vn/pho-cuon-a-favourite-dish-for-hot-summer-in-hanoi.html'));
    }
    card.append(photo);
    const copy = el('div', 'guide-card__copy');
    copy.append(el('p', 'eyebrow', food.category), el('h2', '', food.name), el('p', '', food.shortDescription));
    const fav = el('button', 'text-action', saved.has(food.id) ? '♥ Saved dish' : '♡ Save dish');
    fav.type = 'button';
    fav.setAttribute('aria-pressed', String(saved.has(food.id)));
    // Đổi trạng thái yêu thích và nhãn nút tại chỗ, không cần tải lại trang.
    fav.addEventListener('click', () => {
      const active = toggleFavorite(food.id);
      fav.textContent = active ? '♥ Saved dish' : '♡ Save dish';
      fav.setAttribute('aria-pressed', String(active));
    });
    copy.append(fav, el('h3', 'guide-card__venues-title', 'Where to try it'));
    const venues = el('ol', 'venue-list');
    // Mỗi món có nhiều quán; xếp gần trước và tạo hai link chỉ đường / chọn quán cho lịch.
    for (const venue of sortedVenues(food, origin)) {
      const row = el('li', 'venue-row');
      const actions = el('div', 'venue-row__actions');
      actions.append(
        link('Directions', mapsDirections(origin, venue.name, venue.address)),
        link('Add to plan', `/plan.html?food=${encodeURIComponent(food.id)}&venue=${encodeURIComponent(venue.id)}`)
      );
      row.append(
        el('strong', '', venue.name),
        el('span', '', venue.address),
        el('span', 'venue-row__distance', `~${approxKm(origin, venue).toFixed(1)} km straight-line from ${origin.name}`),
        actions
      );
      venues.append(row);
    }
    copy.append(venues);
    card.append(copy);
    return card;
  }));
}

// Lưu mốc xuất phát vào chuyến đi để trang Food và Plan dùng chung lựa chọn.
originSelect.addEventListener('change', () => {
  const trip = readTrip();
  trip.originId = originSelect.value;
  saveTrip(trip);
  renderFood();
});
search.addEventListener('input', renderFood);

// Khởi tạo trang: chỉ gọi API một lần; thao tác tìm kiếm sau đó lọc mảng foods trong bộ nhớ.
try {
  foods = (await loadSpots()).filter((spot) => spot.kind === 'food');
  renderFood();
  if (location.hash && document.getElementById(location.hash.slice(1))) {
    document.getElementById(location.hash.slice(1)).scrollIntoView();
  }
} catch (error) {
  count.textContent = error.message;
}
