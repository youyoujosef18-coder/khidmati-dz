import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type DbOrTx = DB | Tx;

const globalForDb = globalThis as unknown as { __khidmatiSql?: postgres.Sql; __khidmatiDb?: DB };

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function createDb(): DB {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not configured");
  }
  const client =
    globalForDb.__khidmatiSql ??
    postgres(url, {
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      idle_timeout: 20,
      connect_timeout: 10,
      // Required for transaction-mode poolers (Neon/Supabase pgbouncer)
      prepare: false,
      onnotice: () => {},
    });
  globalForDb.__khidmatiSql = client;
  return drizzle(client, { schema, casing: undefined });
}

export const db: DB = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    if (!globalForDb.__khidmatiDb) globalForDb.__khidmatiDb = createDb();
    return Reflect.get(globalForDb.__khidmatiDb, prop, receiver);
  },
});

export { schema };
