/**
 * KIỂM THỬ TRẢI NGHIỆM PLAN: kiểm tra tab, focus bàn phím, form, xác nhận thay thế và Undo.
 * Có mô phỏng tải API chậm/lỗi và localStorage đầy để kiểm tra trạng thái giao diện khi gặp sự cố.
 */
/** Hồi quy UX Plan. Mỗi withPage dùng profile tạm, không đụng lịch thật của người dùng. */
import { withPage, check, summary } from './helpers/browser.mjs';

const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const trip = 'JSON.parse(localStorage.getItem("hanoi-local-trip-v2"))';
const desktop = { width: 1440, height: 900, settleMs: 500 };

await withPage(base + '/plan.html', desktop, async (page) => {
  check('Loading finishes and enables the planner', await page.evaluate('document.querySelector("#planner-loading").hidden && !document.querySelector("#planner-workspace").inert'));
  check('Only suggested tours are shown initially', await page.evaluate('!document.querySelector("#panel-tours").hidden && ["add-food", "add-place", "add-custom"].every(id => document.getElementById(id).hidden)'));
  check('Empty itinerary explains how to get started', await page.evaluate('document.querySelectorAll(".plan-empty__actions button").length === 2'));
  check('First tour action is visible above the fold', await page.evaluate('document.querySelector("[data-use-tour]").getBoundingClientRect().bottom <= innerHeight'));
  await page.click('#picker-custom');
  await page.fill('#custom-name', 'Afternoon break');
  await page.click('#picker-food');
  await page.evaluate('document.querySelector("#food-preview").scrollIntoView({ block: "center" }); return true;');
  await page.wait(150);
  check('Food picker shows photo, full address and Maps', await page.evaluate('document.querySelector("#food-preview img").complete && document.querySelector("#food-preview img").naturalWidth > 0 && document.querySelector("#food-preview p").textContent.length > 10 && document.querySelector("#food-preview a").href.includes("google.com/maps/dir/")'));
  check('Restaurant options explain the approximate distance', await page.evaluate('[...document.querySelector("#venue-choice").options].every(o => /[(]~[0-9.]+ km[)]/.test(o.textContent))'));
  const venue = await page.evaluate('document.querySelector("#venue-choice").options[1].value');
  await page.fill('#venue-choice', venue, 'change');
  await page.fill('#day-count', '2', 'change');
  check('Changing trip settings preserves chosen restaurant', await page.evaluate('document.querySelector("#venue-choice").value') === venue);
  await page.click('#picker-custom');
  check('Changing picker tabs preserves the form draft', await page.evaluate('document.querySelector("#custom-name").value === "Afternoon break"'));
  await page.fill('#custom-time', '14:00');
  check('Fixed custom time disables irrelevant part-of-day choice', await page.evaluate('document.querySelector("#custom-slot").disabled'));
  await page.click('#add-custom button[type=submit]');
  check('Adding a stop updates the active day count', await page.evaluate('document.querySelector(".day-tab--active").textContent.includes("1 stop")'));
  check('Adding a stop announces its scheduled time', await page.evaluate('document.querySelector("#plan-status").textContent.includes("14:00")'));
  check('Adding a stop resets the time controls correctly', await page.evaluate('!document.querySelector("#custom-slot").disabled && !document.querySelector("#custom-time").value'));
  await page.click('#plan-status button');
  check('Undo works even when a day was previously empty', await page.evaluate(`${trip}.days[0].stops.length === 0`));
  // Kiểm tra tab bàn phím bằng sự kiện bàn phím thật, không gọi trực tiếp hàm của app.
  await page.evaluate('document.querySelector("#picker-custom").focus(); return true;');
  await page.key('Home');
  check('Home key selects the first picker tab', await page.evaluate('document.activeElement.id === "picker-tours" && !document.querySelector("#panel-tours").hidden'));
  await page.key('ArrowRight');
  check('Arrow key changes visible picker and focus together', await page.evaluate('document.activeElement.id === "picker-food" && !document.querySelector("#add-food").hidden && document.querySelector("#panel-tours").hidden'));
  await page.fill('#day-count', '2.5', 'change');
  check('Fractional day count is rejected inline without changing plan', await page.evaluate(`${trip}.dayCount === 2 && document.querySelector('#day-count').getAttribute('aria-invalid') === 'true' && document.querySelector('#settings-error').textContent.includes('whole number')`));
  await page.fill('#day-count', '2', 'change');
  check('Valid input clears validation error', await page.evaluate('!document.querySelector("#settings-error").textContent && !document.querySelector("#day-count").hasAttribute("aria-invalid")'));
  await page.click('.plan-end-date summary');
  await page.fill('#end-date', '2000-01-01', 'change');
  check('Ending date before starting date is rejected', await page.evaluate(`${trip}.dayCount === 2 && document.querySelector('#end-date').getAttribute('aria-invalid') === 'true'`));
  await page.fill('#start-date', '', 'change');
  check('Blank starting date cannot erase the plan date', await page.evaluate(`${trip}.startDate.length === 10 && document.querySelector('#start-date').getAttribute('aria-invalid') === 'true'`));
  check('Planner flow has no runtime errors', page.errors().exceptions.length === 0 && page.errors().console.length === 0);
});

await withPage(base + '/plan.html?tour=old-quarter', desktop, async (page) => {
  const original = await page.evaluate(`${trip}.days[0].stops`);
  await page.click('.tour-card:nth-child(2) [data-use-tour]');
  check('Replacing a day opens a confirmation before mutation', await page.evaluate('document.querySelector("#confirm-change").open') && JSON.stringify(await page.evaluate(`${trip}.days[0].stops`)) === JSON.stringify(original));
  check('Cancel has initial focus in the dialog', await page.evaluate('document.activeElement.value === "cancel"'));
  await page.key('Escape');
  check('Escape keeps the current day intact', !await page.evaluate('document.querySelector("#confirm-change").open') && JSON.stringify(await page.evaluate(`${trip}.days[0].stops`)) === JSON.stringify(original));
  await page.click('.tour-card:nth-child(2) [data-use-tour]');
  await page.click('#confirm-apply');
  await page.wait(50);
  check('Confirmed replacement applies the chosen tour', await page.evaluate(`${trip}.days[0].stops.length === 4`));
  check('Visible and accessible tour labels both say replace', await page.evaluate('[...document.querySelectorAll("[data-use-tour]")].every(b => b.textContent.includes("Replace") && b.getAttribute("aria-label").startsWith(b.textContent))'));
  await page.click('#plan-status button');
  check('Undo restores every stop after replacement', JSON.stringify(await page.evaluate(`${trip}.days[0].stops`)) === JSON.stringify(original));
  await page.fill('#day-count', '2', 'change');
  await page.click('.day-tab:nth-child(2)');
  await page.click('.tour-card [data-use-tour]');
  const secondDay = await page.evaluate(`${trip}.days[1].stops`);
  await page.fill('#day-count', '1', 'change');
  check('Shortening the trip explains hidden days', await page.evaluate('document.querySelector("#plan-status").textContent.includes("restore hidden days")'));
  await page.fill('#day-count', '2', 'change');
  check('Restoring trip length keeps the hidden day stops', JSON.stringify(await page.evaluate(`${trip}.days[1].stops`)) === JSON.stringify(secondDay));
  await page.click('#library-link');
  await page.click('#new-plan');
  check('Starting over also requires confirmation', await page.evaluate('document.querySelector("#confirm-change").open && document.querySelector("#confirm-title").textContent.includes("new plan")'));
  await page.click('#confirm-change button[value=cancel]');
  await page.wait(50);
  check('Cancel starting over preserves all days', await page.evaluate(`${trip}.dayCount === 2 && ${trip}.days[1].stops.length > 0`));
  check('Timeline has no nested scrollbar', await page.evaluate('!["auto", "scroll"].includes(getComputedStyle(document.querySelector("#timeline")).overflowY)'));
  check('Replacement flow has no runtime errors', page.errors().exceptions.length === 0 && page.errors().console.length === 0);
});

await withPage(base + '/plan.html?food=food-pho-bo', desktop, async (page) => {
  check('Food deep link opens the correct visible form', await page.evaluate('!document.querySelector("#add-food").hidden && document.querySelector("#food-choice").value === "food-pho-bo"'));
});

await withPage(base + '/plan.html?tour=old-quarter', { ...desktop, width: 1024, height: 768 }, async (page) => {
  check('Drag handles are visible without opening Edit stop', await page.evaluate('[...document.querySelectorAll("[data-move]")].every(button => button.getClientRects().length && !button.closest("details"))'));
  check('Every stop displays a departure time', await page.evaluate('document.querySelectorAll(".timeline-stop__end").length === document.querySelectorAll(".timeline-stop").length'));
  const beforeMove = await page.evaluate(`${trip}.days[0].stops`);
  await page.evaluate('document.querySelector(".timeline-stop:first-child [data-move]").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }))');
  await page.click('#plan-status button');
  check('Undo restores the original order after moving a stop', JSON.stringify(await page.evaluate(`${trip}.days[0].stops`)) === JSON.stringify(beforeMove));
  await page.click('.timeline-stop__adjust > summary');
  check('Edit controls fit a small desktop without overflow', await page.evaluate('document.documentElement.scrollWidth <= innerWidth && document.querySelector(".timeline-stop__fields").scrollWidth <= document.querySelector(".timeline-stop__fields").clientWidth'));
  check('Restaurant edit spans the full form width', await page.evaluate('document.querySelector(".timeline-stop__wide").clientWidth === document.querySelector(".timeline-stop__fields").clientWidth'));
  await page.evaluate('document.querySelector(".timeline-stop__adjust input[type=number]").focus(); return true;');
  await page.fill('.timeline-stop__adjust input[type=number]', '45', 'change');
  check('Editing duration preserves keyboard focus after re-render', await page.evaluate('document.activeElement.dataset.stopEdit.endsWith(":duration") && document.activeElement.value === "45"'));
});

// Mô phỏng server chậm/lỗi, chỉ trong profile test.
await withPage(base + '/plan.html', { ...desktop, beforeLoad: 'window.fetch = () => new Promise(() => {});' }, async (page) => {
  check('Slow load shows feedback and keeps controls inert', await page.evaluate('!document.querySelector("#planner-loading").hidden && document.querySelector("#trip-setup").inert && document.querySelector("#planner-workspace").inert'));
});

const existingTrip = { startDate: '2026-09-29', dayCount: 1, originId: 'hoan-kiem', days: [{ stops: [{ kind: 'custom', spotId: 'custom-test', name: 'My break', slot: 'morning' }] }] };
await withPage(base + '/plan.html', { ...desktop, beforeLoad: `localStorage.setItem('hanoi-local-trip-v2', ${JSON.stringify(JSON.stringify(existingTrip))}); window.fetch = async () => new Response('{}', { status: 503 });` }, async (page) => {
  check('Failed load exposes retry and a clear error', await page.evaluate('!document.querySelector("#planner-error").hidden && document.querySelector("#retry-load").checkVisibility() && document.querySelector("#planner-loading").hidden'));
  check('Failed load leaves stored itinerary untouched', JSON.stringify(await page.evaluate(trip)) === JSON.stringify(existingTrip));
});

await withPage(base + '/plan.html', { ...desktop, beforeLoad: 'Storage.prototype.setItem = () => { throw new DOMException("Full", "QuotaExceededError"); };' }, async (page) => {
  await page.click('.tour-card [data-use-tour]');
  check('Storage failure keeps the working plan in memory', await page.evaluate('document.querySelectorAll(".timeline-stop").length === 5'));
  check('Storage failure never falsely reports auto-save success', await page.evaluate('document.querySelector("#storage-status").textContent.includes("Not saved") && document.querySelector("#plan-status").textContent.includes("Could not save")'));
  await page.click('#library-link');
  await page.fill('#plan-name', 'Keep this draft');
  await page.click('#save-plan button[type=submit]');
  check('Library storage failure preserves the entered name', await page.evaluate('document.querySelector("#plan-name").value === "Keep this draft" && document.querySelector("#plan-status").textContent.includes("Could not update")'));
  check('Storage failures are handled without runtime errors', page.errors().exceptions.length === 0);
});

summary();
