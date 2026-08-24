import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withStatementTimeout } from "./dbConnectionUrl.js";

const BASE = "postgresql://user:pass@host:5432/db";

describe("withStatementTimeout", () => {
  it("adds the statement_timeout to the connection options", () => {
    const url = new URL(withStatementTimeout(BASE, 30_000));
    assert.equal(url.searchParams.get("options"), "-c statement_timeout=30000");
  });

  it("preserves existing options while appending the timeout", () => {
    const url = new URL(withStatementTimeout(`${BASE}?options=-c geqo%3Doff`, 30_000));
    assert.equal(url.searchParams.get("options"), "-c geqo=off -c statement_timeout=30000");
  });

  it("leaves an operator's own statement_timeout untouched", () => {
    const withOwn = `${BASE}?options=-c statement_timeout%3D5000`;
    assert.equal(withStatementTimeout(withOwn, 30_000), withOwn);
  });

  it("preserves other query params (schema, sslmode)", () => {
    const url = new URL(withStatementTimeout(`${BASE}?schema=public&sslmode=require`, 30_000));
    assert.equal(url.searchParams.get("schema"), "public");
    assert.equal(url.searchParams.get("sslmode"), "require");
    assert.equal(url.searchParams.get("options"), "-c statement_timeout=30000");
  });

  it("is a no-op when disabled with 0", () => {
    assert.equal(withStatementTimeout(BASE, 0), BASE);
  });

  it("fails open on a connection string the WHATWG URL parser rejects", () => {
    // Cloud SQL's Unix-socket form: valid for Postgres, unparseable as a WHATWG URL.
    const unixSocket = "postgresql://user:pass@/dbname?host=/cloudsql/proj:region:instance";
    assert.doesNotThrow(() => withStatementTimeout(unixSocket, 30_000));
    assert.equal(withStatementTimeout(unixSocket, 30_000), unixSocket);
  });
});
