import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateSmsSegments, normalizeForGsm7 } from "./smsSegments.js";

const repeat = (char: string, n: number) => char.repeat(n);

describe("calculateSmsSegments — encoding detection", () => {
  it("treats plain ASCII as GSM-7", () => {
    const r = calculateSmsSegments("Hola Jose, su saldo es 9,500.");

    assert.equal(r.encoding, "GSM-7");
    assert.deepEqual(r.nonGsmCharacters, []);
  });

  it("keeps the Spanish characters that GSM-7 already covers at 7 bits", () => {
    // The usual assumption is that any accent costs extra. These do not.
    const r = calculateSmsSegments("José, año, ¿cuando? ¡Hola! Müller Ñ § £ ¥ à è ì ò ù ß É Ä Ö");

    assert.equal(r.encoding, "GSM-7", "é ñ ü ¿ ¡ § £ ¥ à è ì ò ù ß are all in the basic set");
  });

  it("falls to UCS-2 on the Spanish vowels GSM-7 omits", () => {
    for (const word of ["García", "Martínez", "Rodríguez", "Muñóz", "Curaçao"]) {
      assert.equal(calculateSmsSegments(word).encoding, "UCS-2", word);
    }
  });

  it("names the characters that forced UCS-2, deduplicated and capped", () => {
    const r = calculateSmsSegments("María Martínez Rodríguez");

    assert.equal(r.encoding, "UCS-2");
    assert.deepEqual(r.nonGsmCharacters, ["í"]);
    assert.ok(calculateSmsSegments("áéíóúàçü").nonGsmCharacters.length <= 5);
  });
});

describe("calculateSmsSegments — segment boundaries", () => {
  it("fits 160 GSM-7 characters in one segment and 161 in two", () => {
    assert.equal(calculateSmsSegments(repeat("a", 160)).segmentCount, 1);
    assert.equal(calculateSmsSegments(repeat("a", 161)).segmentCount, 2);
  });

  it("drops to 153 per segment once a GSM-7 message is concatenated", () => {
    // 6 bytes of every segment go to the reassembly header: 1072/7 = 153.
    assert.equal(calculateSmsSegments(repeat("a", 161)).charactersPerSegment, 153);
    assert.equal(calculateSmsSegments(repeat("a", 306)).segmentCount, 2);
    assert.equal(calculateSmsSegments(repeat("a", 307)).segmentCount, 3);
  });

  it("fits 70 UCS-2 characters in one segment and 71 in two", () => {
    assert.equal(calculateSmsSegments(repeat("í", 70)).segmentCount, 1);
    assert.equal(calculateSmsSegments(repeat("í", 71)).segmentCount, 2);
  });

  it("drops to 67 per segment once a UCS-2 message is concatenated", () => {
    assert.equal(calculateSmsSegments(repeat("í", 71)).charactersPerSegment, 67);
    assert.equal(calculateSmsSegments(repeat("í", 134)).segmentCount, 2);
    assert.equal(calculateSmsSegments(repeat("í", 135)).segmentCount, 3);
  });

  it("counts an extended GSM-7 character as two", () => {
    // € is reachable only via an escape, so 80 of them exhaust a 160-character segment.
    assert.equal(calculateSmsSegments(repeat("€", 80)).segmentCount, 1);
    assert.equal(calculateSmsSegments(repeat("€", 81)).segmentCount, 2);
    assert.equal(calculateSmsSegments("€").encoding, "GSM-7");
  });

  it("never splits an extended character's two septets across a boundary", () => {
    // 159 plain characters leave 7 bits — not enough for €, so it moves to segment two
    // rather than being cut in half.
    const r = calculateSmsSegments(repeat("a", 159) + "€");

    assert.equal(r.segmentCount, 2);
  });
});

describe("calculateSmsSegments — graphemes", () => {
  it("counts an emoji as one character but bills both its code units", () => {
    const r = calculateSmsSegments("🎉");

    assert.equal(r.characterCount, 1, "one character to a reader");
    assert.equal(r.encoding, "UCS-2");
    // A surrogate pair occupies 32 bits, so 35 emoji fill a 70-character segment.
    assert.equal(calculateSmsSegments(repeat("🎉", 35)).segmentCount, 1);
    assert.equal(calculateSmsSegments(repeat("🎉", 36)).segmentCount, 2);
  });

  it("counts a combined emoji as a single character, not its parts", () => {
    assert.equal(calculateSmsSegments("👍🏽").characterCount, 1);
  });

  it("reports one emoji as the reason a plain message went UCS-2", () => {
    const r = calculateSmsSegments("Gracias por su pago 🎉");

    assert.deepEqual(r.nonGsmCharacters, ["🎉"]);
  });
});

describe("calculateSmsSegments — remaining budget", () => {
  it("reports what is left in the current segment", () => {
    const r = calculateSmsSegments(repeat("a", 100));

    assert.equal(r.segmentCount, 1);
    assert.equal(r.charactersRemaining, 60);
  });

  it("reports remaining against the concatenated budget once past one segment", () => {
    const r = calculateSmsSegments(repeat("a", 200));

    assert.equal(r.segmentCount, 2);
    assert.equal(r.charactersPerSegment, 153);
    assert.equal(r.charactersRemaining, 106, "306 - 200");
  });

  it("reports an empty body as costing nothing", () => {
    const r = calculateSmsSegments("");

    assert.equal(r.segmentCount, 0);
    assert.equal(r.characterCount, 0);
    assert.equal(r.charactersRemaining, 160);
  });
});

describe("normalizeForGsm7", () => {
  it("substitutes only the vowels and cedilla GSM-7 omits", () => {
    assert.equal(normalizeForGsm7("García Martínez Rodríguez"), "Garcia Martinez Rodriguez");
    assert.equal(normalizeForGsm7("ÁÍÓÚ áíóú ç"), "AIOU aiou c");
  });

  it("brings a message back to GSM-7", () => {
    const body = "Estimada María, su saldo está vencido.";

    assert.equal(calculateSmsSegments(body).encoding, "UCS-2");
    assert.equal(calculateSmsSegments(normalizeForGsm7(body)).encoding, "GSM-7");
  });

  it("leaves characters that are already free untouched", () => {
    // ñ→n would turn "año" into something vulgar; é, ü, ¿, ¡, Ç cost nothing to begin with.
    assert.equal(
      normalizeForGsm7("El año pasado José preguntó: ¿cuánto? ¡Müller! Ç"),
      "El año pasado José pregunto: ¿cuanto? ¡Müller! Ç"
    );
    assert.equal(normalizeForGsm7("año"), "año");
    assert.equal(normalizeForGsm7("José"), "José");
    assert.equal(normalizeForGsm7("Müller"), "Müller");
    assert.equal(normalizeForGsm7("¿Sí?"), "¿Si?");
  });

  it("leaves an emoji in place rather than deleting the operator's copy", () => {
    assert.equal(normalizeForGsm7("Gracias 🎉"), "Gracias 🎉");
    assert.equal(calculateSmsSegments(normalizeForGsm7("Gracias 🎉")).encoding, "UCS-2");
  });

  it("is a no-op on text that is already GSM-7", () => {
    const body = "Hola, su saldo es 9,500.";

    assert.equal(normalizeForGsm7(body), body);
  });
});
