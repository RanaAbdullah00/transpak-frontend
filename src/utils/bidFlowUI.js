import {
  CONTRACT_PHASE,
  deriveContractPhase,
  getContractUIColor,
  getContractUILabelKey
} from './contractStateEngine.js';

/**
 * Frontend-only bid negotiation UI (does not imply an active contract).
 */
export function getBidFlowUIState(bid = {}) {
  const phase = deriveContractPhase({ bid, bidStatus: bid?.status });
  return {
    phase: phase === CONTRACT_PHASE.NEGOTIATED ? 'negotiation_pending' : phase,
    colorVariant: getContractUIColor(phase, bid?.status),
    labelKey: getContractUILabelKey(phase, bid?.status)
  };
}

export function isNegotiationPendingBid(bid) {
  return deriveContractPhase({ bid, bidStatus: bid?.status }) === CONTRACT_PHASE.NEGOTIATED;
}
