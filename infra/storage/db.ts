import { DATABASE_URL } from "@/core/env";

export const usePostgres = Boolean(DATABASE_URL);

// postgres uses `export = postgres` so we must use require() with verbatimModuleSyntax
// eslint-disable-next-line @typescript-eslint/no-require-imports
const postgres = usePostgres
  ? (require("postgres") as typeof import("postgres"))
  : null;

type SQL = import("postgres").Sql;

const globalWithSQL = globalThis as unknown as { __parleySQL?: SQL };

export function getSQL(): SQL {
  if (!globalWithSQL.__parleySQL) {
    if (!DATABASE_URL) {
      throw new Error("DATABASE_URL is required when Postgres mode is enabled");
    }
    if (!postgres) {
      throw new Error("postgres module is not available");
    }
    globalWithSQL.__parleySQL = postgres(DATABASE_URL);
  }
  return globalWithSQL.__parleySQL;
}
