import { getRooms, addRoom } from "@/lib/db";

export async function GET() {
  const rooms = await getRooms();
  return Response.json(rooms);
}

export async function POST(request: Request) {
  const { id } = await request.json();
  await addRoom(id);
  return Response.json({ ok: true });
}
