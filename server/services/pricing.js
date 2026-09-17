/**
 * pricing.js - the one place that turns a spot into money (DAY-06).
 *
 * Places carry a real admission fee in VND. Food only carries a price level of
 * 1 to 3, because a bowl of pho has no single fixed price. To show one total
 * for a day plan we translate each level into a representative amount.
 *
 * These numbers are the group's own assumption, not data from a source. They
 * are kept here, in one exported table, so the figure shown in My Day can be
 * explained and changed in a single edit.
 *
 * Typical Hanoi prices per person at the time of writing:
 *   level 1  street stall, one dish            ~50,000 VND
 *   level 2  sit-down local restaurant         ~150,000 VND
 *   level 3  speciality restaurant             ~300,000 VND
 */

/** priceLevel -> representative cost per person, in VND. */
export const FOOD_PRICE_ESTIMATE_VND = Object.freeze({
  1: 50_000,
  2: 150_000,
  3: 300_000,
});

/**
 * Estimated cost of one spot for one person, in VND.
 *
 * @param {{ kind: string, priceLevel?: number|null, admission?: number|null }} spot
 * @returns {{ amount: number, exact: boolean }}
 *          exact=true when the number is a real admission fee, false when it
 *          came from the price-level table.
 */
export function estimateSpotCost(spot) {
  if (spot.kind === 'place') {
    return { amount: spot.admission ?? 0, exact: true };
  }

  const amount = FOOD_PRICE_ESTIMATE_VND[spot.priceLevel] ?? 0;
  return { amount, exact: false };
}

/**
 * Totals for a list of spots.
 *
 * @param {object[]} spots
 * @returns {{ stops: number, estimatedCostVnd: number, admissionVnd: number,
 *             foodEstimateVnd: number, hasEstimatedItems: boolean }}
 */
export function estimateTotals(spots) {
  let admissionVnd = 0;
  let foodEstimateVnd = 0;

  for (const spot of spots) {
    const { amount, exact } = estimateSpotCost(spot);
    if (exact) {
      admissionVnd += amount;
    } else {
      foodEstimateVnd += amount;
    }
  }

  return {
    stops: spots.length,
    estimatedCostVnd: admissionVnd + foodEstimateVnd,
    admissionVnd,
    foodEstimateVnd,
    // Lets the UI say "about" instead of pretending the number is precise.
    hasEstimatedItems: foodEstimateVnd > 0,
  };
}
