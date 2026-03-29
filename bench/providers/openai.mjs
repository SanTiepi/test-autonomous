import http from "node:http";
import https from "node:https";

export async function createOpenAIProvider({
  apiKey,
  model = "gpt-5.4-mini",
  baseUrl = "https://api.openai.com",
  timeoutMs = 120_000,
}) {
  if (!apiKey) {
    throw new Error("OpenAI provider requires CODEX_API_KEY or OPENAI_API_KEY");
  }

  return {
    id: "openai",
    async generate({ prompt }) {
      const startedAt = Date.now();
      const url = new URL("/v1/responses", baseUrl);
      const transport = url.protocol === "https:" ? https : http;
      const body = JSON.stringify({
        model,
        input: prompt,
        temperature: 0,
        text: { format: { type: "json_object" } },
      });

      const reqOptions = {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "Content-Length": Buffer.byteLength(body),
        },
      };

      const result = await new Promise((resolve) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const request = transport.request({ ...reqOptions, signal: controller.signal }, (response) => {
          let raw = "";
          response.on("data", (chunk) => {
            raw += chunk.toString();
          });
          response.on("end", () => {
            clearTimeout(timer);
            resolve({ statusCode: response.statusCode ?? 0, raw, error: null });
          });
        });
        request.on("error", (error) => {
          clearTimeout(timer);
          resolve({ statusCode: 0, raw: "", error: error.message });
        });
        request.write(body);
        request.end();
      });

      const runtimeMs = Date.now() - startedAt;
      if (result.error) {
        return {
          error: result.error,
          failure_class: result.error.includes("aborted") ? "timeout" : "provider_error",
          runtime_ms: runtimeMs,
          tokens_in: 0,
          tokens_out: 0,
        };
      }

      if (result.statusCode < 200 || result.statusCode >= 300) {
        return {
          error: `OpenAI HTTP ${result.statusCode}`,
          failure_class: result.statusCode === 429 ? "timeout" : "provider_error",
          runtime_ms: runtimeMs,
          tokens_in: 0,
          tokens_out: 0,
          raw: result.raw,
        };
      }

      const payload = JSON.parse(result.raw);
      const usage = payload.usage ?? {};
      const outputText = extractOutputText(payload);

      let edit = null;
      try {
        edit = JSON.parse(outputText);
      } catch {
        return {
          error: "Model did not return valid JSON",
          failure_class: "parse",
          runtime_ms: runtimeMs,
          tokens_in: usage.input_tokens ?? usage.prompt_tokens ?? 0,
          tokens_out: usage.output_tokens ?? usage.completion_tokens ?? 0,
          raw: outputText,
        };
      }

      return {
        edit,
        raw: outputText,
        runtime_ms: runtimeMs,
        tokens_in: usage.input_tokens ?? usage.prompt_tokens ?? 0,
        tokens_out: usage.output_tokens ?? usage.completion_tokens ?? 0,
      };
    },
  };
}

function extractOutputText(payload) {
  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }

  if (Array.isArray(payload.output)) {
    for (const item of payload.output) {
      if (item.type !== "message" || !Array.isArray(item.content)) continue;
      for (const content of item.content) {
        if (content.type === "output_text" && typeof content.text === "string") {
          return content.text;
        }
      }
    }
  }

  throw new Error("No output_text in OpenAI response");
}
