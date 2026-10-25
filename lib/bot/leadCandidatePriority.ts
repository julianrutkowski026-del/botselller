type ContactLookup = {
  email?: string | null;
  source?: string | null;
} | null | undefined;

/**
 * Keep the most actionable candidates at the front of a bounded search cycle.
 * Places returns many businesses without public email addresses; evaluating
 * those first can consume the time budget before an emailable club reaches AI.
 */
export function prioritizeLeadCandidates<T>(
  candidates: readonly T[],
  options: {
    isTarget: (candidate: T) => boolean;
    contact: (candidate: T) => ContactLookup;
  },
): T[] {
  return candidates
    .map((candidate, index) => ({
      candidate,
      index,
      isTarget: options.isTarget(candidate),
      contact: options.contact(candidate),
    }))
    .sort((left, right) => {
      const targetOrder = Number(right.isTarget) - Number(left.isTarget);
      if (targetOrder) return targetOrder;

      const emailOrder = Number(Boolean(right.contact?.email)) - Number(Boolean(left.contact?.email));
      if (emailOrder) return emailOrder;

      const sourceOrder = Number(right.contact?.source === "website") - Number(left.contact?.source === "website");
      if (sourceOrder) return sourceOrder;

      return left.index - right.index;
    })
    .map(({ candidate }) => candidate);
}
