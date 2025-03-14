import { ollama } from "ollama-ai-provider";
import { generateObject, generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { defaultLocalPrompt, defaultExternalPrompt } from "@/app/lib/prompts";

import {
  FlatMindMapSchema,
  FlatSubtopicSchema,
  Subtopic,
} from "@/app/lib/schemas";
import { validateMindMapData } from "@/lib/utils";
import { z } from "zod";

// Edge Runtime 사용 선언
export const runtime = 'edge';

const USE_LOCAL_MODELS = process.env.NEXT_PUBLIC_USE_LOCAL_MODELS === "true";
const LOCAL_MODEL = "llama3.1";
const EXTERNAL_MODEL = "o3-mini-2025-01-31";

// API 타임아웃 설정
const TIMEOUT_DURATION = 100000; // 100초

const getModel = (useLocalModel: boolean) => {
  const model = useLocalModel
    ? ollama(LOCAL_MODEL)
    : openai(EXTERNAL_MODEL, { 
        structuredOutputs: true,

      });
  return model as ReturnType<typeof ollama>;
};

const getPrompt = (useLocalModel: boolean, topic: string, nodeId?: string) => {
  const basePrompt = useLocalModel ? defaultLocalPrompt : defaultExternalPrompt;
  if (nodeId) {
    return `${basePrompt}Expand the subtask "${topic}" with node ID "${nodeId}".`;
  }
  return `${basePrompt}${topic}`;
};

// 프로미스에 타임아웃 추가하는 유틸리티 함수
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    )
  ]);
};

export async function POST(req: Request) {
  const { topic, nodeId } = await req.json();

  try {
    const model = getModel(USE_LOCAL_MODELS);
    const prompt = getPrompt(USE_LOCAL_MODELS, topic, nodeId);

    const generateMindMap = async (): Promise<
      z.infer<typeof FlatMindMapSchema>
    > => {
      if (USE_LOCAL_MODELS) {
        const response = await withTimeout(
          generateText({ model, prompt }),
          TIMEOUT_DURATION
        );

        try {
          const cleanedResponse = response.text.trim();
          const lastBrace = cleanedResponse.lastIndexOf("}");
          const validJson = cleanedResponse.substring(0, lastBrace + 1);
          const parsedResponse = JSON.parse(validJson);

          if (nodeId) {
            type SubtopicResponse = {
              name: string;
              details: string;
              links?: Array<{
                title: string;
                type: string;
                url: string;
              }>;
            };

            const subtopics = parsedResponse.subtopics.map((st: SubtopicResponse) => ({
              id: `${nodeId}-${st.name.replace(/\s+/g, "-")}`,
              parentId: nodeId,
              name: st.name,
              details: st.details,
              links: st.links || [],
            }));

            return {
              topic,
              subtopics,
            };
          }

          return parsedResponse;
        } catch (parseError) {
          console.error("Failed to parse model response:", parseError);
          return {
            topic,
            subtopics: [
              {
                id: nodeId || "error",
                parentId: null,
                name: "Error expanding topic",
                details: "Failed to expand this topic. Please try again.",
                links: [],
              },
            ],
          };
        }
      }

      const response = await withTimeout(
        generateObject({
          model,
          prompt,
          schema: FlatMindMapSchema,
        }),
        TIMEOUT_DURATION
      );
      
      return response.object;
    };

    const flatMindMapData = await generateMindMap();

    if (!flatMindMapData || !flatMindMapData.subtopics) {
      throw new Error("Invalid mind map data structure");
    }

    const nestedMindMapData = {
      topic: flatMindMapData.topic,
      name: flatMindMapData.topic,
      details: "",
      links: [],
      subtopics: reconstructNestedStructure(flatMindMapData.subtopics),
      taskDetail: "",
      evaluationChecklist: [],
      rrData: [],
      status: 'not_started' as const
    };

    const validatedMindMapData = await validateMindMapData(nestedMindMapData);

    return new Response(JSON.stringify(validatedMindMapData), {
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      },
    });
  } catch (error) {
    console.error("API Error:", error);
    const errorResponse = {
      topic,
      subtopics: [
        {
          name: "Error",
          details: "Request timeout. Please try again.",
          links: [],
          subtopics: [],
        },
      ],
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}

interface SubtopicMapItem extends Required<Omit<Subtopic, 'subtopics'>> {
  id: string;
  parentId: string | null;
  subtopics: SubtopicMapItem[];
}

function reconstructNestedStructure(
  flatSubtopics: z.infer<typeof FlatSubtopicSchema>[]
): Subtopic[] {
  const subtopicMap = new Map<string, SubtopicMapItem>();

  flatSubtopics.forEach((subtopic) => {
    subtopicMap.set(subtopic.id, {
      name: subtopic.name,
      details: subtopic.details,
      links: subtopic.links,
      subtopics: [],
      id: subtopic.id,
      parentId: subtopic.parentId,
      taskDetail: '',
      evaluationChecklist: [],
      rrData: [],
      status: 'not_started' as const
    });
  });

  const rootNodes: SubtopicMapItem[] = [];
  flatSubtopics.forEach((subtopic) => {
    const node = subtopicMap.get(subtopic.id);
    if (!node) return;

    if (!subtopic.parentId) {
      rootNodes.push(node);
      return;
    }

    const parent = subtopicMap.get(subtopic.parentId);
    if (!parent) {
      rootNodes.push(node);
      return;
    }

    parent.subtopics.push(node);
  });

  function cleanNode(node: SubtopicMapItem): Subtopic {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, parentId, ...cleanedNode } = node;
    return {
      ...cleanedNode,
      subtopics: node.subtopics.map(cleanNode),
    };
  }

  return rootNodes.map(cleanNode);
}