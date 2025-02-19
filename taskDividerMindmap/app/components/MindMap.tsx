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
}> = ({
  name,
  onClick,
  onExpand,
  isExpanded,
  hasChildren,
  onExpandMap,
  nodeId,
  onDelete,
}) => {
  console.log('NodeContent rendered for:', { name, nodeId });
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className="p-4 rounded-md shadow-sm transition-all duration-300 ease-in-out cursor-pointer min-w-[12rem] bg-white hover:bg-gray-50 flex items-center justify-between"
          onClick={onClick}
        >
          <div className="text-lg font-bold text-center flex-grow">{name}</div>
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExpand();
              }}
              className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 flex-shrink-0"
            >
              {isExpanded ? (
                <ChevronDown size={20} />
              ) : (
                <ChevronRight size={20} />
              )}
            </button>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={(e) => {
            e.stopPropagation();
            console.log('Expand Map clicked for node:', { name, nodeId });
            onExpandMap(nodeId);
          }}
        >
          Expand Map
        </ContextMenuItem>
        {!isRoot && (
          <ContextMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onDelete(nodeId);
            }}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            Delete Node
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
  
  // 노드 ID 생성
  const nodeId = parentId 
    ? `${parentId}-${data.name.replace(/\s+/g, "-")}` 
    : data.name.replace(/\s+/g, "-");

  // 수평 위치 계산 - 레벨에 따라 간격 증가
  const xPos = x + (level * horizontalSpacing);
  
  // 현재 노드 추가
  nodes.push({
    id: nodeId,
    type: parentId ? (data.subtopics?.length ? "branch" : "leaf") : "root",
    position: { x: xPos, y },
    data: {
      ...data,
      parentId,
      isRoot: !parentId,
      isExpanded: true,
      hasChildren: data.subtopics?.length > 0,
      onClick: () => {},
      onExpand: () => onExpand(nodeId, parentId),
      nodeId, // nodeId 추가
    },
  });

  // 부모 노드와의 엣지 추가
  if (parentId) {
    edges.push({
      id: `${parentId}-${nodeId}`,
      source: parentId,
      target: nodeId,
      type: "mindmap",
      animated: true,
    });
  }

  // 하위 노드들 처리
  if (data.subtopics && data.subtopics.length > 0) {
    const childSpacing = verticalSpacing * 2; // 자식 노드 간의 간격
    const totalChildren = data.subtopics.length;
    const totalHeight = (totalChildren - 1) * childSpacing;
    const startY = y - (totalHeight / 2); // 중앙 정렬을 위한 시작 y 위치

    data.subtopics.forEach((subtopic, childIndex) => {
      const childY = startY + (childIndex * childSpacing);
      const {
        nodes: childNodes,
        edges: childEdges
      } = createNodesAndEdges(
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
  const [isLoading, setIsLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedSubtopic(node.data as Subtopic);
  }, []);

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
        },
      }))
    );
    setEdges(newEdges);
  }, [data, expandedNodes, setNodes, setEdges, onNodeClick, onExpandMap, handleExpandNode, handleDeleteNode]);

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
            </div>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              onNodeClick={onNodeClick}
              onInit={onInit}
              fitView
              minZoom={0.1}
              maxZoom={1.5}
              defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
              elementsSelectable={true}
              nodesDraggable={true}
              nodesConnectable={false}
              snapToGrid={true}
              snapGrid={[15, 15]}
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
        onOpenChange={() => setSelectedSubtopic(null)}
      >
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-2xl mt-4 font-bold">
              {selectedSubtopic?.name}
            </SheetTitle>
            <SheetDescription className="mb-2 text-gray-700">
              {selectedSubtopic?.details}
            </SheetDescription>
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
