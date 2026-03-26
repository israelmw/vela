import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;

function getOrCreateDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url || url.length === 0) {
    throw new Error(
      "DATABASE_URL is required to connect to Neon (set in .env.local or Vercel env).",
    );
  }
  const sql = neon(url);
  _db = drizzle(sql, { schema });
  return _db;
}

/**
 * Drizzle database client (Neon serverless HTTP).
 * Lazily connects on first access so Next.js can prerender/import modules without env at build time.
 */
export const db = new Proxy(
  {} as ReturnType<typeof drizzle<typeof schema>>,
  {
    get(_target, prop, receiver) {
      const real = getOrCreateDb();
      const value = Reflect.get(real, prop, receiver);
      return typeof value === "function" ? value.bind(real) : value;
    },
  },
);

export type DB = ReturnType<typeof drizzle<typeof schema>>;
