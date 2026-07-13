import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CliError,
  formatTable,
  main,
  parseCliArgs,
  poolConfig,
  resolveDatabaseUrl,
  type UserRow
} from "./listUsers.js";

describe("parseCliArgs", () => {
  it("defaults everything when no flags are given", () => {
    const opts = parseCliArgs([]);
    assert.equal(opts.databaseUrl, undefined);
    assert.equal(opts.json, false);
    assert.equal(opts.help, false);
  });

  it("parses every flag", () => {
    const opts = parseCliArgs([
      "--database-url",
      "postgresql://user:pass@host:5432/identity",
      "--json"
    ]);
    assert.equal(opts.databaseUrl, "postgresql://user:pass@host:5432/identity");
    assert.equal(opts.json, true);
  });

  it("recognizes --help", () => {
    assert.equal(parseCliArgs(["--help"]).help, true);
  });

  it("throws CliError on an unknown flag", () => {
    assert.throws(() => parseCliArgs(["--bogus"]), CliError);
  });
});

describe("resolveDatabaseUrl", () => {
  it("prefers the flag over the env var", () => {
    const url = resolveDatabaseUrl(
      { databaseUrl: "postgresql://flag" },
      { QCOBRO_IDENTITY_DATABASE_URL: "postgresql://env" }
    );
    assert.equal(url, "postgresql://flag");
  });

  it("falls back to the env var when the flag is absent", () => {
    const url = resolveDatabaseUrl({}, { QCOBRO_IDENTITY_DATABASE_URL: "postgresql://env" });
    assert.equal(url, "postgresql://env");
  });

  it("throws CliError with a clear message when both are missing", () => {
    assert.throws(
      () => resolveDatabaseUrl({}, {}),
      (err: unknown) => {
        assert.ok(err instanceof CliError);
        assert.match((err as Error).message, /QCOBRO_IDENTITY_DATABASE_URL/);
        return true;
      }
    );
  });
});

describe("poolConfig", () => {
  it("leaves the connection string untouched when no sslmode is present", () => {
    const config = poolConfig("postgresql://user:pass@host:5432/identity");
    assert.equal(config.connectionString, "postgresql://user:pass@host:5432/identity");
    assert.equal("ssl" in config, false);
  });

  it("strips sslmode and sets an explicit no-verify ssl override", () => {
    const config = poolConfig("postgresql://user:pass@host:5432/identity?sslmode=require");
    assert.equal(config.connectionString, "postgresql://user:pass@host:5432/identity");
    assert.deepEqual(config.ssl, { rejectUnauthorized: false });
  });

  it("strips sslmode without disturbing other query params", () => {
    const config = poolConfig(
      "postgresql://user:pass@host:5432/identity?sslmode=verify-full&application_name=list-users"
    );
    assert.equal(
      config.connectionString,
      "postgresql://user:pass@host:5432/identity?application_name=list-users"
    );
    assert.deepEqual(config.ssl, { rejectUnauthorized: false });
  });
});

describe("formatTable", () => {
  it("reports when there are no users", () => {
    assert.equal(formatTable([]), "(no users found)");
  });

  it("renders an aligned table with the workspace count right-aligned", () => {
    const users: UserRow[] = [
      {
        ref: "u1",
        email: "ana@example.com",
        name: "Ana",
        createdAt: "2026-01-05T00:00:00.000Z",
        workspaceCount: 2
      },
      {
        ref: "u2",
        email: "bernardo@example.com",
        name: "Bernardo",
        createdAt: "2026-02-10T00:00:00.000Z",
        workspaceCount: 1
      }
    ];
    const table = formatTable(users);
    const lines = table.split("\n");
    assert.match(lines[0], /email\s+name\s+created\s+workspaces/);
    assert.match(lines[1], /ana@example\.com\s+Ana\s+2026-01-05\s+2/);
    assert.match(lines[2], /bernardo@example\.com\s+Bernardo\s+2026-02-10\s+1/);
  });
});

describe("main", () => {
  it("returns 2 and reports the missing database URL without querying", async () => {
    let stubCalled = false;
    let stderrOutput = "";
    const code = await main(
      [],
      {},
      () => {},
      (s) => {
        stderrOutput += s;
      },
      async () => {
        stubCalled = true;
        return [];
      }
    );
    assert.equal(code, 2);
    assert.equal(stubCalled, false);
    assert.match(stderrOutput, /QCOBRO_IDENTITY_DATABASE_URL/);
  });

  it("prints the table from the injected query function", async () => {
    let stdoutOutput = "";
    const code = await main(
      ["--database-url", "postgresql://stub"],
      {},
      (s) => {
        stdoutOutput += s;
      },
      () => {},
      async (databaseUrl) => {
        assert.equal(databaseUrl, "postgresql://stub");
        return [
          {
            ref: "u1",
            email: "carla@example.com",
            name: "Carla",
            createdAt: "2026-03-01T00:00:00.000Z",
            workspaceCount: 3
          }
        ];
      }
    );
    assert.equal(code, 0);
    assert.match(stdoutOutput, /carla@example\.com/);
    assert.match(stdoutOutput, /3/);
  });

  it("prints JSON when --json is passed", async () => {
    let stdoutOutput = "";
    const code = await main(
      ["--database-url", "postgresql://stub", "--json"],
      {},
      (s) => {
        stdoutOutput += s;
      },
      () => {},
      async () => [
        {
          ref: "u1",
          email: "carla@example.com",
          name: "Carla",
          createdAt: "2026-03-01T00:00:00.000Z",
          workspaceCount: 3
        }
      ]
    );
    assert.equal(code, 0);
    const parsed = JSON.parse(stdoutOutput);
    assert.equal(parsed[0].email, "carla@example.com");
  });

  it("returns 2 and reports the error when the query function throws", async () => {
    let stderrOutput = "";
    const code = await main(
      ["--database-url", "postgresql://stub"],
      {},
      () => {},
      (s) => {
        stderrOutput += s;
      },
      async () => {
        throw new Error("connection refused");
      }
    );
    assert.equal(code, 2);
    assert.match(stderrOutput, /connection refused/);
  });
});

describe("entry-point self-invocation guard", () => {
  // npm/npx always launch bins through a node_modules/.bin symlink, so the guard must
  // compare resolved real paths, not raw argv[1]/import.meta.url strings — otherwise
  // main() silently never runs (exit 0, no output). Spawn a real process through a
  // symlink to lock that in; --help exits before any database call.
  const sourcePath = fileURLToPath(new URL("./listUsers.ts", import.meta.url));

  it("runs main() when invoked directly", () => {
    const out = execFileSync(process.execPath, ["--import", "tsx", sourcePath, "--help"], {
      encoding: "utf8"
    });
    assert.match(out, /Usage: list-users/);
  });

  it("runs main() when invoked through a symlink (npm/npx bin layout)", () => {
    const dir = mkdtempSync(join(tmpdir(), "list-users-symlink-"));
    const linkPath = join(dir, "list-users-link.ts");
    try {
      symlinkSync(sourcePath, linkPath);
      const out = execFileSync(process.execPath, ["--import", "tsx", linkPath, "--help"], {
        encoding: "utf8"
      });
      assert.match(out, /Usage: list-users/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
