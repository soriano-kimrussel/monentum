import * as SQLite from 'expo-sqlite';

import type { DocStore, Where } from './DocStore';

const SCHEMA_VERSION = 1;

/** Offline-first persistence on device. One table of JSON documents per (collection, id). */
export class SqliteStore implements DocStore {
  private constructor(private db: SQLite.SQLiteDatabase) {}

  static async open(name = 'momentum.db'): Promise<SqliteStore> {
    const db = await SQLite.openDatabaseAsync(name);
    await db.execAsync('PRAGMA journal_mode = WAL;');
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if ((row?.user_version ?? 0) < SCHEMA_VERSION) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS docs (
          collection TEXT NOT NULL,
          id TEXT NOT NULL,
          data TEXT NOT NULL,
          PRIMARY KEY (collection, id)
        );
        PRAGMA user_version = ${SCHEMA_VERSION};
      `);
    }
    return new SqliteStore(db);
  }

  async get<T>(collection: string, id: string): Promise<T | null> {
    const row = await this.db.getFirstAsync<{ data: string }>('SELECT data FROM docs WHERE collection = ? AND id = ?', [collection, id]);
    return row ? (JSON.parse(row.data) as T) : null;
  }

  async list<T>(collection: string, where?: Where): Promise<T[]> {
    const clauses = ['collection = ?'];
    const params: (string | number)[] = [collection];
    for (const [field, value] of Object.entries(where ?? {})) {
      // Field names come from code, never from user input; still restrict to identifiers.
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(field)) throw new Error(`Bad field ${field}`);
      clauses.push(`json_extract(data, '$.${field}') = ?`);
      params.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
    }
    const rows = await this.db.getAllAsync<{ data: string }>(`SELECT data FROM docs WHERE ${clauses.join(' AND ')}`, params);
    return rows.map((r) => JSON.parse(r.data) as T);
  }

  async put<T extends object>(collection: string, id: string, doc: T): Promise<void> {
    await this.db.runAsync('INSERT OR REPLACE INTO docs (collection, id, data) VALUES (?, ?, ?)', [collection, id, JSON.stringify(doc)]);
  }

  async remove(collection: string, id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM docs WHERE collection = ? AND id = ?', [collection, id]);
  }

  async transaction<R>(fn: () => Promise<R>): Promise<R> {
    let result!: R;
    await this.db.withTransactionAsync(async () => {
      result = await fn();
    });
    return result;
  }

  async clear(collection?: string): Promise<void> {
    if (collection) await this.db.runAsync('DELETE FROM docs WHERE collection = ?', [collection]);
    else await this.db.runAsync('DELETE FROM docs');
  }
}
