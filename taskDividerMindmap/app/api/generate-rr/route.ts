import { openai } from "@ai-sdk/openai";
import { ollama } from "ollama-ai-provider";
import { generateObject } from "ai";
import { z } from "zod";

// 새로 만든 R&R 스키마 import
import { RRResponseSchema } from "@/app/lib/schemas";
import { rnrPrompt } from "@/app/lib/prompts";  // R&R 전용 프롬프트(아래 3번에서 작성)

// Ollama / OpenAI 모델 선택 로직
const USE_LOCAL_MODELS = process.env.NEXT_PUBLIC_USE_LOCAL_MODELS === "true";
const LOCAL_MODEL = "llama3.1";
const EXTERNAL_MODEL = "gpt-4o-mini-2024-07-18";

function getModel(useLocalModel: boolean) {
  return useLocalModel
    ? ollama(LOCAL_MODEL)
    : openai(EXTERNAL_MODEL, { structuredOutputs: true });
}

// 실제 API 라우트
export async function POST(req: Request) {
  try {
    // 1) 요청 바디에서 필요한 필드(taskDetail, evaluationChecklist) 받음
    const { taskDetail, evaluationChecklist } = await req.json();

    // 2) 프롬프트 생성 
    //    => rnrPrompt에 taskDetail, evaluationChecklist를 넣어서 하나의 문자열로 만듭니다.
    const prompt = rnrPrompt(taskDetail, evaluationChecklist);

    // 3) GPT 생성
    const model = getModel(USE_LOCAL_MODELS);
    const response = await generateObject({
      model,
      prompt,
      schema: RRResponseSchema, // 수정된 스키마 사용
    });

    // 4) 응답 반환
    return new Response(JSON.stringify(response.object.roles), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error generating R&R:", error);

    // 에러 발생 시 기본 응답
    return new Response(
      JSON.stringify([
        {
          role: "에러",
          responsibility: "R&R 생성 실패",
          reason: "오류가 발생했습니다. 다시 시도해주세요."
        },
      ]),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
}
