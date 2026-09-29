/** Kiểm tra ngắn luồng demo: món ăn, quán, tour và lịch nhiều ngày. */
import { withPage, check, summary } from './helpers/browser.mjs';

let sharedUrl = '';
const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');

await withPage(base + '/', { width: 1440, height: 900, settleMs: 350 }, async (page) => {
  check('Home has four hero photos', await page.evaluate('document.querySelectorAll(".home-collage img").length') === 4);
  check('Home shows three suggested tours', await page.evaluate('document.querySelectorAll(".home-tour").length') === 3);
  check('Home has no sign-in or sign-out control', await page.evaluate('!document.querySelector("[data-role=auth-sign-in], [data-action=logout]")'));
  check('Home has no script errors', page.errors().exceptions.length === 0 && page.errors().console.length === 0);
});

await withPage(base + '/food.html', { width: 1440, height: 900, settleMs: 450 }, async (page) => {
  check('Fourteen dishes are loaded', await page.evaluate('document.querySelectorAll(".food-list .guide-card").length') === 14);
  check('Every dish has at least two restaurants', await page.evaluate('[...document.querySelectorAll(".food-list .guide-card")].every(card => card.querySelectorAll(".venue-row").length >= 2)'));
  check('Directions use Google Maps URLs', await page.evaluate('[...document.querySelectorAll(".venue-row__actions a:first-child")].every(link => link.href.startsWith("https://www.google.com/maps/dir/?api=1"))'));
  await page.click('.food-list .text-action');
  check('Favorite dish is stored locally', await page.evaluate('JSON.parse(localStorage.getItem("hanoi-local-favorite-dishes-v2")).includes("food-pho-bo")'));
  await page.fill('#food-origin', 'west-lake', 'change');
  check('Changing the start point updates distance labels', await page.evaluate('document.querySelector(".venue-row__distance").textContent.includes("West Lake")'));
  check('Food has no script errors', page.errors().exceptions.length === 0 && page.errors().console.length === 0);
});

await withPage(base + '/places.html', { width: 1440, height: 900, settleMs: 450 }, async (page) => {
  check('Ten places are loaded', await page.evaluate('document.querySelectorAll(".places-list .guide-card").length') === 10);
  await page.fill('#places-search', 'temple');
  check('Search narrows places', await page.evaluate('document.querySelectorAll(".places-list .guide-card").length === 1'));
});

await withPage(base + '/plan.html', { width: 1440, height: 900, settleMs: 450 }, async (page) => {
  check('Plan offers three ready tours', await page.evaluate('document.querySelectorAll(".tour-card").length') === 3);
  await page.fill('#day-count', '3', 'change');
  check('Trip has three day tabs', await page.evaluate('document.querySelectorAll(".day-tab").length') === 3);
  await page.click('.tour-card button');
  check('A tour creates dated stops with restaurants', await page.evaluate('document.querySelectorAll(".timeline-stop").length === 5 && document.querySelectorAll(".timeline-stop time").length === 5'));
  check('Tour is stored on day one', await page.evaluate('JSON.parse(localStorage.getItem("hanoi-local-trip-v2")).days[0].stops.length === 5'));
  await page.click('.day-tab:nth-child(2)');
  check('Day two starts separately', await page.evaluate('document.querySelectorAll(".timeline-stop").length === 0'));
  await page.click('.tour-card:nth-child(2) button');
  check('Day two stores a different tour', await page.evaluate('JSON.parse(localStorage.getItem("hanoi-local-trip-v2")).days[1].stops.length === 4'));
  check('Day one remains intact', await page.evaluate('JSON.parse(localStorage.getItem("hanoi-local-trip-v2")).days[0].stops.length === 5'));
  check('Timeline directions are external maps links', await page.evaluate('[...document.querySelectorAll(".timeline-stop__actions a")].every(a => a.href.includes("google.com/maps/dir/?api=1"))'));
  await page.click('.day-tab:nth-child(3)');
  await page.click('#picker-food');
  await page.evaluate('document.querySelector("#food-choice").value = JSON.parse(localStorage.getItem("hanoi-local-trip-v2")).days[0].stops.find(stop => stop.kind === "food").spotId; document.querySelector("#food-choice").dispatchEvent(new Event("change", { bubbles: true })); return true;');
  await page.click('#add-food button[type=submit]');
  check('A dish used on another day is added with a note', await page.evaluate('document.querySelector("#plan-status").textContent.includes("also in day")'));
  await page.evaluate('[...document.querySelectorAll(".timeline-stop__actions [aria-label^=Remove]")].find(b => b.getAttribute("aria-label").endsWith("from day 3")).click(); return true;');
  check('That duplicate can be removed again', await page.evaluate('JSON.parse(localStorage.getItem("hanoi-local-trip-v2")).days[2].stops.length === 0'));
  await page.evaluate('document.querySelector("#food-choice").value = [...document.querySelector("#food-choice").options].map(o => o.value).find(id => !JSON.parse(localStorage.getItem("hanoi-local-trip-v2")).days.some(d => d.stops.some(stop => stop.spotId === id))); document.querySelector("#food-choice").dispatchEvent(new Event("change", { bubbles: true })); return true;');
  await page.click('#add-food button[type=submit]');
  await page.click('#picker-place');
  await page.evaluate('document.querySelector("#place-choice").value = [...document.querySelector("#place-choice").options].map(o => o.value).find(id => !JSON.parse(localStorage.getItem("hanoi-local-trip-v2")).days.some(d => d.stops.some(stop => stop.spotId === id))); document.querySelector("#place-choice").dispatchEvent(new Event("change", { bubbles: true })); return true;');
  await page.click('#add-place button[type=submit]');
  await page.click('#picker-custom');
  await page.fill('#custom-name', 'Bún riêu breakfast', 'input');
  await page.fill('#custom-address', '12 Hàng Bạc', 'input');
  await page.fill('#custom-time', '07:30', 'input');
  await page.click('#add-custom button[type=submit]');
  check('A custom dish appears in the schedule with its time', await page.evaluate('[...document.querySelectorAll(".timeline-stop")].some(li => li.textContent.includes("Bún riêu breakfast") && li.querySelector("time").textContent === "07:30")'));
  check('The custom stop is stored with name, address and time', await page.evaluate('JSON.parse(localStorage.getItem("hanoi-local-trip-v2")).days[2].stops.some(s => s.kind === "custom" && s.name === "Bún riêu breakfast" && s.address === "12 Hàng Bạc" && s.startTime === 450)'));
  check('The custom stop comes first because it is the earliest', await page.evaluate('document.querySelector(".timeline-stop h3").textContent === "Bún riêu breakfast"'));
  check('The custom form is cleared after adding', await page.evaluate('document.querySelector("#custom-name").value === ""'));
  await page.evaluate('[...document.querySelectorAll(".timeline-stop__actions [aria-label^=Remove]")].find(b => b.getAttribute("aria-label").startsWith("Remove Bún riêu")).click(); return true;');
  check('Manual food and place are stored on day three', await page.evaluate('JSON.parse(localStorage.getItem("hanoi-local-trip-v2")).days[2].stops.length === 2'));
  check('Day summary shows a schedule and entry fees', await page.evaluate('document.querySelector(".day-summary")?.textContent.includes("Entry fees")'));
  check('Day tabs expose tab semantics', await page.evaluate('document.querySelectorAll("#day-tabs [role=tab]").length === 3 && document.querySelectorAll("#day-tabs [role=tab][aria-selected=true]").length === 1'));
  await page.click('.timeline-stop__actions [aria-label^="Remove"]');
  check('Removing a stop offers Undo', await page.evaluate('document.querySelector("#plan-status button").textContent === "Undo"'));
  await page.click('#plan-status button');
  check('Undo restores the stop', await page.evaluate('JSON.parse(localStorage.getItem("hanoi-local-trip-v2")).days[2].stops.length === 2'));
  await page.click('.timeline-stop:last-child .timeline-stop__adjust summary');
  await page.click('.timeline-stop:last-child [data-move$=":up"]');
  check('Move up reorders stops and is stored', await page.evaluate('JSON.parse(localStorage.getItem("hanoi-local-trip-v2")).days[2].stops[0].kind === "place"'));
  await page.fill('.timeline-stop__adjust input[type=number]', '30', 'change');
  check('Custom duration is stored', await page.evaluate('JSON.parse(localStorage.getItem("hanoi-local-trip-v2")).days[2].stops.some(stop => stop.duration === 30)'));
  check('Adjust panel stays open after render', await page.evaluate('document.querySelector(".timeline-stop__adjust").open'));
  check('Nearby ideas are offered', await page.evaluate('document.querySelectorAll(".nearby-item").length >= 1'));
  await page.click('#nearby-title');
  await page.click('.nearby-item button');
  check('A nearby idea can be added to the day', await page.evaluate('JSON.parse(localStorage.getItem("hanoi-local-trip-v2")).days[2].stops.length === 3'));
  await page.click('#more-menu > summary');
  await page.click('#optimise-order');
  check('Optimise order responds', await page.evaluate('document.querySelector("#plan-status").textContent.length > 0'));
  await page.click('.timeline-stop:last-child [aria-label^="Remove"]');
  check('Day route opens Google Maps with waypoints', await page.evaluate('return (() => { const href = document.querySelector("#route-link").href; return href.startsWith("https://www.google.com/maps/dir/?api=1") && href.includes("waypoints="); })()'));
  await page.click('#more-menu > summary');
  await page.click('#copy-share');
  check('Copy share link reports a result', await page.evaluate('/copied|Copy the link below/.test(document.querySelector("#plan-status").textContent)'));
  sharedUrl = await page.evaluate('import("/scripts/shared/share.js").then((m) => m.shareUrl(JSON.parse(localStorage.getItem("hanoi-local-trip-v2"))))');
  check('Share URL carries the plan in the hash', sharedUrl.includes('/plan.html#plan='));
  check('Day three displays both stops with times', await page.evaluate('document.querySelectorAll(".timeline-stop time").length === 2'));
  check('Plan has no script errors', page.errors().exceptions.length === 0 && page.errors().console.length === 0);
});

await withPage(sharedUrl.replace(/^https?:\/\/[^/]+/, base), { width: 1440, height: 900, settleMs: 600 }, async (page) => {
  check('Shared link fills an empty browser with three days', await page.evaluate('return (() => { const t = JSON.parse(localStorage.getItem("hanoi-local-trip-v2")); return t.dayCount === 3 && t.days[0].stops.length === 5 && t.days[2].stops.length === 2; })()'));
  check('Shared link is removed from the address bar', await page.evaluate('!location.hash'));
  check('Shared plan is announced', await page.evaluate('document.querySelector("#plan-status").textContent.includes("Shared plan loaded")'));
  check('Shared link has no script errors', page.errors().exceptions.length === 0 && page.errors().console.length === 0);
});

await withPage(base + '/plan.html#plan=garbage!!', { width: 1440, height: 900, settleMs: 450 }, async (page) => {
  check('Invalid share link is reported and ignored', await page.evaluate('document.querySelector("#plan-status").textContent.includes("not valid")'));
});

await withPage(base + '/plan.html?tour=old-quarter', { width: 1440, height: 900, settleMs: 450 }, async (page) => {
  await page.click('#library-link');
  await page.fill('#plan-name', 'Test plan');
  await page.click('#save-plan button[type=submit]');
  check('A plan can be saved by name', await page.evaluate('JSON.parse(localStorage.getItem("hanoi-local-saved-plans-v1"))[0].name === "Test plan"'));
  await page.fill('#tour-name', 'My first tour');
  await page.click('#save-tour button[type=submit]');
  check('A day can be saved as a custom tour', await page.evaluate('document.querySelectorAll(".tour-card--custom").length === 1'));
  await page.click('#new-plan');
  await page.click('#confirm-apply');
  await page.wait(50);
  check('New plan empties the current plan', await page.evaluate('JSON.parse(localStorage.getItem("hanoi-local-trip-v2")).days[0].stops.length === 0'));
  check('Saved plans stay after starting a new plan', await page.evaluate('document.querySelectorAll(".plan-library__item").length === 1'));
  await page.click('.tour-card--custom button');
  check('A custom tour fills the day', await page.evaluate('JSON.parse(localStorage.getItem("hanoi-local-trip-v2")).days[0].stops.length === 5'));
  await page.click('#new-plan');
  await page.click('#confirm-apply');
  await page.wait(50);
  await page.click('.plan-library__item .button');
  check('Opening a saved plan restores it', await page.evaluate('JSON.parse(localStorage.getItem("hanoi-local-trip-v2")).days[0].stops.length === 5'));
  await page.click('.plan-library__item .text-action');
  await page.click('#confirm-apply');
  await page.wait(50);
  check('A saved plan can be deleted', await page.evaluate('document.querySelectorAll(".plan-library__item").length === 0'));
  check('Library has no script errors', page.errors().exceptions.length === 0 && page.errors().console.length === 0);
});

await withPage(base + '/plan.html', { width: 1440, height: 900, settleMs: 450 }, async (page) => {
  const tripJson = 'JSON.parse(localStorage.getItem("hanoi-local-trip-v2"))';
  const firstStops = () => page.evaluate('document.querySelector(".tour-card__stops").textContent');
  const nearCentre = await firstStops();
  await page.fill('#trip-origin', 'west-lake', 'change');
  check('Tour stops change with the start point', (await firstStops()) !== nearCentre);
  await page.fill('#day-count', '5', 'change');
  check('A trip can have more than three days', await page.evaluate(`${tripJson}.dayCount === 5 && document.querySelectorAll(".day-tab").length === 5`));
  check('Ending date follows the number of days', await page.evaluate('(() => { const s = new Date(document.querySelector("#start-date").value); const e = new Date(document.querySelector("#end-date").value); return Math.round((e - s) / 86400000) === 4; })()'.replace('(() =>', 'return (() =>')));
  await page.click('.plan-end-date summary');
  await page.fill('#end-date', await page.evaluate('(() => { const d = new Date(document.querySelector("#start-date").value); d.setUTCDate(d.getUTCDate() + 6); return d.toISOString().slice(0, 10); })()'.replace('(() =>', 'return (() =>')), 'change');
  check('Changing the ending date changes the number of days', await page.evaluate(`${tripJson}.dayCount === 7 && document.querySelector("#day-count").value === "7"`));
  await page.click('#plan-all');
  check('Fill every empty day gives each day stops', await page.evaluate(`${tripJson}.days.slice(0, 7).every(day => day.stops.length >= 2)`));
  check('The first three days use different tours', await page.evaluate(`(() => { const d = ${tripJson}.days; const ids = d.slice(0, 3).flatMap(day => day.stops.map(s => s.spotId)); return new Set(ids).size === ids.length; })()`.replace('(() =>', 'return (() =>')));
  check('Ideas near the last stop are still offered when every spot is already planned', await page.evaluate('document.querySelectorAll(".nearby-item").length >= 1'));
  check('Fill every empty day has no script errors', page.errors().exceptions.length === 0 && page.errors().console.length === 0);
});

await withPage(base + '/plan.html', { width: 1440, height: 900, settleMs: 450 }, async (page) => {
  // Điểm tự nhập là thao tác đầu tiên trên trang mới, không cần thêm món hay địa điểm trước.
  await page.click('#picker-custom');
  await page.fill('#custom-name', 'Chè Thái', 'input');
  await page.click('#add-custom button[type=submit]');
  check('A custom stop can be the very first thing added', await page.evaluate('JSON.parse(localStorage.getItem("hanoi-local-trip-v2")).days[0].stops.length === 1 && document.querySelectorAll(".timeline-stop").length === 1 && !location.search'));
  check('The custom stop shows a Maps link without an address', await page.evaluate('new URL(document.querySelector(".timeline-stop__actions a").href).searchParams.get("destination") === "Chè Thái, Hanoi, Vietnam"'));
  check('Custom stop has no script errors', page.errors().exceptions.length === 0 && page.errors().console.length === 0);
});

await withPage(base + '/plan.html?tour=slow-day', { width: 1440, height: 900, settleMs: 450 }, async (page) => {
  check('Home tour link fills an empty first day', await page.evaluate('JSON.parse(localStorage.getItem("hanoi-local-trip-v2")).days[0].stops.length === 4'));
});

await withPage(base + '/plan.html', { width: 1024, height: 768, settleMs: 450 }, async (page) => {
  check('Plan fits a small desktop', await page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth'));
});

summary();
