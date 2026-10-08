import { generateText, gateway, NoOutputGeneratedError, Output, tool } from "ai";

import {
  InvalidProviderOutputError,
  type AiProvider,
  type GenerateRequest,
  type ProviderCapabilities,
  type ProviderResult,
} from "@/ai/provider";
import { conservativeCapabilities, providerCapabilities } from "@/ai/provider";

export class GatewayProvider implements AiProvider {
  readonly name = "gateway";

  capabilities(model: string): ProviderCapabilities {
    return providerCapabilities[model] ?? conservativeCapabilities;
  }

  async generate(request: GenerateRequest): Promise<ProviderResult> {
    const tools = Object.fromEntries(
      Object.entries(request.tools).map(([name, definition]) => [
        name,
        tool({ description: definition.description, inputSchema: definition.inputSchema }),
      ]),
    );
    const output = request.outputSchema
      ? Output.object({ schema: request.outputSchema })
      : undefined;
    let result;
    try {
      result = await generateText({
        model: gateway(request.model),
        system: request.system,
        prompt: request.messages
          .map(({ role, content }) => `${role.toUpperCase()}: ${content}`)
          .join("\n\n"),
        tools,
        toolChoice: "auto",
        maxRetries: 0,
        timeout: 30_000,
        ...(output ? { output } : {}),
      });
    } catch (error) {
      if (output && NoOutputGeneratedError.isInstance(error))
        throw new InvalidProviderOutputError();
      throw error;
    }

    if (result.toolCalls.length > 0) {
      return {
        kind: "tool_calls",
        calls: result.toolCalls.map((call) => ({ name: call.toolName, input: call.input })),
        source: "model",
      };
    }
    const value = result.output ?? result.text;
    return {
      kind: "output",
      output: value,
      raw: typeof value === "string" ? value : JSON.stringify(value),
      source: "model",
    };
  }
}
