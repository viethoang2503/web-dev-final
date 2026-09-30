/**
 * NỘI DUNG BỔ SUNG: các món nhóm lựa chọn được ghép vào danh sách seed-data.js.
 * Đây là dữ liệu biên soạn sẵn, không phải dữ liệu lấy trực tiếp từ website khi ứng dụng chạy.
 */
/** Món nhóm chọn trong https___HNlocalfood.docx, bổ sung ngày 29/09/2026.
 * File chỉ có tên và ảnh: phần mô tả ngắn do nhóm ứng dụng biên soạn lại.
 * Không tự đặt rating hay giờ mở cửa. Ảnh minh họa món, không phải ảnh của quán.
 * Bún bò Nam Bộ tạm chờ xác nhận vì ảnh gốc có tôm và nem rán.
 */
export const GROUP_FOOD = [
  {
    id: 'food-chao-suon', name: 'Chao Suon', category: 'Rice and sticky rice', district: 'Hoan Kiem',
    shortDescription: 'Smooth rice porridge with pork ribs, topped with crisp dough sticks and pork floss.',
    description: 'A warm bowl of rice porridge with tender pork ribs. Add the crisp dough sticks just before eating to keep their crunch.',
    localTip: 'Ask which toppings are included before ordering.',
  },
  {
    id: 'food-bun-dau-mam-tom', name: 'Bun Dau Mam Tom', category: 'Noodles', district: 'Hoan Kiem',
    shortDescription: 'Rice noodles, golden fried tofu and herbs with fermented shrimp dipping sauce.',
    description: 'A shared platter of rice noodles, fried tofu and fresh herbs, often served with pork and other sides. The fermented shrimp sauce has a strong flavour; ask about other sauces if you prefer.',
    localTip: 'Choose your sides separately; platters vary by restaurant.',
  },
  {
    id: 'food-bun-rieu', name: 'Bun Rieu', category: 'Noodles', district: 'Hoan Kiem',
    shortDescription: 'Rice noodles in a tangy tomato and crab broth, with tofu and fresh herbs.',
    description: 'Tomato gives this noodle soup its bright colour and light acidity. Crab, tofu and herbs form the base; extra toppings depend on the stall.',
    localTip: 'Ask for your preferred toppings before the bowl is assembled.',
  },
  {
    id: 'food-nem-cuon', name: 'Nem Cuon', category: 'Street snack', district: 'Ba Dinh',
    shortDescription: 'Fresh rice-paper rolls with herbs, rice noodles and fillings such as shrimp or pork.',
    description: 'Also called fresh spring rolls or goi cuon, these soft rice-paper rolls are served cold with a dipping sauce. Fillings and sauces vary, so check the menu for your preferred version.',
    localTip: 'Check the filling and dipping sauce when ordering.',
  },
];
