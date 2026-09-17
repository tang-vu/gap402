import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * SQLite-backed store. Rows are JSON blobs keyed by id; queries filter on
 * indexed columns. The Store interface keeps PostgreSQL pluggable later.
 */

export interface Row {
  id: string;
  kind: string;
  ref: string; // bountyId / parent id for lookups
  data: string; // JSON
  created_at: string;
}

export class Store {
  private db: Database.Database;

  constructor(url = "sqlite:./data/gap402.db") {
    const path = url.replace(/^sqlite:/, "");
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path === ":memory:" ? ":memory:" : path);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rows (
        id TEXT NOT NULL,
        kind TEXT NOT NULL,
        ref TEXT NOT NULL DEFAULT '',
        data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (kind, id)
      );
      CREATE INDEX IF NOT EXISTS idx_rows_kind_ref ON rows(kind, ref);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_rows_sub_url
        ON rows(ref, json_extract(data, '$.canonicalUrl'))
        WHERE kind = 'submission';
      CREATE UNIQUE INDEX IF NOT EXISTS idx_rows_eval_sub
        ON rows(ref, json_extract(data, '$.submissionId'))
        WHERE kind = 'evaluation';
    `);
  }

  put<T extends { id: string }>(kind: string, obj: T, ref = ""): T {
    this.db
      .prepare(
        `INSERT INTO rows (id, kind, ref, data, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (kind, id) DO UPDATE SET data = excluded.data`,
      )
      .run(obj.id, kind, ref, JSON.stringify(obj), new Date().toISOString());
    return obj;
  }

  /** Insert only if absent; throws DuplicateError on conflict. */
  insert<T extends { id: string }>(kind: string, obj: T, ref = ""): T {
    try {
      this.db
        .prepare(
          `INSERT INTO rows (id, kind, ref, data, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(obj.id, kind, ref, JSON.stringify(obj), new Date().toISOString());
      return obj;
    } catch (e) {
      if (String(e).includes("UNIQUE")) {
        throw new DuplicateError(`${kind} already exists`);
      }
      throw e;
    }
  }

  get<T>(kind: string, id: string): T | null {
    const row = this.db
      .prepare(`SELECT data FROM rows WHERE kind = ? AND id = ?`)
      .get(kind, id) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as T) : null;
  }

  list<T>(kind: string, ref?: string): T[] {
    const rows = (
      ref === undefined
        ? this.db
            .prepare(`SELECT data FROM rows WHERE kind = ? ORDER BY created_at`)
            .all(kind)
        : this.db
            .prepare(
              `SELECT data FROM rows WHERE kind = ? AND ref = ? ORDER BY created_at`,
            )
            .all(kind, ref)
    ) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as T);
  }

  /** Find a submission by bounty + canonical URL (dedup check). */
  findSubmissionByUrl<T>(bountyId: string, canonicalUrl: string): T | null {
    const row = this.db
      .prepare(
        `SELECT data FROM rows WHERE kind = 'submission' AND ref = ?
         AND json_extract(data, '$.canonicalUrl') = ?`,
      )
      .get(bountyId, canonicalUrl) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as T) : null;
  }

  close(): void {
    this.db.close();
  }
}

export class DuplicateError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "DuplicateError";
  }
}
