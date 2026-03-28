import { deleteRoom } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteRoom(id);
    return Response.json({ ok: true });
  } catch (e: any) {
    console.error("[API /rooms/[id] DELETE]", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
