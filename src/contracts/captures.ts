import { z } from "zod";

export const CaptureText = z
  .string()
  .min(1)
  .max(2000)
  .refine((value) => value.trim().length > 0, "Add a note before reviewing it");
export const CreateCaptureInput = z.object({ text: CaptureText });
export type CreateCaptureInput = z.infer<typeof CreateCaptureInput>;
