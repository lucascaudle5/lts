import { describe, expect, it } from "vitest";

import { isLocalDatabaseUrl } from "./seed";

describe("isLocalDatabaseUrl", () => {
  it.each([
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    "postgres://postgres:postgres@localhost:5432/postgres",
    "postgresql://postgres@[::1]:5432/postgres",
  ])("allows %s", (url) => {
    expect(isLocalDatabaseUrl(url)).toBe(true);
  });

  it.each([
    "postgresql://postgres.abc:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
    "postgresql://postgres:pw@db.abcdefgh.supabase.co:5432/postgres",
    "postgresql://postgres:pw@localhost.evil.com:5432/postgres",
    "postgresql://postgres:pw@10.0.0.5:5432/postgres",
    "not a url",
    "",
  ])("refuses %s", (url) => {
    expect(isLocalDatabaseUrl(url)).toBe(false);
  });
});
