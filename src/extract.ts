import type { Decision } from './types.js';

export interface ExtractedAmount {
  amount: number;
  currency: string;
}

/** Fields handled explicitly by extractAmount (skip in generic extra-fields display) */
export const handledAmountFields = new Set([
  'fek',
  'amountWithVAT',
  'amountWithKae',
  'sponsor',
  'awardAmount',
  'estimatedAmount',
]);

/**
 * Extract financial amount from type-specific extra field structures.
 * Sniffs fields in priority order to work across all decision types:
 *   1. amountWithVAT  (Β.1.3 budget commitment)
 *   2. sponsor[].expenseAmount  (Β.2.2 / Β.2.1 payments — summed)
 *   3. awardAmount  (Δ.1 contract award)
 *   4. estimatedAmount  (Δ.2.1 tender)
 */
export function extractAmount(extra: Record<string, unknown>): ExtractedAmount | null {
  // Β.1.3 — Budget commitment
  const amountWithVAT = extra.amountWithVAT as { amount?: number; currency?: string } | undefined;
  if (amountWithVAT && typeof amountWithVAT.amount === 'number') {
    return { amount: amountWithVAT.amount, currency: amountWithVAT.currency ?? 'EUR' };
  }

  // Β.2.2 / Β.2.1 — Payments (sum all sponsor expense amounts)
  const sponsor = extra.sponsor as Array<{ expenseAmount?: { amount?: number; currency?: string } }> | undefined;
  if (Array.isArray(sponsor) && sponsor.length > 0) {
    let total = 0;
    let currency = 'EUR';
    let found = false;
    for (const s of sponsor) {
      if (s.expenseAmount && typeof s.expenseAmount.amount === 'number') {
        total += s.expenseAmount.amount;
        currency = s.expenseAmount.currency ?? currency;
        found = true;
      }
    }
    if (found) return { amount: total, currency };
  }

  // Δ.1 — Contract award
  const awardAmount = extra.awardAmount as { amount?: number; currency?: string } | undefined;
  if (awardAmount && typeof awardAmount.amount === 'number') {
    return { amount: awardAmount.amount, currency: awardAmount.currency ?? 'EUR' };
  }

  // Δ.2.1 — Tender
  const estimatedAmount = extra.estimatedAmount as { amount?: number; currency?: string } | undefined;
  if (estimatedAmount && typeof estimatedAmount.amount === 'number') {
    return { amount: estimatedAmount.amount, currency: estimatedAmount.currency ?? 'EUR' };
  }

  return null;
}

/**
 * Enrich a decision with pre-computed fields under the `_extracted` namespace.
 * The original decision fields are preserved; `_extracted` is additive.
 */
export function enrichDecision(d: Decision): Decision & { _extracted: { amount: ExtractedAmount | null } } {
  return {
    ...d,
    _extracted: {
      amount: extractAmount(d.extraFieldValues ?? {}),
    },
  };
}
