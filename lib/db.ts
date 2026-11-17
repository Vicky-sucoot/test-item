import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA_SQL } from "./schema";
import { seedDefaults, seedDemo } from "./seed";

const globalForDb = globalThis as unknown as { __db?: Database.Database };

export function dbPath(): string {
  if (process.env.DATABASE_PATH === ":memory:") return ":memory:";
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.DATABASE_PATH || "data/app.db");
}

export function openDb(file = dbPath()): Database.Database {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  const hasTopics = db.prepare("SELECT COUNT(*) n FROM topics").get() as { n: number };
  if (hasTopics.n === 0) {
    db.transaction(() => {
      seedDefaults(db);
      seedDemo(db);
    })();
  }
  return db;
}

export function db(): Database.Database {
  if (!globalForDb.__db) globalForDb.__db = openDb();
  return globalForDb.__db;
}

export function now(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function today(): string {
  return now().slice(0, 10);
}
