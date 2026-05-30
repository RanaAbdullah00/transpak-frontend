/** UI uses metric tons; backend/DB store kilograms. */

export const KG_PER_TON = 1000;

export function tonsToKg(tons) {
  const n = Number(tons);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n * KG_PER_TON;
}

export function kgToTons(kg) {
  const n = Number(kg);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n / KG_PER_TON;
}

export function formatTons(kgOrTons, { fromKg = true, digits = 1 } = {}) {
  const tons = fromKg ? kgToTons(kgOrTons) : Number(kgOrTons);
  if (!Number.isFinite(tons)) return '0';
  return tons.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  });
}

/** Backend stores rate per kg; UI shows rate per ton. */
export function ratePerKgToTon(ratePerKg) {
  const n = Number(ratePerKg);
  if (!Number.isFinite(n)) return 0;
  return n * KG_PER_TON;
}

export function ratePerTonToKg(ratePerTon) {
  const n = Number(ratePerTon);
  if (!Number.isFinite(n)) return 0;
  return n / KG_PER_TON;
}
