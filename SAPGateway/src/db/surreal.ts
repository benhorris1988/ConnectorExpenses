import { Surreal, StringRecordId } from "surrealdb";

const SURREAL_URL = process.env.SURREAL_URL ?? "ws://127.0.0.1:8000/rpc";
const SURREAL_USER = process.env.SURREAL_USER ?? "root";
const SURREAL_PASS = process.env.SURREAL_PASS ?? "root";

let db: Surreal | null = null;

export async function getDb(): Promise<Surreal> {
  if (db) return db;

  db = new Surreal();
  await db.connect(SURREAL_URL);
  await db.signin({ username: SURREAL_USER, password: SURREAL_PASS });
  await db.use({ namespace: "bifrost", database: "sap" });

  console.log(`[SurrealDB] Connected — ${SURREAL_URL} | ns:bifrost db:sap`);
  return db;
}

export async function upsert<T extends Record<string, unknown>>(
  table: string,
  id: string,
  data: T
): Promise<void> {
  const client = await getDb();
  await client.upsert(new StringRecordId(`${table}:${id}`)).content(data);
}

export async function closeDb(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}
