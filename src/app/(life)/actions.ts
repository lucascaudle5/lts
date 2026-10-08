"use server";

import { revalidatePath } from "next/cache";
import { DomainCommand } from "@/contracts/commands";
import { WorkspaceOperation } from "@/contracts/life";
import { requireUser } from "@/server/auth";
import { runMutations } from "@/server/mutations/runMutations";
import { z } from "zod";

export async function workspaceAction(input: unknown): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  if (Array.isArray(input)) {
    const batch = z.array(WorkspaceOperation).min(1).max(500).safeParse(input);
    if (!batch.success) return { ok: false, message: "Check all imported blocks before saving" };
    try {
      await runMutations(user.userId, {
        origin: "manual",
        timezone: user.timezone,
        workspace: batch.data,
      });
      revalidatePath("/", "layout");
      return { ok: true, message: `Saved ${batch.data.length} changes` };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error && error.message.length < 300
            ? error.message
            : "The import could not complete; no changes were saved",
      };
    }
  }
  const operation = WorkspaceOperation.safeParse(input);
  const command = DomainCommand.safeParse(input);
  if (!operation.success && !command.success) {
    const errors = operation.error?.issues ?? command.error?.issues ?? [];
    return {
      ok: false,
      message:
        errors
          .slice(0, 3)
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join("; ") || "Check the fields and try again",
    };
  }
  try {
    await runMutations(
      user.userId,
      operation.success
        ? { origin: "manual", timezone: user.timezone, workspace: [operation.data] }
        : { origin: "manual", timezone: user.timezone, commands: [{ command: command.data! }] },
    );
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: operation.success && operation.data.op === "undo" ? "Change undone" : "Saved",
    };
  } catch (error) {
    // Expected domain errors are actionable; database diagnostics never include user-facing details.
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Failed query:") || message.length > 300) {
      console.error("Workspace save failed");
      return { ok: false, message: "The save could not complete. Refresh and try again." };
    }
    return { ok: false, message: message || "The save could not complete" };
  }
}
