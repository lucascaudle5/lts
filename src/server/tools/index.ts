import "server-only";

import { toolInputSchemas } from "@/contracts/tools";
import { getRecentObservationsTool } from "@/server/tools/getRecentObservations";
import { getScheduleTool } from "@/server/tools/getSchedule";
import { getTodayTool } from "@/server/tools/getToday";
import { listOpenTasksTool } from "@/server/tools/listOpenTasks";
import type { ProviderTool } from "@/ai/provider";

const descriptions = {
  get_today: "Read this user's blocks and open-task count for one calendar date.",
  get_schedule: "Read this user's scheduled blocks over a window of at most 14 days.",
  list_open_tasks: "Read up to 50 open task titles and due dates for this user.",
  get_recent_observations:
    "Read observations from opted-in categories over at most 14 days. Only use when relevant.",
  submit_proposals: "Submit typed proposal drafts for the user to review and approve.",
} as const;

export function getProviderTools(): Record<string, ProviderTool> {
  return Object.fromEntries(
    Object.entries(toolInputSchemas).map(([name, inputSchema]) => [
      name,
      { description: descriptions[name as keyof typeof descriptions], inputSchema },
    ]),
  );
}

export interface ToolContext {
  userId: string;
  timezone: string;
  referenceDate: string;
}

export async function executeReadTool(
  name: string,
  input: unknown,
  context: ToolContext,
  db?: Parameters<typeof getTodayTool>[3],
): Promise<{ output: unknown; rowCount: number; returnedIds: string[]; validatedInput: unknown }> {
  if (name === "get_today") {
    const validatedInput = toolInputSchemas.get_today.parse(input);
    const output = await getTodayTool(context.userId, validatedInput, context.timezone, db);
    return {
      output,
      rowCount: output.blocks.length,
      returnedIds: output.blocks.map((block) => block.id),
      validatedInput,
    };
  }
  if (name === "get_schedule") {
    const validatedInput = toolInputSchemas.get_schedule.parse(input);
    const output = await getScheduleTool(context.userId, validatedInput, context.timezone, db);
    return {
      output,
      rowCount: output.blocks.length,
      returnedIds: output.blocks.map((block) => block.id),
      validatedInput,
    };
  }
  if (name === "list_open_tasks") {
    const validatedInput = toolInputSchemas.list_open_tasks.parse(input);
    const output = await listOpenTasksTool(context.userId, validatedInput, db);
    return {
      output,
      rowCount: output.tasks.length,
      returnedIds: output.tasks.map((task) => task.id),
      validatedInput,
    };
  }
  if (name === "get_recent_observations") {
    const validatedInput = toolInputSchemas.get_recent_observations.parse(input);
    const output = await getRecentObservationsTool(
      context.userId,
      validatedInput,
      context.referenceDate,
      db,
    );
    return {
      output,
      rowCount: output.observations.length,
      returnedIds: output.observations.map((observation) => observation.id),
      validatedInput,
    };
  }
  throw new Error("Tool is not allowlisted");
}
