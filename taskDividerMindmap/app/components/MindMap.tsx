"use client";

import React, { useCallback, useMemo, useState, useEffect } from "react";
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  NodeProps,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  MiniMap,
  ReactFlowInstance,
  useReactFlow,
  NodeChange,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  ExternalLink,
  Download,
  PlusSquare,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Layout,
} from "lucide-react";
import { convertToMarkdown, downloadJson } from "@/lib/utils";
import MindMapLegend from "./MindMapLegend";
import { motion, AnimatePresence } from "framer-motion";
import Credits from "./Credits";
import { Subtopic, Link } from "@/app/lib/schemas";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import dynamic from "next/dynamic";
import "reactflow/dist/base.css";
import NodeLoadingOverlay from "./NodeLoadingOverlay";

interface MindMapProps {
  data: { topic: string; subtopics: Subtopic[] } | null;
  onExpandMap: (nodeId: string) => Promise<void>;
}

const NodeContent: React.FC<{
  name: string;
  details: string;
  onClick: () => void;
  onExpand: () => void;
  isExpanded: boolean;
  hasChildren: boolean;
  isRoot: boolean;
  onExpandMap: (nodeId: string) => Promise<void>;
  nodeId: string;
  onDelete: (nodeId: string) => void;
  isExpanding?: boolean;
  setExpandingNodes: React.Dispatch<React.SetStateAction<Set<string>>>;
}> = ({
  name,
  onClick,
  onExpand,
  isExpanded,
  hasChildren,
  isRoot,
  onExpandMap,
  nodeId,
  onDelete,
  isExpanding = false,
  setExpandingNodes,
}) => {
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className="relative p-4 rounded-md shadow-sm transition-all duration-300 ease-in-out cursor-pointer min-w-[12rem] bg-white hover:bg-gray-50 flex items-center justify-between"
          onClick={onClick} // ← 노드 클릭 시 상세 정보 불러오기
        >
          {isExpanding && <NodeLoadingOverlay />}
          <div className="text-lg font-bold text-center flex-grow">{name}</div>
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExpand();
              }}
              className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 flex-shrink-0"
            >
              {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            </button>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={async (e) => {
            e.stopPropagation();
            setExpandingNodes((prev) => new Set(prev).add(nodeId));
            await onExpandMap(nodeId);
            setExpandingNodes((prev) => {
              const newSet = new Set(prev);
              newSet.delete(nodeId);
              return newSet;
            });
          }}
        >
          확장하기
        </ContextMenuItem>
        {!isRoot && (
          <ContextMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onDelete(nodeId);
            }}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            노드 삭제
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};

const RootNode: React.FC<NodeProps> = ({ data }) => (
  <div className="border border-blue-400 text-blue-700 bg-white rounded-md shadow-sm">
    <NodeContent {...data} />
    <Handle type="source" position={Position.Right} className="w-2 h-2" />
  </div>
);

const BranchNode: React.FC<NodeProps> = ({ data }) => (
  <div className="border border-green-400 text-green-700 bg-white rounded-md shadow-sm">
    <NodeContent {...data} />
    <Handle type="target" position={Position.Left} className="w-2 h-2" />
    <Handle type="source" position={Position.Right} className="w-2 h-2" />
  </div>
);

const LeafNode: React.FC<NodeProps> = ({ data }) => (
  <div className="border border-yellow-400 text-yellow-700 bg-white rounded-md shadow-sm">
    <NodeContent {...data} />
    <Handle type="target" position={Position.Left} className="w-2 h-2" />
  </div>
);

/** mind map를 구성할 nodes/edges 배열 생성용 */
const createNodesAndEdges = (
  data: Subtopic,
  parentId: string | null,
  x: number,
  y: number,
  level: number,
  horizontalSpacing: number,
  verticalSpacing: number,
  expandedNodes: Set<string>,
  onExpand: (nodeId: string, parentId: string | null) => void
) => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const nodeId = parentId
    ? `${parentId}-${data.name.replace(/\s+/g, "-")}`
    : data.name.replace(/\s+/g, "-");

  const xPos = x + level * horizontalSpacing;

  nodes.push({
    id: nodeId,
    type: parentId ? (data.subtopics?.length ? "branch" : "leaf") : "root",
    position: { x: xPos, y },
    data: {
      ...data,
      parentId,
      isRoot: !parentId,
      isExpanded: expandedNodes.has(nodeId),
      hasChildren: data.subtopics?.length > 0,
      onClick: () => {},
      onExpand: () => onExpand(nodeId, parentId),
      nodeId,
    },
  });

  if (parentId) {
    edges.push({
      id: `${parentId}-${nodeId}`,
      source: parentId,
      target: nodeId,
      type: "default",
      animated: true,
    });
  }

  if (data.subtopics && data.subtopics.length > 0 && expandedNodes.has(nodeId)) {
    const childSpacing = verticalSpacing * 2;
    const totalChildren = data.subtopics.length;
    const totalHeight = (totalChildren - 1) * childSpacing;
    const startY = y - totalHeight / 2;

    data.subtopics.forEach((subtopic, childIndex) => {
      const childY = startY + childIndex * childSpacing;
      const { nodes: childNodes, edges: childEdges } = createNodesAndEdges(
        subtopic,
        nodeId,
        xPos,
        childY,
        level + 1,
        horizontalSpacing,
        verticalSpacing,
        expandedNodes,
        onExpand
      );

      nodes.push(...childNodes);
      edges.push(...childEdges);
    });
  }

  return { nodes, edges };
};

const MindMap: React.FC<MindMapProps> = ({ data, onExpandMap }) => {
  const [selectedSubtopic, setSelectedSubtopic] = useState<Subtopic | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandingNodes, setExpandingNodes] = useState<Set<string>>(new Set());
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editedDetails, setEditedDetails] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isPositionChanging, setIsPositionChanging] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false); // 로딩 상태 추가

  const reactFlowInstance = useReactFlow();

  /**
   * 4. 클라이언트 호출 로직
   * Task 상세 설명과 평가기준을 /api/generate-detail 로 가져오는 함수
   */
  const handleNodeClickDetail = useCallback(
    async (node: Node) => {
      if (!node) return;
  
      // 이미 한 번 상세정보를 불러온 노드인지 체크
      if ((node.data as any)?.taskDetail) {
        // 기존 정보를 그대로 Sheet에 표시
        openSheet(node);
        return;
      }
  
      try {
        setIsLoadingDetail(true); // 로딩 시작
  
        // /api/generate-detail에 POST
        const res = await fetch("/api/generate-detail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: node.data.name }),
        });
        if (!res.ok) throw new Error("Failed to fetch task details");
  
        const { taskDetail, evaluationChecklist } = await res.json();
        // node.data에 상세정보 저장
        setNodes((prevNodes) =>
          prevNodes.map((n) => {
            if (n.id === node.id) {
              return {
                ...n,
                data: {
                  ...n.data,
                  taskDetail,
                  evaluationChecklist,
                },
              };
            }
            return n;
          })
        );
  
        // Sheet 열기
        openSheet({
          ...node,
          data: {
            ...node.data,
            taskDetail,
            evaluationChecklist,
          },
        });
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingDetail(false); // 로딩 종료
      }
    },
    [setNodes]
  );
  


  /** Sheet에 선택된 노드 정보를 표시하는 로직 */
  const openSheet = (node: Node) => {
    const data = node.data as Subtopic;
    setSelectedSubtopic(data);
    setEditedName(data.name);
    setEditedDetails(data.details);
    setIsEditing(false);
  };

  /**
   * Node 클릭 시 실행
   * - 단순 서브토픽 select + taskDetail이 없다면 handleNodeClickDetail로 호출
   */
  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.stopPropagation();
      handleNodeClickDetail(node);
    },
    [handleNodeClickDetail]
  );

  // 이름/세부사항 수정 후 저장
  const handleSave = useCallback(() => {
    if (!selectedSubtopic) return;

    setNodes((prevNodes) =>
      prevNodes.map((node) => {
        if (node.id === selectedSubtopic.nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              name: editedName,
              details: editedDetails,
            },
          };
        }
        return node;
      })
    );

    setSelectedSubtopic({
      ...selectedSubtopic,
      name: editedName,
      details: editedDetails,
    });

    setIsEditing(false);
  }, [selectedSubtopic, editedName, editedDetails, setNodes]);

  // 노드 확장 토글
  const handleExpandNode = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  // 노드 삭제
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nodes) => nodes.filter((node) => !node.id.startsWith(nodeId)));
      setEdges((edges) =>
        edges.filter(
          (edge) => !edge.source.startsWith(nodeId) && !edge.target.startsWith(nodeId)
        )
      );
    },
    [setNodes, setEdges]
  );

  // 초기/업데이트 시 nodes, edges 생성
  useEffect(() => {
    if (!data) return;

    const { nodes: newNodes, edges: newEdges } = createNodesAndEdges(
      { name: data.topic, details: "", links: [], subtopics: data.subtopics },
      null,
      0,
      0,
      0,
      300,
      200,
      expandedNodes,
      handleExpandNode
    );

    setNodes(
      newNodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onClick: () => {}, // 임시 (아래 onNodeClick 사용 시 reactflow가 자동 연결)
          onExpand: () => handleExpandNode(node.id),
          onExpandMap: () => onExpandMap(node.id),
          onDelete: handleDeleteNode,
          isExpanded: expandedNodes.has(node.id),
          isExpanding: expandingNodes.has(node.id),
          setExpandingNodes,
        },
      }))
    );
    setEdges(newEdges);
  }, [
    data,
    expandedNodes,
    setNodes,
    setEdges,
    handleExpandNode,
    handleDeleteNode,
    expandingNodes,
    onExpandMap,
  ]);

  // Markdown 다운로드
  const downloadMarkdown = () => {
    if (!data) return;
    const markdown = convertToMarkdown(data);
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.topic.replace(/\s+/g, "_")}_mind_map.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // JSON 다운로드
  const handleDownloadJson = () => {
    if (!data) return;
    downloadJson(data, `${data.topic.replace(/\s+/g, "_")}_mind_map.json`);
  };

  const nodeTypes = useMemo(
    () => ({
      root: RootNode,
      branch: BranchNode,
      leaf: LeafNode,
    }),
    []
  );

  // 새 Mind Map 생성
  const handleNewClick = () => {
    setIsConfirmOpen(true);
  };
  const handleConfirmNew = () => {
    setIsConfirmOpen(false);
    window.location.reload();
  };

  /** 노드 자동정렬 */
  const handleArrangeNodes = useCallback(() => {
    const nodes = reactFlowInstance.getNodes();
    const edges = reactFlowInstance.getEdges();

    const nodesByLevel: { [key: number]: Node[] } = {};
    const rootNode = nodes.find((n) => !edges.some((e) => e.target === n.id));
    if (!rootNode) return;

    // 레벨별로 노드를 분류
    const assignLevel = (nodeId: string, level: number) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      if (!nodesByLevel[level]) {
        nodesByLevel[level] = [];
      }
      nodesByLevel[level].push(node);

      // 자식 노드들
      const childEdges = edges.filter((e) => e.source === nodeId);
      childEdges.forEach((edge) => assignLevel(edge.target, level + 1));
    };

    assignLevel(rootNode.id, 0);

    const newNodes = [...nodes];
    const horizontalSpacing = 300;
    const verticalSpacing = 150;

    Object.entries(nodesByLevel).forEach(([level, levelNodes]) => {
      const numLevel = parseInt(level);
      const xPosition = numLevel * horizontalSpacing;
      levelNodes.forEach((node, index) => {
        const totalHeight = (levelNodes.length - 1) * verticalSpacing;
        const yStart = -totalHeight / 2;
        const yPosition = yStart + index * verticalSpacing;

        const nodeIndex = newNodes.findIndex((n) => n.id === node.id);
        if (nodeIndex !== -1) {
          newNodes[nodeIndex] = {
            ...newNodes[nodeIndex],
            position: { x: xPosition, y: yPosition },
          };
        }
      });
    });

    setNodes(newNodes);
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.2 });
    }, 50);
  }, [reactFlowInstance, setNodes]);

  // 드래그 시작/종료
  const onNodeDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);
  const onNodeDragStop = useCallback(() => {
    setIsDragging(false);
  }, []);

  // NodeChange 감지 → 위치 변경 처리
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const positionChanges = changes.some((change) => change.type === "position");
      if (positionChanges) {
        setIsPositionChanging(true);
        setTimeout(() => setIsPositionChanging(false), 100);
      }
      onNodesChange(changes);
    },
    [onNodesChange]
  );

  // data 변경 시 자동 정리
  useEffect(() => {
    if (!data || isDragging || isEditing || isPositionChanging) return;
    const tid = setTimeout(() => {
      handleArrangeNodes();
    }, 100);
    return () => clearTimeout(tid);
  }, [data, isDragging, isEditing, isPositionChanging, handleArrangeNodes]);

  if (!data) return null;

  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <AnimatePresence>
        {!isLoading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{ width: "100%", height: "100%" }}
          >
            {/* 상단 버튼/설정 */}
            <div className="absolute top-4 left-4 z-10">
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex items-center gap-2 cursor-pointer rounded-md"
                  >
                    <HelpCircle className="w-4 h-4" />
                    How to use
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>How to use</DialogTitle>
                  </DialogHeader>
                  <MindMapLegend />
                </DialogContent>
              </Dialog>
            </div>
            <div className="absolute top-4 right-4 z-10 flex gap-2">
              <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                <DialogTrigger asChild>
                  <Button
                    onClick={handleNewClick}
                    variant="outline"
                    className="flex items-center gap-2 cursor-pointer rounded-md"
                  >
                    <PlusSquare className="w-4 h-4" />
                    New
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm New Mind Map</DialogTitle>
                  </DialogHeader>
                  <p>
                    By creating a new mind map, this one will be lost. If you want
                    to keep it, make sure to download it as a JSON or Markdown file.
                  </p>
                  <div className="flex justify-end gap-2 mt-4">
                    <Button
                      onClick={() => setIsConfirmOpen(false)}
                      variant="outline"
                      className="rounded-md"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleConfirmNew}
                      className="bg-red-600 hover:bg-red-700 text-white rounded-md"
                    >
                      Confirm
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button
                onClick={downloadMarkdown}
                className="flex items-center gap-2 cursor-pointer rounded-md"
              >
                <Download className="w-4 h-4" />
                Markdown
              </Button>
              <Button
                onClick={handleDownloadJson}
                className="flex items-center gap-2 cursor-pointer rounded-md"
              >
                <Download className="w-4 h-4" />
                JSON
              </Button>
              <Button
                onClick={handleArrangeNodes}
                className="flex items-center gap-2 cursor-pointer rounded-md"
                variant="outline"
              >
                <Layout className="w-4 h-4" />
                정리하기
              </Button>
            </div>

            {/* React Flow 영역 */}
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={handleNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              onNodeClick={onNodeClick} // 노드 클릭 시 상세 로드
              fitView
              minZoom={0.1}
              maxZoom={1.5}
              defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
              elementsSelectable={true}
              nodesDraggable={true}
              nodesConnectable={false}
              snapToGrid={true}
              snapGrid={[15, 15]}
              onNodeDragStart={onNodeDragStart}
              onNodeDragStop={onNodeDragStop}
            >
              <Background color="#f0f0f0" gap={16} />
              <Controls showInteractive={false} />
              <MiniMap />
            </ReactFlow>
            <Credits />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 우측/좌측 시트 */}
      <Sheet
        open={!!selectedSubtopic}
        onOpenChange={() => {
          setSelectedSubtopic(null);
          setIsEditing(false);
        }}
      >
        <SheetContent className="overflow-y-auto">
  <SheetHeader>
    {isEditing ? (
      <div className="space-y-4">
        <input
          type="text"
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          className="text-2xl w-full p-2 border rounded-md font-bold"
        />
        <textarea
          value={editedDetails}
          onChange={(e) => setEditedDetails(e.target.value)}
          className="w-full p-2 border rounded-md min-h-[100px] text-gray-700"
          placeholder="상세 내용을 입력하세요..."
        />
        <div className="flex gap-2">
          <Button onClick={handleSave} className="flex-1">
            저장
          </Button>
          <Button
            onClick={() => {
              setIsEditing(false);
              setEditedName(selectedSubtopic?.name || "");
              setEditedDetails(selectedSubtopic?.details || "");
            }}
            variant="outline"
            className="flex-1"
          >
            취소
          </Button>
        </div>
      </div>
    ) : (
      <>
        <div className="flex justify-between items-center">
          <SheetTitle className="text-2xl mt-4 font-bold">
            {selectedSubtopic?.name}
          </SheetTitle>
          <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
            수정
          </Button>
        </div>
        <SheetDescription className="mb-2 text-gray-700">
          {selectedSubtopic?.details}
        </SheetDescription>
      </>
    )}
  </SheetHeader>

  {/* 로딩 중일 때 표시되는 로딩 화면 */}
  {isLoadingDetail ? (
    <div className="flex justify-center items-center h-full">
      <div className="loader">Loading...</div> {/* 커스터마이징 가능한 로딩 애니메이션 */}
    </div>
  ) : (
    <>
      {/* GPT가 생성한 Task 상세 설명이 있다면 출력 */}
      {selectedSubtopic?.["taskDetail"] && (
        <div className="mt-6 mb-2 p-3 bg-gray-50 rounded-md">
          <h3 className="text-lg font-semibold mb-2">Task 상세 설명</h3>
          <p className="text-gray-700 whitespace-pre-line">
            {selectedSubtopic["taskDetail"]}
          </p>
        </div>
      )}

      {/* GPT가 생성한 체크리스트가 있다면 출력 */}
      {selectedSubtopic?.["evaluationChecklist"] && (
        <div className="mt-6 mb-2 p-3 bg-gray-50 rounded-md">
          <h3 className="text-lg font-semibold mb-2">평가기준 체크리스트</h3>
          <ul className="list-disc pl-6 text-gray-700">
            {(selectedSubtopic["evaluationChecklist"] as string[]).map(
              (item, i) => (
                <li key={i}>{item}</li>
              )
            )}
          </ul>
        </div>
      )}

      {/* 링크들 */}
      {selectedSubtopic?.links && selectedSubtopic.links.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold mb-2">Learn More</h3>
          <div className="space-y-2 mt-4">
            {selectedSubtopic.links.map((link: Link, index: number) => (
              <Button
                key={index}
                variant="outline"
                className="w-full justify-start rounded-md"
                asChild
              >
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center"
                >
                  <span className="flex-shrink-0 w-6">
                    <ExternalLink className="h-4 w-4" />
                  </span>
                  <span className="truncate">{link.title}</span>
                </a>
              </Button>
            ))}
          </div>
        </div>
      )}
    </>
  )}
</SheetContent>

      </Sheet>
    </div>
  );
};

export default MindMap;
