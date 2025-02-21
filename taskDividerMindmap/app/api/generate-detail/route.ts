import { ollama } from "ollama-ai-provider";
import { generateObject, generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { detailAndChecklistPrompt } from "@/app/lib/prompts";
import { NodeDetailResponseSchema } from "@/app/lib/schemas";

const USE_LOCAL_MODELS = process.env.NEXT_PUBLIC_USE_LOCAL_MODELS === "true";
const LOCAL_MODEL = "llama3.1";
const EXTERNAL_MODEL = "gpt-4o-mini-2024-07-18";

// 타입 단언을 사용하여 타입 충돌 해결
function getModel(useLocalModel: boolean) {
  const model = useLocalModel
    ? ollama(LOCAL_MODEL)
    : openai(EXTERNAL_MODEL, { structuredOutputs: true });
  return model as ReturnType<typeof ollama>;
}

export async function POST(req: Request) {
  const { topic, nodeId } = await req.json();

  try {
    const model = getModel(USE_LOCAL_MODELS);
    const prompt = `${detailAndChecklistPrompt}\n${topic} with node ID "${nodeId}"`;

    if (USE_LOCAL_MODELS) {
      const response = await generateText({ model, prompt });
      try {
        const parsedResponse = JSON.parse(response.text);
        return new Response(JSON.stringify(parsedResponse), {
          headers: { "Content-Type": "application/json" },
        });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_error) {
        throw new Error("Failed to parse response");
      }
    }

    const response = await generateObject({
      model,
      prompt,
      schema: NodeDetailResponseSchema,
    });

    return new Response(JSON.stringify(response.object), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("API Error:", error);

    const errorResponse = {
      taskDetail: "Failed to generate task details. Please try again.",
      evaluationChecklist: ["Failed to generate checklist."],
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}
