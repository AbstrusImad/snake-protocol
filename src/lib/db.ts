import { neon } from "@neondatabase/serverless";

function getSQL() {
  const url = process.env.DATABASE_URL ?? "";
  return neon(url);
}

export async function initRoomsTable() {
  const sql = getSQL();
  await sql`
    CREATE TABLE IF NOT EXISTS pvp_rooms (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function getRooms() {
  await initRoomsTable();
  const sql = getSQL();
  const rows = await sql`
    SELECT id, created_at FROM pvp_rooms
    WHERE created_at > NOW() - INTERVAL '5 minutes'
    ORDER BY created_at DESC
  `;
  return rows;
}

export async function addRoom(id: string) {
  await initRoomsTable();
  const sql = getSQL();
  await sql`INSERT INTO pvp_rooms (id) VALUES (${id}) ON CONFLICT (id) DO NOTHING`;
}

export async function deleteRoom(id: string) {
  const sql = getSQL();
  await sql`DELETE FROM pvp_rooms WHERE id = ${id}`;
}
