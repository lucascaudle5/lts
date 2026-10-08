import { requireUser } from "@/server/auth";
import { exportUserData } from "@/server/repositories/life";

export async function GET() {
  const user = await requireUser();
  return Response.json(await exportUserData(user.userId), {
    headers: {
      "Content-Disposition": 'attachment; filename="nova-lts-backup.json"',
      "Cache-Control": "no-store",
    },
  });
}
