import { ollama } from "ollama-ai-provider";
import OpenAI from "openai";
import { generateObject, generateText } from "ai";
import { defaultLocalPrompt, defaultExternalPrompt } from "@/app/lib/prompts";
import { z } from "zod";
import { openai as fallbackOpenAI } from "@ai-sdk/openai";

import {
  FlatMindMapSchema,
  FlatSubtopicSchema,
  Subtopic,
} from "@/app/lib/schemas";
import { validateMindMapData } from "@/lib/utils";

const USE_LOCAL_MODELS = process.env.NEXT_PUBLIC_USE_LOCAL_MODELS === "true";
const LOCAL_MODEL = "llama3.1";
const EXTERNAL_MODEL = "deepseek-chat";
const FALLBACK_EXTERNAL_MODEL = "gpt-4o-2024-11-20";

const deepseek = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY!,
});

interface CompletionParams {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
}

function deepseekModel(modelName: string, options: object) {
  return {
    chat: {
      completions: {
        create: async (params: CompletionParams) => {
          return await deepseek.chat.completions.create({
            model: modelName,
            ...params,
            ...options,
          });
        },
      },
    },
  };
}

const getModel = (useLocalModel: boolean) =>
  useLocalModel
    ? ollama(LOCAL_MODEL)
    : deepseekModel(EXTERNAL_MODEL, { response_format: { type: "json_object" } });

const getPrompt = (useLocalModel: boolean, topic: string, nodeId?: string) => {
  const basePrompt = useLocalModel ? defaultLocalPrompt : defaultExternalPrompt;
  if (nodeId) {
    return `${basePrompt}Expand the subtask "${topic}" with node ID "${nodeId}".`;
  }
  return `${basePrompt}${topic}`;
};

export async function POST(req: Request) {
  const { topic, nodeId } = await req.json();

  try {
    const model = getModel(USE_LOCAL_MODELS);
    const prompt = getPrompt(USE_LOCAL_MODELS, topic, nodeId);

    const generateMindMap = async (): Promise<z.infer<typeof FlatMindMapSchema>> => {
      if (USE_LOCAL_MODELS) {
        const response = await generateText({ model, prompt });

        try {
          const cleanedResponse = response.text.trim();
          const lastBrace = cleanedResponse.lastIndexOf("}");
          const validJson = cleanedResponse.substring(0, lastBrace + 1);
          const parsedResponse = JSON.parse(validJson);

          if (nodeId) {
            interface SubtopicData {
              name: string;
              details: string;
              links: Array<{ title: string; type: string; url: string }>;
            }

            const subtopics = parsedResponse.subtopics.map((st: SubtopicData) => ({
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

      // DeepSeek 모델 사용 시 직접 응답 처리
      try {
        const response = await model.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
        });
        
        const result = response.choices[0].message.content;
        return JSON.parse(result);
      } catch (deepseekError) {
        console.error("DeepSeek call failed, falling back to OpenAI:", deepseekError);
        const fallbackModel = fallbackOpenAI(FALLBACK_EXTERNAL_MODEL, { structuredOutputs: true });
        const { object } = await generateObject({
          model: fallbackModel,
          prompt,
          schema: FlatMindMapSchema,
        });
        return object;
      }
    };

    const flatMindMapData = await generateMindMap();

    if (!flatMindMapData || !flatMindMapData.subtopics) {
      throw new Error("Invalid mind map data structure");
    }

    const nestedMindMapData = {
      topic: flatMindMapData.topic,
      subtopics: reconstructNestedStructure(flatMindMapData.subtopics),
    };

    const validatedMindMapData = await validateMindMapData(nestedMindMapData);

    return new Response(JSON.stringify(validatedMindMapData), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("API Error:", error);
    const errorResponse = {
      topic,
      subtopics: [
        {
          name: "Error",
          details: "Failed to expand this topic. Please try again.",
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

interface NodeData {
  name: string;
  details: string;
  links: Array<{ title: string; type: string; url: string }>;
  subtopics: Subtopic[];
  id: string;
  parentId: string | null;
}

function reconstructNestedStructure(
  flatSubtopics: z.infer<typeof FlatSubtopicSchema>[]
): Subtopic[] {
  const subtopicMap = new Map<string, NodeData>();

  flatSubtopics.forEach((subtopic) => {
    subtopicMap.set(subtopic.id, {
      name: subtopic.name,
      details: subtopic.details,
      links: subtopic.links,
      subtopics: [],
      id: subtopic.id,
      parentId: subtopic.parentId,
    });
  });

  const rootNodes: NodeData[] = [];
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

  const cleanNode = (node: NodeData): Subtopic => {
    const { id: _id, parentId: _parentId, ...cleanedNode } = node;
    return {
      ...cleanedNode,
      subtopics: node.subtopics.map(cleanNode),
    };
  };

  return rootNodes.map(cleanNode);
}
