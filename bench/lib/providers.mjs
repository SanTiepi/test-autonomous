import { createOpenAIProvider } from "../providers/openai.mjs";
import { createReplayProvider } from "../providers/replay.mjs";

export async function createProvider(options) {
  if (options.provider === "replay") {
    return createReplayProvider(options);
  }

  if (options.provider === "openai") {
    return createOpenAIProvider(options);
  }

  throw new Error(`Unknown benchmark provider "${options.provider}"`);
}
