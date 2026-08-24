import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withConnectionTimeouts } from "./dbConnectionUrl.js";

describe("withConnectionTimeouts", () => {
  it("adds default connect_timeout and socket_timeout when absent", () => {
    const result = withConnectionTimeouts("postgresql://user:pass@host:5432/db");
    const url = new URL(result);
    assert.equal(url.searchParams.get("connect_timeout"), "10");
    assert.equal(url.searchParams.get("socket_timeout"), "30");
  });

  it("preserves an operator's explicit connect_timeout", () => {
    const result = withConnectionTimeouts("postgresql://user:pass@host:5432/db?connect_timeout=5");
    const url = new URL(result);
    assert.equal(url.searchParams.get("connect_timeout"), "5");
    assert.equal(url.searchParams.get("socket_timeout"), "30");
  });

  it("preserves an operator's explicit socket_timeout", () => {
    const result = withConnectionTimeouts("postgresql://user:pass@host:5432/db?socket_timeout=90");
    const url = new URL(result);
    assert.equal(url.searchParams.get("connect_timeout"), "10");
    assert.equal(url.searchParams.get("socket_timeout"), "90");
  });

  it("preserves other existing query params (e.g. schema, sslmode)", () => {
    const result = withConnectionTimeouts(
      "postgresql://user:pass@host:5432/db?schema=public&sslmode=require"
    );
    const url = new URL(result);
    assert.equal(url.searchParams.get("schema"), "public");
    assert.equal(url.searchParams.get("sslmode"), "require");
    assert.equal(url.searchParams.get("connect_timeout"), "10");
  });

  it("fails open (returns the URL unchanged) rather than throwing on a shape the WHATWG URL parser rejects", () => {
    // The Cloud SQL Unix-socket form: a valid Prisma Postgres connection string, but an
    // empty host that `new URL()` cannot parse.
    const unixSocketUrl = "postgresql://user:pass@/dbname?host=/cloudsql/proj:region:instance";
    assert.doesNotThrow(() => withConnectionTimeouts(unixSocketUrl));
    assert.equal(withConnectionTimeouts(unixSocketUrl), unixSocketUrl);
  });
});
