import { openai } from "@ai-sdk/openai";
import { ollama } from "ollama-ai-provider";
import { generateText } from "ai";

const USE_LOCAL_MODELS = process.env.NEXT_PUBLIC_USE_LOCAL_MODELS === "true";
const LOCAL_MODEL = "llama3.1";
const EXTERNAL_MODEL = "gpt-4o-mini-2024-07-18";

function getModel(useLocalModel: boolean) {
  const model = useLocalModel
    ? ollama(LOCAL_MODEL)
    : openai(EXTERNAL_MODEL);
  return model as ReturnType<typeof ollama>;
}

export async function POST(req: Request, nodeId: string) {
  try {
    const { topic } = await req.json();
    
    const prompt = `
    Please generate the most appropriate search query for the following task.
    The search results should help find specific information that are helpful for actual task execution.
    
    Task: ${topic}
    Task Node ID: ${nodeId}
    
    Please generate a search query considering the following conditions:
    1. Include keywords that can find specific procedures
    2. Include keywords that can find practical examples and case studies
    3. Exclude unnecessary modifiers
    
    Return only the query:`;

    const model = getModel(USE_LOCAL_MODELS);
    const response = await generateText({ model, prompt });
    
    return new Response(JSON.stringify({ query: response.text.trim() }), {
      headers: { "Content-Type": "application/json" },
    });
    
  } catch (error) {
    console.error("Error generating search query:", error);
    return new Response(JSON.stringify({ error: "Failed to generate search query" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
} 