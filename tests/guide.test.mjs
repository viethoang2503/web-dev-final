/** Kiểm tra ngắn luồng demo: món ăn, quán, tour và lịch nhiều ngày. */
import { withPage, check, summary } from './helpers/browser.mjs';

const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');

await withPage(base + '/', { width: 1440, height: 900, settleMs: 350 }, async (page) => {
  check('Home has four hero photos', await page.evaluate('document.querySelectorAll(".home-collage img").length') === 4);
  check('Home shows three suggested tours', await page.evaluate('document.querySelectorAll(".home-tour").length') === 3);
  check('Home has no sign-in or sign-out control', await page.evaluate('!document.querySelector("[data-role=auth-sign-in], [data-action=logout]")'));
  check('Home has no script errors', page.errors().exceptions.length === 0 && page.errors().console.length === 0);
});

await withPage(base + '/food.html', { width: 1440, height: 900, settleMs: 450 }, async (page) => {
  check('Ten dishes are loaded', await page.evaluate('document.querySelectorAll(".food-list .guide-card").length') === 10);
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
  await page.click('#add-food button[type=submit]');
  await page.click('#add-place button[type=submit]');
  check('Manual food and place are stored on day three', await page.evaluate('JSON.parse(localStorage.getItem("hanoi-local-trip-v2")).days[2].stops.length === 2'));
  check('Day three displays both stops with times', await page.evaluate('document.querySelectorAll(".timeline-stop time").length === 2'));
  check('Plan has no script errors', page.errors().exceptions.length === 0 && page.errors().console.length === 0);
});

await withPage(base + '/plan.html?tour=slow-day', { width: 1440, height: 900, settleMs: 450 }, async (page) => {
  check('Home tour link fills an empty first day', await page.evaluate('JSON.parse(localStorage.getItem("hanoi-local-trip-v2")).days[0].stops.length === 4'));
});

await withPage(base + '/plan.html', { width: 1024, height: 768, settleMs: 450 }, async (page) => {
  check('Plan fits a small desktop', await page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth'));
});

summary();
