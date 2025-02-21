import { ollama } from "ollama-ai-provider";
import { generateObject, generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { detailAndChecklistPrompt } from "@/app/lib/prompts";  // Task 상세 + 평가기준 프롬프트
import { NodeDetailResponseSchema } from "@/app/lib/schemas";  // Task 상세 + 체크리스트 응답 스키마

const USE_LOCAL_MODELS = process.env.NEXT_PUBLIC_USE_LOCAL_MODELS === "true";
const LOCAL_MODEL = "llama3.1";
const EXTERNAL_MODEL = "gpt-4o-mini-2024-07-18";

// 모델 선택 함수
function getModel(useLocalModel: boolean) {
  return useLocalModel
    ? ollama(LOCAL_MODEL)
    : openai(EXTERNAL_MODEL, { structuredOutputs: true });
}

// POST 요청 처리
export async function POST(req: Request) {
    const { topic, nodeId } = await req.json();  // Topic (subtask/task) 받기

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
      } catch (error) {
        throw new Error("Failed to parse response");
      }
    }

    const response = await generateObject({
      model,
      prompt,
      schema: NodeDetailResponseSchema,  // 세부사항과 평가기준 체크리스트 스키마
    });

    return new Response(JSON.stringify(response.object), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("API Error:", error);

    // 에러 발생 시 기본 응답
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
