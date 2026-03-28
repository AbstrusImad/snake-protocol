import { getRooms, addRoom } from "@/lib/db";

export async function GET() {
  try {
    const rooms = await getRooms();
    return Response.json(rooms);
  } catch (e: any) {
    console.error("[API /rooms GET]", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { id } = await request.json();
    await addRoom(id);
    return Response.json({ ok: true });
  } catch (e: any) {
    console.error("[API /rooms POST]", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
