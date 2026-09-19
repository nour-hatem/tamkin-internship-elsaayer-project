/**
 * Canonical contact-method values.
 * Single source of truth — imported by NluRulesAdapter, KioskService, and
 * any future QueueService integration. Never use string literals elsewhere.
 */
export type ContactMethod = 'SMS' | 'WHATSAPP' | 'ELSAAYER_APP' | 'CALLING_AGENT';

/**
 * Ordered list that mirrors the numbered menu presented to the customer.
 * Index 0 = option "1" as spoken/shown (1-based display, 0-based array).
 *
 * All option-number parsing MUST derive its mapping from this array alone —
 * no magic numbers anywhere in the codebase.
 */
export const CONTACT_METHOD_OPTIONS: readonly ContactMethod[] = [
  'SMS',           // 1
  'WHATSAPP',      // 2
  'ELSAAYER_APP',  // 3
  'CALLING_AGENT', // 4
] as const;
