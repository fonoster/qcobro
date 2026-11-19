import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ACCESS_TOKEN_SECONDS = 3600;
const REFRESH_TOKEN_SECONDS = 24 * 3600;

const b64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");

/**
 * Issues and checks the fake's JWTs (HS256, signed with a key made at start). The SDK decodes the
 * access token's `exp` before every RPC and refreshes it once expired, so tokens must be real
 * JWTs; nothing outside the fake verifies the signature.
 */
export class Tokens {
  private readonly key = randomBytes(32);

  constructor(private readonly accessKeyId: string) {}

  private sign(payload: Record<string, unknown>): string {
    const head = `${b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64url(JSON.stringify(payload))}`;
    return `${head}.${createHmac("sha256", this.key).update(head).digest("base64url")}`;
  }

  private issue(use: string, seconds: number): string {
    const now = Math.floor(Date.now() / 1000);
    return this.sign({
      iss: "fonoster-fake",
      sub: this.accessKeyId,
      accessKeyId: this.accessKeyId,
      tokenUse: use,
      jti: randomBytes(8).toString("hex"),
      iat: now,
      exp: now + seconds
    });
  }

  session(): { accessToken: string; refreshToken: string; idToken: string } {
    return {
      accessToken: this.issue("access", ACCESS_TOKEN_SECONDS),
      refreshToken: this.issue("refresh", REFRESH_TOKEN_SECONDS),
      idToken: this.issue("id", ACCESS_TOKEN_SECONDS)
    };
  }

  /** True for an unexpired token of this use that the fake signed. */
  verify(token: string | undefined, use: "access" | "refresh"): boolean {
    const [head, body, signature] = (token ?? "").split(".");
    if (!head || !body || !signature) return false;
    const expected = createHmac("sha256", this.key).update(`${head}.${body}`).digest();
    const given = Buffer.from(signature, "base64url");
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;
    try {
      const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
      return payload.tokenUse === use && payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }
}
