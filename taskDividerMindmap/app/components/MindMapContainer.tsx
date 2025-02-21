"use client";

import { ReactFlowProvider } from "reactflow";
import MindMap from "./MindMap";
import { useMindMapData } from "../hooks/useMindMapData";
import LoadingMindMap from "./LoadingMindMap";
import CreateMindMap from "./CreateMindMap";
import { useRouter } from "next/navigation";
import { MindMapData } from "@/app/lib/schemas";

export default function MindMapContainer() {
  const { data, isLoading, error, fetchMindMap, expandMap, setData } = useMindMapData();
  const router = useRouter();

  if (isLoading && !data) return <LoadingMindMap />;

  if (error) {
    router.push("/?error=true");
    return <CreateMindMap fetchMindMap={fetchMindMap} />;
  }

  if (!data) return <CreateMindMap fetchMindMap={fetchMindMap} />;

  const mindMapData: MindMapData = {
    ...data,
    name: data.topic,
    details: data.details || "",
    links: data.links || [],
    subtopics: data.subtopics.map(subtopic => ({
      ...subtopic,
      name: subtopic.name,
      details: subtopic.details || "",
      links: subtopic.links || [],
      subtopics: subtopic.subtopics || [],
      taskDetail: subtopic.taskDetail || "",
      evaluationChecklist: subtopic.evaluationChecklist || [],
      rrData: subtopic.rrData || [],
      status: subtopic.status || 'not_started'
    }))
  };

  return (
    <div className="w-full h-full">
      <ReactFlowProvider>
        <MindMap 
          data={mindMapData}
          onExpandMap={expandMap}
          setData={setData}
        />
      </ReactFlowProvider>
    </div>
  );
}
