/**
 * SMS segmentation: how many messages a body will actually be billed as.
 *
 * Segmentation is a GSM/3GPP property, not a provider one, so nothing here names or
 * depends on a carrier or vendor. The algorithm is ported from Twilio's open-source
 * reference calculator (MIT), but only the standard it implements is load-bearing.
 *
 * The familiar 160/153 and 70/67 thresholds are consequences of the real rule, not the
 * rule itself: characters are packed into 140-byte (1120-bit) segments, and a message
 * that needs more than one segment spends 6 bytes (48 bits) of every segment on a header
 * that tells the handset how to reassemble them. Implementing the packing rather than the
 * thresholds is what gets extended characters and emoji right.
 */

/**
 * GSM 03.38 basic set — one septet (7 bits) each.
 *
 * Worth reading before assuming "accents cost extra": `é è ñ Ñ ü ä ö å à ì ò ù ß Ä Ö Ü É
 * § ¡ ¿ £ ¥` are all in here and cost nothing. It is `á í ó ú` (and their capitals, and
 * lowercase `ç`) that are absent — which is why `José` and `año` are free while `García`
 * and `Martínez` push a whole message into 16-bit encoding.
 */
const GSM7_BASIC = new Set(
  (
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
    "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
  ).split("")
);

/** GSM 03.38 extension table — reachable only via an escape, so two septets (14 bits). */
const GSM7_EXTENDED = new Set(["\f", "^", "{", "}", "\\", "[", "~", "]", "|", "€"]);

const BITS_PER_SEGMENT = 1120;
/** User Data Header, present in every segment once a message spans more than one. */
const UDH_BITS = 48;

/**
 * Characters outside GSM-7 that have an unambiguous ASCII equivalent.
 *
 * Deliberately tiny. A blanket Unicode de-accent would also rewrite `ñ`→`n`, turning
 * `año` into something vulgar, and would strip characters that were already free. Every
 * entry here is a character that costs a message its 7-bit encoding and loses nothing
 * meaningful in translation.
 */
const GSM7_SUBSTITUTIONS: Record<string, string> = {
  á: "a",
  í: "i",
  ó: "o",
  ú: "u",
  Á: "A",
  Í: "I",
  Ó: "O",
  Ú: "U",
  ç: "c"
};

export type SmsEncoding = "GSM-7" | "UCS-2";

/** What {@link calculateSmsSegments} reports about a message body. */
export interface SmsSegmentInfo {
  /** `GSM-7` when every character is in the 7-bit alphabet, `UCS-2` otherwise. */
  encoding: SmsEncoding;
  /** Characters as a reader counts them: emoji-aware graphemes, not UTF-16 code units. */
  characterCount: number;
  /** Messages the carrier will bill for. `0` only for an empty body. */
  segmentCount: number;
  /** Budget per segment at this encoding, already accounting for the multi-segment header. */
  charactersPerSegment: number;
  /** How many more standard characters fit before another segment is needed. */
  charactersRemaining: number;
  /**
   * The distinct characters that forced UCS-2, in order of first appearance, capped at a
   * handful. Empty when the body is GSM-7. Lets a caller say *what* is costing the money
   * rather than only that something is.
   */
  nonGsmCharacters: string[];
}

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function graphemesOf(text: string): string[] {
  return Array.from(segmenter.segment(text), (s) => s.segment);
}

/** Greedy pack: a character never straddles a segment boundary, which is what makes an
 *  extended GSM-7 character (14 bits, indivisible) behave correctly at the edge. */
function countSegments(bitSizes: number[], capacity: number): number {
  let segments = 1;
  let used = 0;
  for (const bits of bitSizes) {
    if (used + bits > capacity) {
      segments += 1;
      used = bits;
    } else {
      used += bits;
    }
  }
  return segments;
}

/**
 * Works out how a message body will be encoded and how many segments it will cost.
 *
 * @param text the message body, already rendered — placeholders like `{{firstName}}` are
 *   counted literally, so pass substituted text if you want a realistic answer
 * @returns an {@link SmsSegmentInfo} breakdown
 *
 * @example
 * calculateSmsSegments("Hola Jose, su saldo es 9,500.")
 * // { encoding: "GSM-7", characterCount: 29, segmentCount: 1,
 * //   charactersPerSegment: 160, charactersRemaining: 131, nonGsmCharacters: [] }
 */
export function calculateSmsSegments(text: string): SmsSegmentInfo {
  const graphemes = graphemesOf(text);

  const nonGsm: string[] = [];
  let isGsm7 = true;
  for (const g of graphemes) {
    if (GSM7_BASIC.has(g) || GSM7_EXTENDED.has(g)) continue;
    isGsm7 = false;
    if (nonGsm.length < 5 && !nonGsm.includes(g)) nonGsm.push(g);
  }

  const encoding: SmsEncoding = isGsm7 ? "GSM-7" : "UCS-2";
  const bitsPerChar = isGsm7 ? 7 : 16;

  // UCS-2 bills by 16-bit code unit, so an emoji built from a surrogate pair (and any
  // grapheme cluster) costs every unit it occupies, not one.
  const bitSizes = graphemes.map((g) => (isGsm7 ? (GSM7_EXTENDED.has(g) ? 14 : 7) : g.length * 16));

  if (graphemes.length === 0) {
    return {
      encoding,
      characterCount: 0,
      segmentCount: 0,
      charactersPerSegment: Math.floor(BITS_PER_SEGMENT / bitsPerChar),
      charactersRemaining: Math.floor(BITS_PER_SEGMENT / bitsPerChar),
      nonGsmCharacters: []
    };
  }

  const fitsInOne = countSegments(bitSizes, BITS_PER_SEGMENT) === 1;
  const capacity = fitsInOne ? BITS_PER_SEGMENT : BITS_PER_SEGMENT - UDH_BITS;
  const segmentCount = fitsInOne ? 1 : countSegments(bitSizes, capacity);

  const totalBits = bitSizes.reduce((sum, bits) => sum + bits, 0);
  // Bits left in the final segment, given the earlier ones are full to their capacity.
  const usedInLast = totalBits - capacity * (segmentCount - 1);

  return {
    encoding,
    characterCount: graphemes.length,
    segmentCount,
    charactersPerSegment: Math.floor(capacity / bitsPerChar),
    charactersRemaining: Math.max(0, Math.floor((capacity - usedInLast) / bitsPerChar)),
    nonGsmCharacters: nonGsm
  };
}

/**
 * Substitutes the characters that cost a message its 7-bit encoding for ASCII equivalents,
 * leaving everything else — including everything already in GSM-7 — byte-for-byte alone.
 *
 * Scope is intentionally narrow (see {@link GSM7_SUBSTITUTIONS}): this rewrites what the
 * customer sees, so it may only ever make changes a reader would not notice. It is not a
 * general de-accenter and must not become one.
 *
 * A body can still be UCS-2 after this — an emoji has no ASCII equivalent, so it is left
 * in place rather than silently deleted from someone's copy.
 */
export function normalizeForGsm7(text: string): string {
  let out = "";
  for (const g of graphemesOf(text)) {
    out += GSM7_SUBSTITUTIONS[g] ?? g;
  }
  return out;
}
