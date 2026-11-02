/**
 * Minimum-needs estimation for a shelter population (Stage D), in the spirit of
 * InaSAFE's minimum-needs reports and the Sphere Handbook standards.
 *
 * These are planning estimates from published humanitarian standards — NOT a
 * logistics guarantee. Every rate is stated so a coordinator can adjust:
 *   water    15 litres per person per day (Sphere: basic drinking + hygiene)
 *   food     1 ration kit per person per day (kit = ~2,100 kcal daily ration)
 *   blankets 1 per person (one-time, cold/night protection)
 *   hygiene  1 kit per household of 4, refreshed weekly
 */
export interface MinimumNeeds {
  people: number;
  days: number;
  items: {
    key: string;
    label: string;
    unit: string;
    perDay: number | null;
    oneTime: number | null;
    totalForPeriod: number;
    basis: string;
  }[];
  assumptions: string[];
}

export function minimumNeeds(people: number, days: number): MinimumNeeds {
  const households = Math.ceil(people / 4);
  const waterPerDay = people * 15;
  const foodPerDay = people;
  const hygieneTotal = households * Math.max(1, Math.ceil(days / 7));
  return {
    people,
    days,
    items: [
      { key: "water", label: "Drinking water", unit: "litres", perDay: waterPerDay, oneTime: null, totalForPeriod: waterPerDay * days, basis: "15 L per person per day (Sphere)" },
      { key: "food", label: "Food ration kits", unit: "kits", perDay: foodPerDay, oneTime: null, totalForPeriod: foodPerDay * days, basis: "1 kit (≈2,100 kcal) per person per day" },
      { key: "blankets", label: "Blankets", unit: "pieces", perDay: null, oneTime: people, totalForPeriod: people, basis: "1 per person, one-time" },
      { key: "hygiene", label: "Hygiene kits", unit: "kits", perDay: null, oneTime: households, totalForPeriod: hygieneTotal, basis: "1 kit per household of 4, refreshed weekly" },
    ],
    assumptions: [
      "Rates are Sphere/InaSAFE-style planning standards, not a supply guarantee.",
      "A household is assumed to be 4 people.",
      "Medical, infant and dietary-specific needs are not estimated here.",
    ],
  };
}
