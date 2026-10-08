"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { SensitiveCategory } from "@/contracts/common";
import { requireUser } from "@/server/auth";
import { runMutations } from "@/server/mutations/runMutations";

const SensitiveCategories = z.array(SensitiveCategory).max(SensitiveCategory.options.length);

export async function saveAiCategorySettingsAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const categories = SensitiveCategories.parse(formData.getAll("category"));
  await runMutations(user.userId, { origin: "manual", sensitiveCategories: categories });
  revalidatePath("/settings");
}
