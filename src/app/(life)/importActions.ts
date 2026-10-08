"use server";

import { revalidatePath } from "next/cache";
import { UserBackup } from "@/contracts/life";
import { requireUser } from "@/server/auth";
import { runMutations } from "@/server/mutations/runMutations";

export async function importWorkspaceAction(value: unknown) {
  const user = await requireUser();
  const backup = UserBackup.safeParse(value);
  if (!backup.success)
    return {
      ok: false,
      message: backup.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; "),
    };
  try {
    const result = await runMutations(user.userId, {
      origin: "manual",
      importBackup: backup.data,
      timezone: user.timezone,
    });
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: `Imported ${result.applied.length} changes. Capture and audit history from the source remain in the backup file.`,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error && error.message.length < 250
          ? error.message
          : "The backup could not be imported; no records were changed",
    };
  }
}
