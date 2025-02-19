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
import dynamic from 'next/dynamic';
import 'reactflow/dist/base.css';
import NodeLoadingOverlay from "./NodeLoadingOverlay";

interface MindMapProps {
  data: { topic: string; subtopics: Subtopic[] } | null;
  onExpandMap: (nodeId: string) => Promise<void>;
}

// const ReactFlow = dynamic(
//   () => import('reactflow').then((mod) => mod.default),
//   {
//     ssr: false,
//     loading: () => <div>Loading...</div>
//   }
// );

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
        <div className="relative p-4 rounded-md shadow-sm transition-all duration-300 ease-in-out cursor-pointer min-w-[12rem] bg-white hover:bg-gray-50 flex items-center justify-between">
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
            setExpandingNodes(prev => new Set(prev).add(nodeId));
            await onExpandMap(nodeId);
            setExpandingNodes(prev => {
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

  const xPos = x + (level * horizontalSpacing);
  
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
    const startY = y - (totalHeight / 2);

    data.subtopics.forEach((subtopic, childIndex) => {
      const childY = startY + (childIndex * childSpacing);
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

  const reactFlowInstance = useReactFlow();

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedSubtopic(node.data as Subtopic);
    setEditedName(node.data.name);
    setEditedDetails(node.data.details);
    setIsEditing(false);
  }, []);

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

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((nodes) => nodes.filter((node) => !node.id.startsWith(nodeId)));
    setEdges((edges) => edges.filter((edge) => !edge.source.startsWith(nodeId) && !edge.target.startsWith(nodeId)));
  }, [setNodes, setEdges]);

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
          onClick: () => onNodeClick({} as React.MouseEvent, node),
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
  }, [data, expandedNodes, setNodes, setEdges, onNodeClick, onExpandMap, handleExpandNode, handleDeleteNode, expandingNodes]);

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

  const handleNewClick = () => {
    setIsConfirmOpen(true);
  };

  const handleConfirmNew = () => {
    setIsConfirmOpen(false);
    window.location.reload();
  };

  const handleArrangeNodes = useCallback(() => {
    const nodes = reactFlowInstance.getNodes();
    const edges = reactFlowInstance.getEdges();
    
    // 레벨별 노드 그룹화
    const nodesByLevel: { [key: number]: Node[] } = {};
    
    // 루트 노드 찾기
    const rootNode = nodes.find(node => !edges.some(edge => edge.target === node.id));
    if (!rootNode) return;
    
    // 레벨별로 노드 분류
    const assignLevel = (nodeId: string, level: number) => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;
      
      if (!nodesByLevel[level]) {
        nodesByLevel[level] = [];
      }
      nodesByLevel[level].push(node);
      
      // 자식 노드들 찾기
      const childEdges = edges.filter(e => e.source === nodeId);
      childEdges.forEach(edge => {
        assignLevel(edge.target, level + 1);
      });
    };
    
    // 레벨 할당 시작
    assignLevel(rootNode.id, 0);
    
    // 새로운 노드 배열 생성
    const newNodes = [...nodes];
    
    // 레벨별로 노드 위치 재조정
    const horizontalSpacing = 300;
    const verticalSpacing = 150;
    
    Object.entries(nodesByLevel).forEach(([level, levelNodes]) => {
      const numLevel = parseInt(level);
      const xPosition = numLevel * horizontalSpacing;
      
      levelNodes.forEach((node, index) => {
        const totalHeight = (levelNodes.length - 1) * verticalSpacing;
        const yStart = -totalHeight / 2;
        const yPosition = yStart + (index * verticalSpacing);
        
        const nodeIndex = newNodes.findIndex(n => n.id === node.id);
        if (nodeIndex !== -1) {
          newNodes[nodeIndex] = {
            ...newNodes[nodeIndex],
            position: { x: xPosition, y: yPosition }
          };
        }
      });
    });
    
    // 모든 노드 한 번에 업데이트
    setNodes(newNodes);
    
    // 뷰포트 조정
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.2 });
    }, 50);
  }, [reactFlowInstance, setNodes]);

  // 노드 드래그 시작/종료 핸들러 추가
  const onNodeDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const onNodeDragStop = useCallback(() => {
    setIsDragging(false);
  }, []);

  // onNodesChange를 래핑하는 새로운 핸들러
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    const positionChanges = changes.some(
      change => change.type === 'position'
    );
    if (positionChanges) {
      setIsPositionChanging(true);
      // 위치 변경 후 짧은 시간 뒤에 상태 리셋
      setTimeout(() => setIsPositionChanging(false), 100);
    }
    onNodesChange(changes);
  }, [onNodesChange]);

  // data가 변경될 때 자동으로 정리하기 실행
  useEffect(() => {
    if (!data || isDragging || isEditing || isPositionChanging) return;
    
    const timeoutId = setTimeout(() => {
      handleArrangeNodes();
    }, 100);

    return () => clearTimeout(timeoutId);
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
                    By creating a new mind map, this one will be lost. If you
                    want to keep it, make sure to download it as a JSON or
                    Markdown file.
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
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={handleNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              onNodeClick={onNodeClick}
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
              <>
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
              </>
            ) : (
              <>
                <div className="flex justify-between items-center">
                  <SheetTitle className="text-2xl mt-4 font-bold">
                    {selectedSubtopic?.name}
                  </SheetTitle>
                  <Button
                    onClick={() => setIsEditing(true)}
                    variant="outline"
                    size="sm"
                  >
                    수정
                  </Button>
                </div>
                <SheetDescription className="mb-2 text-gray-700">
                  {selectedSubtopic?.details}
                </SheetDescription>
              </>
            )}
          </SheetHeader>
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
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default MindMap;
