import { z } from "zod";

export const LinkSchema = z.object({
  title: z.string(),
  type: z.string(),
  url: z.string(),
});

export type Link = z.infer<typeof LinkSchema>;

export type Subtopic = {
  name: string;
  details: string;
  links: Link[];
  subtopics?: Subtopic[];
};

export const SubtopicSchema: z.ZodType<Subtopic> = z.lazy(() =>
  z.object({
    name: z.string(),
    details: z.string(),
    links: z.array(LinkSchema),
    subtopics: z.array(SubtopicSchema).optional(),
  })
);

export const MindMapSchema = z.object({
  topic: z.string(),
  subtopics: z.array(SubtopicSchema),
});

export const FlatSubtopicSchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  name: z.string(),
  details: z.string(),
  links: z.array(LinkSchema),
});

export const FlatMindMapSchema = z.object({
  topic: z.string(),
  subtopics: z.array(FlatSubtopicSchema),
});

export type MindMapData = z.infer<typeof MindMapSchema>;

export const ExpandMapRequestSchema = z.object({
  topic: z.string(),
  nodeId: z.string(),
});

// app/lib/schemas.ts

// 1) 새로 생성할 type & schema
export const NodeDetailResponseSchema = z.object({
  taskDetail: z.string(),
  evaluationChecklist: z.array(z.string()),
});

export type NodeDetailResponse = z.infer<typeof NodeDetailResponseSchema>;


export type RRArray = z.infer<typeof RRArraySchema>;

// 기존 배열 스키마를 객체로 감싸기
export const RRResponseSchema = z.object({
  roles: z.array(
    z.object({
      role: z.string(),
      responsibility: z.string(),
      reason: z.string(),
    })
  )
});

export type RRResponse = z.infer<typeof RRResponseSchema>;
