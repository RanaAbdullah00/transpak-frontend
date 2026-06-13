import { getActionLabelKey } from './stateNormalizationEngine.js';

/** @deprecated Use getNextAllowedActions() from stateNormalizationEngine.js */
export function advanceStatusLabelKey(nextStatus) {
  return getActionLabelKey(nextStatus);
}
