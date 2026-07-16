import { phone } from "phone";

/**
 * Normalizes a phone number to E.164 (e.g. "+18091234567"), accepting input with or
 * without a leading `+`. Returns null instead of throwing when the number isn't a valid
 * international number — callers may be comparing against untrusted webhook input, where
 * "doesn't parse" should mean "no match," not a crash.
 *
 * Ported from mikro's `validatePhone` (mods/common/src/utils/validatePhone.ts), which
 * throws a ValidationError instead; that stricter variant belongs at input boundaries
 * (e.g. account import) and isn't needed here yet.
 */
export function normalizePhoneE164(input: string): string | null {
  const candidate = input.startsWith("+") ? input : `+${input}`;
  const result = phone(candidate);
  return result.isValid ? result.phoneNumber : null;
}
