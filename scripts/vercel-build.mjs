import { spawnSync } from "node:child_process";

// Migrations run inside the hosted build, where non-exportable Vercel Secrets are available.
// Verify both Auth and Postgres belong to the environment's project before any database write.
const environment = process.env.VERCEL_ENV;
const projects = { preview: "aiioatnjffphxygqmiap", production: "kcnsibqyloxuuvsoofta" };
if (environment in projects) {
  const expected = projects[environment];
  const authUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  const databaseUrl = new URL(process.env.POSTGRES_URL_NON_POOLING ?? "");
  if (
    authUrl.hostname !== `${expected}.supabase.co` ||
    !(
      databaseUrl.username.endsWith(`.${expected}`) ||
      databaseUrl.hostname === `db.${expected}.supabase.co`
    )
  ) {
    throw new Error(
      `The ${environment} database does not match its Supabase Auth project. Fix the environment connection before deploying.`,
    );
  }
  console.log(`Applying migrations to the ${environment} Supabase project ${expected}`);
  const migration = spawnSync("pnpm", ["db:migrate"], { stdio: "inherit" });
  if (migration.status !== 0) process.exit(migration.status ?? 1);
}
const build = spawnSync("pnpm", ["build"], { stdio: "inherit" });
process.exit(build.status ?? 1);
