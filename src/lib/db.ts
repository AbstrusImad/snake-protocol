import { Pool } from "pg";

// Node.js resolves "localhost" as IPv6 (::1) on some systems.
// We force IPv4 by replacing localhost with 127.0.0.1 internally.
function getConnectionString() {
  const url = process.env.DATABASE_URL ?? "";
  return url.replace("localhost", "127.0.0.1");
}

const pool = new Pool({ connectionString: getConnectionString() });

export async function query(text: string, params?: unknown[]) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export async function initRoomsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS pvp_rooms (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function getRooms() {
  await initRoomsTable();
  const res = await query(
    `SELECT id, created_at FROM pvp_rooms WHERE created_at > NOW() - INTERVAL '5 minutes' ORDER BY created_at DESC`
  );
  return res.rows;
}

export async function addRoom(id: string) {
  await initRoomsTable();
  await query(`INSERT INTO pvp_rooms (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`, [id]);
}

export async function deleteRoom(id: string) {
  await query(`DELETE FROM pvp_rooms WHERE id = $1`, [id]);
}
