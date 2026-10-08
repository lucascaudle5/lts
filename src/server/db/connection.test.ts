import { describe, expect, it } from "vitest";

import { cleanDatabaseUrl } from "./connection";

describe("cleanDatabaseUrl", () => {
  it.each([
    [
      "Marketplace pooled URL",
      "postgres://postgres.abcd:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x",
      "postgres://postgres.abcd:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require",
    ],
    [
      "hosted URL without sslmode",
      "postgresql://postgres:pw@db.abcd.supabase.co:5432/postgres",
      "postgresql://postgres:pw@db.abcd.supabase.co:5432/postgres?sslmode=require",
    ],
    [
      "explicit sslmode is kept",
      "postgresql://postgres:pw@db.abcd.supabase.co:5432/postgres?sslmode=verify-full",
      "postgresql://postgres:pw@db.abcd.supabase.co:5432/postgres?sslmode=verify-full",
    ],
    [
      "percent-encoded password survives",
      "postgresql://postgres:p%40ss%23word@db.abcd.supabase.co:5432/postgres",
      "postgresql://postgres:p%40ss%23word@db.abcd.supabase.co:5432/postgres?sslmode=require",
    ],
    [
      "local URL stays plain",
      "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    ],
    ["unparseable input is returned as is", "not a url", "not a url"],
  ])("%s", (_label, input, expected) => {
    expect(cleanDatabaseUrl(input)).toBe(expected);
  });
});
