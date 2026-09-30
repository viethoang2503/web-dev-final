/**
 * DỮ LIỆU ĐẦU VÀO CHO SEED: FOOD có 10 món, GROUP_FOOD bổ sung 4 món, PLACES có 10 địa điểm.
 * priceLevel là mức giá món; admission là tiền vé VND; durationMinutes là số phút tham quan.
 * imageFor tạo URL ảnh không có đuôi để middleware chọn định dạng đang tồn tại.
 */
/**
 * Quy ước dữ liệu mẫu:
 * - Tên trường JavaScript dùng camelCase; seed.js đổi sang snake_case của SQL.
 * - priceLevel: 1 = rẻ, 2 = vừa, 3 = cao; chỉ dùng cho món ăn.
 * - admission: tiền vé VND, 0 = miễn phí; durationMinutes: thời lượng tham quan.
 * - image: URL không có đuôi; middleware chọn file ảnh có sẵn.
 * Các mô tả và giờ trong danh mục là nội dung tham khảo được lưu sẵn.
 */

import { GROUP_FOOD } from '../data/group-food.js';

const imageFor = (id) => `/assets/images/spots/${id}`;

const FOOD = [
  {
    id: 'food-pho-bo',
    name: 'Pho Bo',
    category: 'Noodles',
    district: 'Hoan Kiem',
    priceLevel: 1,
    rating: 4.8,
    shortDescription:
      'Clear beef broth simmered overnight, soft rice noodles and a plate of fresh herbs.',
    description:
      'Pho is the dish most visitors try first, and the Hanoi version is deliberately plain: a clean broth from beef bones, flat rice noodles, thin slices of beef and spring onion.\n\nSouthern bowls arrive with a crowded herb plate. Here the broth is meant to carry the bowl on its own, so taste it before adding anything.',
    address: '49 Bat Dan, Hoan Kiem',
    openingHours: '06:00 - 10:30, 18:00 - 20:30',
    localTip: 'Arrive before 8am, because the best pots often sell out by mid-morning.',
    featured: true,
  },
  {
    id: 'food-bun-cha',
    name: 'Bun Cha',
    category: 'Grilled',
    district: 'Hoan Kiem',
    priceLevel: 1,
    rating: 4.7,
    shortDescription:
      'Charcoal-grilled pork patties in sweet-sour broth, served with noodles and herbs.',
    description:
      'A lunch dish built from four plates: grilled pork in a bowl of diluted fish sauce, cold rice noodles, a pile of herbs and a small dish of chilli and garlic.\n\nYou assemble each bite yourself, which is why portions look small until you start eating.',
    address: '1 Hang Manh, Hoan Kiem',
    openingHours: '10:00 - 20:00',
    localTip: 'Share one portion first; the herb plate is refilled for free.',
    featured: true,
  },
  {
    id: 'food-banh-mi',
    name: 'Banh Mi',
    category: 'Street snack',
    district: 'Hoan Kiem',
    priceLevel: 1,
    rating: 4.6,
    shortDescription:
      'Crisp baguette filled with pate, cold cuts, pickles and a handful of coriander.',
    description:
      'The most portable meal in the city and the cheapest way to eat well between sights. A good one is toasted to order so the crust still cracks.\n\nStalls differ mainly in their pate and pickles, so it is worth trying more than one.',
    address: '25 Hang Ca, Hoan Kiem',
    openingHours: '07:00 - 21:00',
    localTip: 'Ask for the chilli sauce on the side rather than inside the bread.',
    featured: false,
  },
  {
    id: 'food-ca-phe-trung',
    name: 'Egg Coffee',
    category: 'Coffee',
    district: 'Hoan Kiem',
    priceLevel: 1,
    rating: 4.7,
    shortDescription: 'Whipped egg yolk and condensed milk poured over strong Vietnamese coffee.',
    description:
      'Invented in Hanoi when fresh milk was scarce, egg coffee is closer to a warm dessert than a drink. The foam is thick enough to hold a spoon.\n\nMost cafes serve the glass sitting in hot water so the top layer stays soft.',
    address: '39 Nguyen Huu Huan, Hoan Kiem',
    openingHours: '07:00 - 22:00',
    localTip: 'Drink it while the foam is still warm and keep the glass in its water bowl.',
    featured: true,
  },
  {
    id: 'food-cha-ca',
    name: 'Cha Ca La Vong',
    category: 'Specialty',
    district: 'Hoan Kiem',
    priceLevel: 2,
    rating: 4.5,
    shortDescription:
      'Turmeric fish sizzled at the table with dill and spring onion, eaten with noodles.',
    description:
      'A single-dish restaurant tradition: marinated fish arrives in a hot pan and finishes cooking in front of you with a heap of dill.\n\nYou eat it with rice noodles, peanuts and shrimp paste, adding a little of everything to each bowl.',
    address: '14 Cha Ca, Hoan Kiem',
    openingHours: '11:00 - 21:00',
    localTip: 'Let the dill wilt into the pan before you add the noodles.',
    featured: false,
  },
  {
    id: 'food-banh-cuon',
    name: 'Banh Cuon',
    category: 'Rice and sticky rice',
    district: 'Ba Dinh',
    priceLevel: 1,
    rating: 4.4,
    shortDescription: 'Silky steamed rice sheets rolled around minced pork and wood-ear mushroom.',
    description:
      'Batter is steamed over cloth into a thin sheet, filled, folded and topped with fried shallots. It is a breakfast dish and rarely sold after lunch.\n\nLight enough that two portions are normal if you have a long morning of walking ahead.',
    address: '12 Ngoc Ha, Ba Dinh',
    openingHours: '06:30 - 14:00',
    localTip: 'Spoon the warm dipping sauce over the rolls so they do not dry out.',
    featured: false,
  },
  {
    id: 'food-bun-thang',
    name: 'Bun Thang',
    category: 'Noodles',
    district: 'Hoan Kiem',
    priceLevel: 2,
    rating: 4.5,
    shortDescription:
      'A tidy bowl of shredded chicken, egg and pork in a delicate chicken-shrimp broth.',
    description:
      'The most fiddly of the Hanoi noodle soups. Every topping is cut into fine threads and arranged in sections before the broth is poured.\n\nThe flavour is gentle, so it suits a late breakfast better than a heavy dinner.',
    address: '48 Cau Go, Hoan Kiem',
    openingHours: '07:00 - 22:00',
    localTip: 'Shrimp paste is traditional here, but add it a little at a time.',
    featured: false,
  },
  {
    id: 'food-xoi-xeo',
    name: 'Xoi Xeo',
    category: 'Rice and sticky rice',
    district: 'Hoan Kiem',
    priceLevel: 1,
    rating: 4.3,
    shortDescription:
      'Sticky rice under crumbled mung bean, fried shallots and a slice of braised pork.',
    description:
      'Street breakfast that keeps you going until afternoon. The mung bean is shaved off a block in thin curls right onto the rice.\n\nOrder it plain, or add braised pork, chicken or Vietnamese sausage.',
    address: '35B Nguyen Huu Huan, Hoan Kiem',
    openingHours: '06:00 - 23:00',
    localTip: 'The upstairs room is quieter when the street benches fill up.',
    featured: false,
  },
  {
    id: 'food-nem-cua-be',
    name: 'Nem Cua Be',
    category: 'Street snack',
    district: 'Hai Ba Trung',
    priceLevel: 1,
    rating: 4.4,
    shortDescription:
      'Square sea-crab spring rolls fried until crackling, usually shared with bun cha.',
    description:
      'A Hai Phong dish that Hanoi adopted and now serves beside almost every plate of bun cha. The square shape is the giveaway.\n\nBest eaten straight from the fryer while the wrapper is still loud.',
    address: '24 Le Van Huu, Hai Ba Trung',
    openingHours: '10:00 - 20:30',
    localTip: 'Cut each roll in half so the filling cools before the first bite.',
    featured: false,
  },
  {
    id: 'food-pho-cuon',
    name: 'Pho Cuon',
    category: 'Rolls',
    district: 'Ba Dinh',
    priceLevel: 2,
    rating: 4.5,
    shortDescription:
      'Fresh rice sheets wrapped around stir-fried beef and herbs, dipped in light sauce.',
    description:
      'The same noodle sheet as pho, left uncut and rolled around beef, lettuce and herbs. No broth, so it works well on a hot evening.\n\nThe Ngu Xa area near Truc Bach lake is where most people go for it.',
    address: '31 Ngu Xa, Ba Dinh',
    openingHours: '10:00 - 22:00',
    localTip: 'Order a plate of fried pho squares alongside for the change in texture.',
    featured: false,
  },
];

const PLACES = [
  {
    id: 'place-hoan-kiem-lake',
    lat: 21.029,
    lng: 105.852,
    name: 'Hoan Kiem Lake',
    category: 'Landmark',
    district: 'Hoan Kiem',
    admission: 50000,
    durationMinutes: 90,
    rating: 4.8,
    shortDescription:
      "The city's calm centre, with Ngoc Son Temple reached over a red wooden bridge.",
    description:
      'Every visit to Hanoi passes through here. The lake separates the Old Quarter from the French-era streets and is ringed by a walking path.\n\nEntry to the lakeside path is free; the ticket covers Ngoc Son Temple on the island.',
    address: 'Dinh Tien Hoang, Hoan Kiem',
    openingHours: 'Temple 08:00 - 18:00, lakeside open all day',
    localTip: 'Come at sunrise to see locals exercising before the traffic returns.',
    featured: true,
  },
  {
    id: 'place-old-quarter',
    lat: 21.035,
    lng: 105.849,
    name: 'Old Quarter',
    category: 'Neighbourhood',
    district: 'Hoan Kiem',
    admission: 0,
    durationMinutes: 120,
    rating: 4.7,
    shortDescription:
      'Thirty-six trade streets of shophouses, market stalls and constant motorbike flow.',
    description:
      'Historically each street sold one product, and some still do: silk on Hang Gai, tin on Hang Thiec, herbs on Lan Ong.\n\nThere is no route to follow. Pick a direction, accept getting lost, and stop when something smells good.',
    address: 'Hang Bac, Hoan Kiem',
    openingHours: 'Open all day',
    localTip: 'On weekend evenings the core streets close to traffic and become walkable.',
    featured: true,
  },
  {
    id: 'place-temple-of-literature',
    lat: 21.03,
    lng: 105.836,
    name: 'Temple of Literature',
    category: 'Heritage',
    district: 'Dong Da',
    admission: 70000,
    durationMinutes: 75,
    rating: 4.7,
    shortDescription:
      "Vietnam's first university, a sequence of quiet courtyards, gates and stone stelae.",
    description:
      'Founded in 1070 and dedicated to Confucius, this was the training ground for the country’s civil servants for centuries.\n\nThe stone stelae mounted on turtles record the names of graduates from the imperial examinations.',
    address: '58 Quoc Tu Giam, Dong Da',
    openingHours: '08:00 - 17:00',
    localTip: 'Enter from Quoc Tu Giam street so you walk the courtyards in the intended order.',
    featured: true,
  },
  {
    id: 'place-thang-long-citadel',
    lat: 21.036,
    lng: 105.84,
    name: 'Imperial Citadel of Thang Long',
    category: 'Heritage',
    district: 'Ba Dinh',
    admission: 100000,
    durationMinutes: 90,
    rating: 4.6,
    shortDescription:
      'A UNESCO-listed royal site with excavated foundations and a wartime command bunker.',
    description:
      'The political centre of Vietnam for almost a thousand years, only partly excavated. Layers from several dynasties sit on top of each other.\n\nThe modern history is here too: the D67 building and its underground bunker were used during the American war.',
    address: '19C Hoang Dieu, Ba Dinh',
    openingHours: '08:00 - 17:00, closed Monday',
    localTip: 'The D67 bunker behind the main hall is the part most visitors walk past.',
    featured: false,
  },
  {
    id: 'place-ho-chi-minh-complex',
    lat: 21.037,
    lng: 105.835,
    name: 'Ho Chi Minh Mausoleum Area',
    category: 'Heritage',
    district: 'Ba Dinh',
    admission: 0,
    durationMinutes: 90,
    rating: 4.5,
    shortDescription:
      'Ba Dinh Square, the mausoleum, the stilt house and the One Pillar Pagoda together.',
    description:
      'One walkable government quarter holding several sites, so it is best treated as a single morning rather than four stops.\n\nThe mausoleum itself closes early and shuts entirely for maintenance periods, so check before travelling across town.',
    address: '2 Hung Vuong, Ba Dinh',
    openingHours: '07:30 - 10:30, closed Monday and Friday afternoon',
    localTip: 'Cover shoulders and knees, and expect a security check before entry.',
    featured: false,
  },
  {
    id: 'place-museum-of-ethnology',
    lat: 21.04,
    lng: 105.799,
    name: 'Museum of Ethnology',
    category: 'Museum',
    district: 'Cau Giay',
    admission: 40000,
    durationMinutes: 120,
    rating: 4.6,
    shortDescription:
      'Indoor exhibits on 54 ethnic groups plus a garden of full-size traditional houses.',
    description:
      'The best museum in the city for understanding Vietnam beyond Hanoi, with clear English labelling throughout.\n\nThe outdoor section rebuilds houses from different regions at full scale, including a Bahnar communal house you can climb into.',
    address: 'Nguyen Van Huyen, Cau Giay',
    openingHours: '08:30 - 17:30, closed Monday',
    localTip: 'Leave time for the outdoor houses; they are the highlight, not an add-on.',
    featured: false,
  },
  {
    id: 'place-hoa-lo-prison',
    lat: 21.026,
    lng: 105.846,
    name: 'Hoa Lo Prison Memorial',
    category: 'Museum',
    district: 'Hoan Kiem',
    admission: 50000,
    durationMinutes: 60,
    rating: 4.6,
    shortDescription: 'A sober colonial-era prison museum kept in the middle of the modern city.',
    description:
      'Built by the French and later used for American pilots, the surviving wing is small but heavy going.\n\nWorth pairing with something lighter afterwards rather than another museum.',
    address: '1 Hoa Lo, Hoan Kiem',
    openingHours: '08:00 - 17:00',
    localTip: 'Take the audio guide; several rooms carry very little written context.',
    featured: false,
  },
  {
    id: 'place-tran-quoc-pagoda',
    lat: 21.048,
    lng: 105.837,
    name: 'Tran Quoc Pagoda',
    category: 'Pagoda',
    district: 'Tay Ho',
    admission: 0,
    durationMinutes: 60,
    rating: 4.5,
    shortDescription:
      'The oldest pagoda in Hanoi, on a small West Lake causeway with a red stupa tower.',
    description:
      'Over 1,500 years old and reached by a short causeway between West Lake and Truc Bach.\n\nIt is compact, so most people combine it with a walk or a coffee stop along the lake.',
    address: 'Thanh Nien, Tay Ho',
    openingHours: '07:30 - 18:00',
    localTip: 'Walk the causeway near dusk when the lake picks up the whole skyline.',
    featured: false,
  },
  {
    id: 'place-long-bien-bridge',
    lat: 21.041,
    lng: 105.86,
    name: 'Long Bien Bridge',
    category: 'Landmark',
    district: 'Long Bien',
    admission: 0,
    durationMinutes: 45,
    rating: 4.3,
    shortDescription: 'A century-old steel rail bridge you can cross on foot above the Red River.',
    description:
      'Finished in 1902, bombed repeatedly and still carrying trains. The repairs are visible in the mismatched spans.\n\nThe walk gives you the river, the sandbank vegetable plots and a view back at the city.',
    address: 'Long Bien Bridge, Long Bien',
    openingHours: 'Open all day',
    localTip: 'Keep to the marked pedestrian lane; trains still use the middle track.',
    featured: false,
  },
  {
    id: 'place-womens-museum',
    lat: 21.023,
    lng: 105.85,
    name: "Vietnamese Women's Museum",
    category: 'Museum',
    district: 'Hoan Kiem',
    admission: 40000,
    durationMinutes: 75,
    rating: 4.5,
    shortDescription: 'Three floors on family life, street vendors and women in wartime Vietnam.',
    description:
      'A well-organised museum a few minutes from Hoan Kiem Lake, covering marriage customs, childbirth, wartime roles and the street traders you see every day.\n\nSmall enough to finish comfortably before lunch.',
    address: '36 Ly Thuong Kiet, Hoan Kiem',
    openingHours: '08:00 - 17:00',
    localTip: 'Start on the top floor and work down to follow the intended narrative.',
    featured: false,
  },
];

/** Ghép món gốc, món bổ sung và địa điểm thành cùng cấu trúc để seed.js ghi vào SQLite. */
export const spots = [
  ...[...FOOD, ...GROUP_FOOD].map((item) => ({
    kind: 'food',
    admission: null,
    durationMinutes: null,
    image: imageFor(item.id),
    ...item,
  })),
  ...PLACES.map((item) => ({
    kind: 'place',
    priceLevel: null,
    image: imageFor(item.id),
    ...item,
  })),
];

/** Tổng hợp số lượng và các nhóm/quận không trùng để in thông tin khi seed. */
export const seedSummary = {
  foodCount: FOOD.length + GROUP_FOOD.length,
  placeCount: PLACES.length,
  foodCategories: [...new Set([...FOOD, ...GROUP_FOOD].map((f) => f.category))].sort(),
  placeCategories: [...new Set(PLACES.map((p) => p.category))].sort(),
  districts: [...new Set([...FOOD, ...PLACES].map((s) => s.district))].sort(),
};
