import { deleteRoom } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteRoom(id);
  return Response.json({ ok: true });
}
