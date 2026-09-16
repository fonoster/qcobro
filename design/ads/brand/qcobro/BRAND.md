# QCobro brand layer

Applies the framework (`../../framework/`) to QCobro. Direction and its reasoning:
`../../DIRECTION.md`. Visual source of truth: website v3 ("Todo a la vista") in the main
`pencil.pen` (site v3 frames `SRget` / `qAkg8`, record component `Site3/Gestion Record`).

## Tokens

The `brand-*` variables in `ads.pen` mirror the `site3-*` variables in `pencil.pen`. If the site
tokens change, update these to match.

| Token                            | Value                             | Use                                                             |
| :------------------------------- | :-------------------------------- | :-------------------------------------------------------------- |
| `brand-paper`                    | `#F6F4EE`                         | Default ad background                                           |
| `brand-surface`                  | `#FFFFFF`                         | Cards, the record                                               |
| `brand-ink` / `-2` / `-3`        | `#15181B` / `#50565C` / `#868B90` | Headline / sub and call-out / tertiary                          |
| `brand-rule`                     | `#DDD8CC`                         | Hairlines                                                       |
| `brand-accent` / `-soft`         | `#047857` / `#E3F1EA`             | **"Verified" marks only**: checks, one highlighted word at most |
| `brand-night` / `brand-on-night` | `#111513` / `#F2F0EA`             | Optional dark variant                                           |
| `brand-font-display`             | Newsreader                        | Headline                                                        |
| `brand-font-sans`                | Inter                             | Sub, UI, wordmark placeholder                                   |
| `brand-font-mono`                | IBM Plex Mono                     | Call-out, record labels                                         |

Green is never a full-bleed fill.

## Components (`ads.pen`, section 04)

| Component              | What it is                                                                                              | Notes                                                                                                         |
| :--------------------- | :------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------ |
| `Brand/Gestion Record` | The v3 gestión record at 2.4×: header, audio, transcript, Entrega → Camino → Resultado, evidence footer | Hide rows per canvas with instance overrides (`enabled:false`). Transcript is anonymized: "José", no amounts. |

Open item: the wordmark slot uses the text "QCobro" as a stand-in. Replace it with the outlined
wordmark from the website v3 brand kit (`site/assets/brand/`) once that work is merged.

## Voice

- **Spanish, usted.** The reader is a business owner or manager.
- **Call-out:** `PARA FINANCIERAS Y EQUIPOS DE COBRO` (mono, tracked). Names the role, never the
  person's situation.
- **Headlines:** short, factual, one idea. Period at the end.
- **Never speak to debtors.** Debtors appear only as the lender's client, in the third person,
  or inside an anonymized product demo.
- **Forbidden hooks:** anything that asks about or implies the viewer's debt or finances
  ("¿Debes…?", "¿Tienes deudas?", "¿Atrasado con…?").

## Approved claims (facts only)

| Claim                                      | Wording in use                                                            |
| :----------------------------------------- | :------------------------------------------------------------------------ |
| Free pilot                                 | "Gratis", "Piloto gratis"                                                 |
| 15 days, 300 accounts                      | "15 días. 300 cuentas."                                                   |
| Recovery report at the end                 | "Al final, un reporte de lo que se recuperó." / "Reporte de recuperación" |
| Every call recorded, transcribed, resolved | "Cada llamada, a la vista.", "Todo queda registrado."                     |
| Public prices                              | (use exact published prices only)                                         |
| 6 channels                                 | SMS, WhatsApp, Email, pre-recorded voice, Voz IA, Human                   |

**Not on ads:** testimonials, recovery-rate or performance numbers, the Mikro quote, Credifácil by
name, GitHub/community stats, "datos en RD" (not true).

## Campaign defaults

| Setting             | Value                                                                                                                                                                                        |
| :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Destination         | Pilot landing page on the site                                                                                                                                                               |
| Conversion event    | Pixel `Lead`: live since #185 on the current demo-request form (`content_name: 'demo-request'`). The website v3 pilot form must fire `Lead` too, or campaigns lose their optimization event. |
| Geo                 | Dominican Republic only                                                                                                                                                                      |
| Targeting           | Broad; creative self-selects                                                                                                                                                                 |
| Special ad category | None (B2B software). Valid only while geo stays DR-only and copy stays B2B                                                                                                                   |
| AI disclosure       | **Disclose** on the call Reel (the Voz IA agent voice is synthetic); disclose on any ad using an AI-generated photo (e.g., the colmado portrait)                                             |

## Round 1 example applications (`ads.pen`, section 04 · Examples)

Illustrative layouts. The copy follows this file, but Pedro approves each ad before it's created.

| Name                                               | Canvas        | Angle      | Content                                                                                                                                     |
| :------------------------------------------------- | :------------ | :--------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| `qcobro_pilot_r1__feed-4x5`                        | feed-4x5      | Pilot      | "15 días. 300 cuentas. Gratis." + record (header and outcome rows)                                                                          |
| `qcobro_pilot_r1__vertical-9x16`                   | vertical-9x16 | Pilot      | Same idea, vertical                                                                                                                         |
| `qcobro_alavista_r1__feed-4x5`                     | feed-4x5      | A la vista | "Cada llamada, a la vista." + record (transcript and outcome rows)                                                                          |
| `qcobro_alavista_r1__vertical-9x16`                | vertical-9x16 | A la vista | Same idea, vertical                                                                                                                         |
| `qcobro_callreel_r1__video-9x16__{0–2,2–12,12–15}` | video-9x16    | Call Reel  | Hook "Escuche a nuestra IA cobrar." → "Todo queda registrado." → pilot facts. Needs the edit (real call audio, animated waveform, captions) |
