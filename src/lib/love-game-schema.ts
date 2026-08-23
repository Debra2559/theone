import { z } from "zod";

const dimensionValue = z.number().finite().min(0).max(100);

const dimensionMap = z
  .record(z.string().min(1).max(40), dimensionValue)
  .refine((value) => Object.keys(value).length <= 12, "维度数量不能超过 12 个");

const evidenceItem = z
  .object({
    scene: z.string().max(160).optional(),
    act: z.number().int().min(1).max(30).optional(),
    choice: z.string().max(400).optional(),
    note: z.string().max(400).optional(),
    weight: z.number().finite().min(-10).max(10).optional(),
  })
  .strict();

const stageStat = z
  .object({
    label: z.string().max(80).optional(),
    count: z.number().int().min(0).max(30).optional(),
    dims: dimensionMap.optional(),
  })
  .strict();

export const loveGameProfileSchema = z
  .object({
    schema_version: z.string().max(20).optional(),
    nickname: z.string().max(40).optional(),
    generated_at: z.string().max(40).optional(),
    archetype: z.string().max(80).optional(),
    archetype_name: z.string().max(80).optional(),
    archetype_emoji: z.string().max(16).optional(),
    dimensions: dimensionMap.optional(),
    dimensions_detail: z
      .array(
        z
          .object({
            key: z.string().max(40).optional(),
            label: z.string().max(80).optional(),
            value: dimensionValue.optional(),
            anchor: z.string().max(80).optional(),
            low: z.string().max(80).optional(),
            high: z.string().max(80).optional(),
          })
          .strict(),
      )
      .max(12)
      .optional(),
    dimension_confidence: z
      .record(z.string().min(1).max(40), z.number().int().min(0).max(30))
      .optional(),
    evidence: z
      .record(z.string().min(1).max(40), z.array(evidenceItem).max(4))
      .refine((value) => Object.keys(value).length <= 12, "证据维度不能超过 12 个")
      .optional(),
    stage_stats: z
      .record(z.string().min(1).max(40), stageStat)
      .refine((value) => Object.keys(value).length <= 5, "阶段数量不能超过 5 个")
      .optional(),
    communicate_password: z.array(z.string().max(240)).max(8).optional(),
    relationship_pattern: z.array(z.string().max(240)).max(8).optional(),
    friction_alerts: z.array(z.string().max(240)).max(8).optional(),
    hidden_strengths: z.array(z.string().max(240)).max(8).optional(),
    growth_advice: z.array(z.string().max(240)).max(8).optional(),
    sub_style: z.string().max(100).optional(),
    ideal_partner: z
      .object({
        archetype: z.string().max(80).optional(),
        archetype_name: z.string().max(80).optional(),
        archetype_emoji: z.string().max(16).optional(),
        tagline: z.string().max(240).optional(),
        match_points: z.array(z.string().max(240)).max(8).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const loveGameChoiceSchema = z
  .object({
    scenarioId: z.string().min(1).max(40),
    stage: z.string().max(40).optional(),
    title: z.string().max(120).optional(),
    act: z.number().int().min(1).max(30).optional(),
    optionIndex: z.number().int().min(0).max(5),
    optionText: z.string().max(400),
    insight: z.string().max(400).optional(),
    weights: z.record(z.string().min(1).max(40), z.number().finite().min(-10).max(10)).optional(),
  })
  .strict();

export const loveGameStageStatsSchema = z
  .record(z.string().min(1).max(40), stageStat)
  .refine((value) => Object.keys(value).length <= 5, "阶段数量不能超过 5 个");

export const loveGameResultSchema = z
  .object({
    type: z.string().max(80),
    label: z.string().max(120),
    summary: z.string().max(1200),
    detail: loveGameProfileSchema,
  })
  .strict();

export const loveGameAnswersSchema = z
  .object({
    choices: z.array(loveGameChoiceSchema).max(30),
    stageStats: loveGameStageStatsSchema,
  })
  .strict();

export const loveGameMessageSchema = z
  .object({
    type: z.literal("love-game:result"),
    payload: z
      .object({
        profile: loveGameProfileSchema,
        choices: z.array(loveGameChoiceSchema).max(30),
        stageStats: loveGameStageStatsSchema.optional(),
        answeredAt: z.string().datetime().optional(),
      })
      .strict(),
  })
  .strict();

export type LoveGamePayload = z.infer<typeof loveGameMessageSchema>["payload"];
