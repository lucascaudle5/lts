"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { SensitiveCategory, ThemeName } from "@/contracts/common";
import { requireUser } from "@/server/auth";
import { getPreferences } from "@/server/repositories/profiles";
import { runMutations } from "@/server/mutations/runMutations";

const SensitiveCategories = z.array(SensitiveCategory).max(SensitiveCategory.options.length);

export async function saveAiCategorySettingsAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const categories = SensitiveCategories.parse(formData.getAll("category"));
  await runMutations(user.userId, { origin: "manual", sensitiveCategories: categories });
  revalidatePath("/settings");
}

/** Saves the display theme through `profile.save`, keeping the timezone and authority as they are. */
export async function saveThemeAction(input: unknown): Promise<{ ok: boolean; message: string }> {
  const theme = ThemeName.safeParse(input);
  if (!theme.success) return { ok: false, message: "Pick Sandstone, Blueprint or Dark." };
  const user = await requireUser();
  const preferences = await getPreferences(user.userId);
  try {
    await runMutations(user.userId, {
      origin: "manual",
      timezone: user.timezone,
      workspace: [
        {
          op: "profile.save",
          timezone: user.timezone,
          authority: preferences?.authority === "allow_explicit" ? "allow_explicit" : "ask",
          theme: theme.data,
        },
      ],
    });
  } catch {
    console.error("Theme save failed");
    return { ok: false, message: "Saved on this device only. Your account couldn't be reached." };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved to your account." };
}
