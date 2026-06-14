/**
 * Phase 6 — backend sequenceId authority for client tracking updates.
 */
export function createSequenceAuthorityGate() {
  let lastSequenceId = 0;

  return {
    accept(payload) {
      const seq = Number(payload?.sequenceId ?? payload?.sequence_id ?? 0);
      if (!seq) return true;
      if (seq <= lastSequenceId) return false;
      lastSequenceId = seq;
      return true;
    },
    getLastSequenceId() {
      return lastSequenceId;
    },
    reset() {
      lastSequenceId = 0;
    }
  };
}
