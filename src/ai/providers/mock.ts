import type {
  AiProvider,
  GenerateRequest,
  ProviderCapabilities,
  ProviderResult,
} from "@/ai/provider";

export type MockResponse = ProviderResult | Error;

/** Deterministic offline provider; tests can script retries, tools, and provider failures. */
export class MockProvider implements AiProvider {
  readonly name = "mock";
  readonly requests: GenerateRequest[] = [];
  private responseIndex = 0;

  constructor(private readonly responses: readonly MockResponse[] = []) {}

  capabilities(): ProviderCapabilities {
    return {
      toolCalling: true,
      structuredOutput: true,
      maxContextTokens: 32_000,
      streaming: false,
    };
  }

  async generate(request: GenerateRequest): Promise<ProviderResult> {
    this.requests.push(request);
    const response = this.responses[this.responseIndex++];
    if (!response) throw new Error("Mock provider has no scripted response");
    if (response instanceof Error) throw response;
    return { ...response, source: response.source ?? "parser" };
  }
}
