const LS_MOCK = 'tp_demo_mock_api';
const LS_GUIDE = 'tp_demo_guide_step';

export function isDemoModeEnabled() {
  const v = import.meta.env.VITE_DEMO_MODE;
  return v === true || String(v).toLowerCase() === 'true';
}

export function isDemoMockApiEnabled() {
  if (!isDemoModeEnabled()) return false;
  try {
    return localStorage.getItem(LS_MOCK) === '1';
  } catch {
    return false;
  }
}

export function setDemoMockApiEnabled(on) {
  try {
    if (on) localStorage.setItem(LS_MOCK, '1');
    else localStorage.removeItem(LS_MOCK);
  } catch {
    /* ignore */
  }
}

export function getDemoGuideStep() {
  try {
    return Number(localStorage.getItem(LS_GUIDE) || 0);
  } catch {
    return 0;
  }
}

export function setDemoGuideStep(n) {
  try {
    localStorage.setItem(LS_GUIDE, String(Math.max(0, Number(n) || 0)));
  } catch {
    /* ignore */
  }
}

export const DEMO_GUIDE_STEPS = [
  { id: 'post', labelKey: 'demo.guidePost' },
  { id: 'carrier', labelKey: 'demo.guideCarrier' },
  { id: 'confirm', labelKey: 'demo.guideConfirm' },
  { id: 'booked', labelKey: 'demo.guideBooked' },
  { id: 'deliver', labelKey: 'demo.guideDeliver' }
];
