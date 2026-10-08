import type { z } from "zod";

export interface ProviderCapabilities {
  toolCalling: boolean;
  structuredOutput: boolean;
  maxContextTokens: number;
  streaming: boolean;
}

export interface ProviderMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ProviderTool {
  description: string;
  inputSchema: z.ZodType;
}

export interface GenerateRequest {
  model: string;
  system: string;
  messages: ProviderMessage[];
  tools: Record<string, ProviderTool>;
  outputSchema?: z.ZodType;
}

export type ProviderResult =
  | {
      kind: "tool_calls";
      calls: Array<{ name: string; input: unknown }>;
      source?: "model" | "parser";
    }
  | { kind: "output"; output: unknown; raw: string; source?: "model" | "parser" };

export interface AiProvider {
  readonly name: string;
  capabilities(model: string): ProviderCapabilities;
  generate(request: GenerateRequest): Promise<ProviderResult>;
}

export class InvalidProviderOutputError extends Error {
  constructor() {
    super("The structured response did not match the required output schema");
    this.name = "InvalidProviderOutputError";
  }
}

export const conservativeCapabilities: ProviderCapabilities = {
  toolCalling: false,
  structuredOutput: false,
  maxContextTokens: 8_000,
  streaming: false,
};

/** Unknown model identifiers use the safest single-call, no-tools path. */
export const providerCapabilities: Readonly<Record<string, ProviderCapabilities>> = {
  "openai/gpt-4.1-mini": {
    toolCalling: true,
    structuredOutput: true,
    maxContextTokens: 32_000,
    streaming: false,
  },
  "anthropic/claude-sonnet-4.5": {
    toolCalling: true,
    structuredOutput: true,
    maxContextTokens: 32_000,
    streaming: false,
  },
};
