"use server";

import { headers } from "next/headers";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { generateObject, generateText } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/src";
import { interview as interviewTable, interviewTurn as interviewTurnTable } from "@/src/db/schema";

const aiModel = google("gemini-2.5-flash-lite");

const startInterviewSchema = z.object({
  topic: z.string().min(1).max(180),
  durationMinutes: z.number().int().min(5).max(120),
  difficulty: z.string().min(1).max(80).default("intermediate"),
  tone: z.string().min(1).max(80).default("professional"),
  customContext: z.string().max(1200).optional(),
});

const interviewIdSchema = z.object({
  interviewId: z.string().min(1),
});

const submitAnswerSchema = z.object({
  interviewId: z.string().min(1),
  answer: z.string().min(5).max(6000),
});

const answerEvaluationSchema = z.object({
  score: z.number().int().min(0).max(10),
  feedback: z.string().min(8).max(300),
  competency: z.string().min(3).max(120),
});

const outfitReportSchema = z.object({
  totalRating: z.number().int().min(0).max(100),
  summary: z.string().min(20).max(400),
  whatLooksGood: z.array(z.string().min(3).max(180)).min(2).max(5),
  whatToImprove: z.array(z.string().min(3).max(180)).min(2).max(6),
  categoryScores: z.object({
    professionalism: z.number().int().min(0).max(100),
    neatness: z.number().int().min(0).max(100),
    colorCoordination: z.number().int().min(0).max(100),
    interviewReadiness: z.number().int().min(0).max(100),
  }),
});

const finalReportSchema = z.object({
  summary: z.string().min(30).max(900),
  hireRecommendation: z.enum(["Strong Hire", "Hire", "Hold", "No Hire"]),
  keyStrengths: z.array(z.string().min(3).max(180)).min(2).max(6),
  improvementAreas: z.array(z.string().min(3).max(180)).min(2).max(6),
  nextSteps: z.array(z.string().min(3).max(220)).min(2).max(6),
  insightMetrics: z.object({
    knowledgeDepth: z.number().int().min(0).max(100),
    problemSolving: z.number().int().min(0).max(100),
    communicationClarity: z.number().int().min(0).max(100),
    consistency: z.number().int().min(0).max(100),
  }),
  outfitReport: outfitReportSchema.nullable().optional(),
});

const saveOutfitReportSchema = z.object({
  interviewId: z.string().min(1),
  outfitReport: outfitReportSchema,
});

type InterviewRow = typeof interviewTable.$inferSelect;
type InterviewTurnRow = typeof interviewTurnTable.$inferSelect;

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type InterviewTurnView = {
  id: string;
  questionIndex: number;
  question: string;
  answer: string;
  score: number | null;
  feedback: string | null;
  competency: string | null;
  createdAt: string;
};

export type FinalInterviewReport = {
  summary: string;
  hireRecommendation: "Strong Hire" | "Hire" | "Hold" | "No Hire";
  keyStrengths: string[];
  improvementAreas: string[];
  nextSteps: string[];
  insightMetrics: {
    knowledgeDepth: number;
    problemSolving: number;
    communicationClarity: number;
    consistency: number;
  };
  outfitReport?: OutfitReport | null;
};

export type OutfitReport = z.infer<typeof outfitReportSchema>;

export type InterviewSummaryView = {
  interviewId: string;
  topic: string;
  difficulty: string;
  tone: string;
  status: "active" | "completed";
  startedAt: string;
  completedAt: string | null;
  turnsCount: number;
  finalScore: number | null;
  summary: string | null;
  hireRecommendation: FinalInterviewReport["hireRecommendation"] | null;
  outfitRating: number | null;
  topImprovements: string[];
};

export type InterviewSessionView = {
  interviewId: string;
  topic: string;
  durationMinutes: number;
  difficulty: string;
  tone: string;
  customContext: string | null;
  status: "active" | "completed";
  startedAt: string;
  endsAt: string;
  completedAt: string | null;
  secondsRemaining: number;
  currentQuestion: string | null;
  currentQuestionIndex: number;
  turns: InterviewTurnView[];
  finalScore: number | null;
  finalReport: FinalInterviewReport | null;
};

const topicLabels: Record<string, string> = {
  react: "React, Next.js & UI Architecture",
  node: "Node.js, APIs & Microservices",
  sysdesign: "Distributed Systems & Scalability",
  behavioral: "Behavioral, Leadership & Culture",
  python: "Python, AI & Data Engineering",
  agile: "Agile, Product Strategy & Execution",
};

function normalizeTopic(topic: string) {
  return topicLabels[topic] ?? topic;
}

function dateToIso(value: Date | null) {
  return value ? value.toISOString() : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function computeSecondsRemaining(endsAt: Date) {
  const deltaMs = endsAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(deltaMs / 1000));
}

function toTurnView(turn: InterviewTurnRow, redactEvaluation: boolean): InterviewTurnView {
  return {
    id: turn.id,
    questionIndex: turn.questionIndex,
    question: turn.question,
    answer: turn.answer,
    score: redactEvaluation ? null : turn.score,
    feedback: redactEvaluation ? null : turn.feedback,
    competency: redactEvaluation ? null : turn.competency,
    createdAt: turn.createdAt.toISOString(),
  };
}

function parseFinalReport(raw: unknown): FinalInterviewReport | null {
  const parsed = finalReportSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

function extractOutfitReport(raw: unknown): OutfitReport | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const value = raw as { outfitReport?: unknown };
  const parsed = outfitReportSchema.safeParse(value.outfitReport);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

function buildView(row: InterviewRow, turns: InterviewTurnRow[]): InterviewSessionView {
  const redactEvaluation = row.status !== "completed";

  return {
    interviewId: row.id,
    topic: row.topic,
    durationMinutes: row.durationMinutes,
    difficulty: row.difficulty,
    tone: row.tone,
    customContext: row.customContext,
    status: row.status === "completed" ? "completed" : "active",
    startedAt: row.startedAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    completedAt: dateToIso(row.completedAt),
    secondsRemaining: row.status === "completed" ? 0 : computeSecondsRemaining(row.endsAt),
    currentQuestion: row.status === "completed" ? null : row.pendingQuestion,
    currentQuestionIndex: row.nextQuestionIndex,
    turns: turns.map((turn) => toTurnView(turn, redactEvaluation)),
    finalScore: row.finalScore,
    finalReport: parseFinalReport(row.finalReport),
  };
}

async function requireUserId() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    throw new Error("You must be signed in to continue.");
  }

  return session.user.id;
}

async function getOwnedInterview(interviewId: string, userId: string) {
  const row = await db.query.interview.findFirst({
    where: and(eq(interviewTable.id, interviewId), eq(interviewTable.userId, userId)),
  });

  if (!row) {
    throw new Error("Interview not found.");
  }

  return row;
}

async function getInterviewTurns(interviewId: string) {
  return db.query.interviewTurn.findMany({
    where: eq(interviewTurnTable.interviewId, interviewId),
    orderBy: asc(interviewTurnTable.questionIndex),
  });
}

function fallbackQuestion(topic: string, index: number) {
  return `Question ${index}: In ${topic}, explain how you would approach a realistic production issue end-to-end and justify your trade-offs.`;
}

async function generateNextQuestion(params: {
  topic: string;
  difficulty: string;
  tone: string;
  customContext?: string | null;
  nextQuestionIndex: number;
  turns: InterviewTurnRow[];
}) {
  const previousTurns =
    params.turns.length === 0
      ? "None yet."
      : params.turns
          .slice(-6)
          .map(
            (turn) =>
              `Q${turn.questionIndex}: ${turn.question}\nA${turn.questionIndex}: ${turn.answer}\nScore: ${turn.score}/10\nFeedback: ${turn.feedback}`,
          )
          .join("\n\n");

  try {
    const { text } = await generateText({
      model: aiModel,
      prompt: `You are a senior interviewer.

Create the next interview question for this live interview:
- Topic: ${params.topic}
- Difficulty: ${params.difficulty}
- Tone: ${params.tone}
- Question number to generate: ${params.nextQuestionIndex}
- Optional role/company context: ${params.customContext?.trim() || "None"}

Previous turns:
${previousTurns}

Rules:
- Return exactly one question.
- Keep it concise and practical.
- Do not include explanation, numbering, markdown, or extra text.
- Avoid repeating the exact same question.
- Match the stated tone and difficulty.`,
    });

    const question = text.replace(/^[-\d\.\s]+/, "").trim();
    return question || fallbackQuestion(params.topic, params.nextQuestionIndex);
  } catch {
    return fallbackQuestion(params.topic, params.nextQuestionIndex);
  }
}

async function evaluateAnswer(params: {
  topic: string;
  question: string;
  answer: string;
  difficulty: string;
}) {
  try {
    const { object } = await generateObject({
      model: aiModel,
      schema: answerEvaluationSchema,
      prompt: `You are evaluating a candidate answer in a ${params.topic} interview.

Difficulty: ${params.difficulty}
Question: ${params.question}
Candidate answer: ${params.answer}

Scoring rules:
- score: integer 0 to 10
- feedback: one short paragraph with specific critique and one concrete improvement tip
- competency: the primary skill being measured (e.g., "System Design", "React State Management", "API Design")

Be strict but fair.`,
    });

    return object;
  } catch {
    const lengthScore = clamp(Math.round(params.answer.trim().split(/\s+/).length / 18), 1, 6);
    return {
      score: lengthScore,
      feedback:
        "The response has partial relevance but needs more technical depth, examples, and clearer trade-off discussion.",
      competency: "Technical Communication",
    };
  }
}

function computeFallbackReport(turns: InterviewTurnRow[]): FinalInterviewReport {
  const count = Math.max(1, turns.length);
  const scores = turns.map((turn) => turn.score);
  const average = scores.reduce((sum, score) => sum + score, 0) / count;

  const variance =
    scores.reduce((sum, score) => sum + (score - average) ** 2, 0) / count;
  const stdDev = Math.sqrt(variance);

  const avgAnswerWords =
    turns.reduce((sum, turn) => sum + turn.answer.trim().split(/\s+/).length, 0) / count;

  const knowledgeDepth = clamp(Math.round((average / 10) * 100), 0, 100);
  const problemSolving = clamp(Math.round((scores.filter((score) => score >= 7).length / count) * 100), 0, 100);
  const communicationClarity = clamp(Math.round((avgAnswerWords / 90) * 100), 0, 100);
  const consistency = clamp(Math.round((1 - stdDev / 4.5) * 100), 0, 100);

  let hireRecommendation: FinalInterviewReport["hireRecommendation"] = "No Hire";
  if (knowledgeDepth >= 80) {
    hireRecommendation = "Strong Hire";
  } else if (knowledgeDepth >= 65) {
    hireRecommendation = "Hire";
  } else if (knowledgeDepth >= 50) {
    hireRecommendation = "Hold";
  }

  return {
    summary:
      "The interview indicates core understanding in parts of the topic, but outcomes suggest inconsistency under pressure and room for sharper structured problem-solving.",
    hireRecommendation,
    keyStrengths: [
      "Engages with technical prompts and attempts structured answers",
      "Shows workable baseline knowledge in the selected domain",
    ],
    improvementAreas: [
      "Increase depth in trade-off analysis and edge-case handling",
      "Use more concrete architecture examples with measurable reasoning",
    ],
    nextSteps: [
      "Practice timed mock interviews with strict follow-up questions",
      "Build one production-style project and present design decisions",
    ],
    insightMetrics: {
      knowledgeDepth,
      problemSolving,
      communicationClarity,
      consistency,
    },
  };
}

async function generateFinalReport(params: {
  topic: string;
  difficulty: string;
  tone: string;
  turns: InterviewTurnRow[];
}) {
  const transcript = params.turns
    .map(
      (turn) =>
        `Question ${turn.questionIndex}: ${turn.question}\nAnswer: ${turn.answer}\nScore: ${turn.score}/10\nFeedback: ${turn.feedback}`,
    )
    .join("\n\n");

  try {
    const { object } = await generateObject({
      model: aiModel,
      schema: finalReportSchema,
      prompt: `Create a final interview assessment report for this completed session.

Topic: ${params.topic}
Difficulty: ${params.difficulty}
Tone used during interview: ${params.tone}

Transcript with turn scores:
${transcript}

Report requirements:
- summary: concise but insightful assessment
- hireRecommendation: one of Strong Hire, Hire, Hold, No Hire
- keyStrengths: practical strengths demonstrated
- improvementAreas: specific points to improve
- nextSteps: concrete candidate improvement plan
- insightMetrics: integer 0-100 scores for knowledgeDepth, problemSolving, communicationClarity, consistency

Use evidence from transcript, avoid generic filler.`,
    });

    return object;
  } catch {
    return computeFallbackReport(params.turns);
  }
}

async function completeInterviewInternal(row: InterviewRow, turns: InterviewTurnRow[]) {
  const outfitReport = extractOutfitReport(row.finalReport);

  if (turns.length === 0) {
    const emptyReport: FinalInterviewReport = {
      ...computeFallbackReport(turns),
      outfitReport,
    };

    const [updated] = await db
      .update(interviewTable)
      .set({
        status: "completed",
        completedAt: new Date(),
        pendingQuestion: null,
        finalScore: 0,
        finalReport: emptyReport,
      })
      .where(eq(interviewTable.id, row.id))
      .returning();

    return updated;
  }

  const finalReport = await generateFinalReport({
    topic: row.topic,
    difficulty: row.difficulty,
    tone: row.tone,
    turns,
  });

  const mergedFinalReport: FinalInterviewReport = {
    ...finalReport,
    outfitReport,
  };

  const average = turns.reduce((sum, turn) => sum + turn.score, 0) / turns.length;
  const finalScore = clamp(Math.round(average * 10), 0, 100);

  const [updated] = await db
    .update(interviewTable)
    .set({
      status: "completed",
      completedAt: new Date(),
      pendingQuestion: null,
      finalScore,
      finalReport: mergedFinalReport,
    })
    .where(eq(interviewTable.id, row.id))
    .returning();

  return updated;
}

export async function startInterview(input: {
  topic: string;
  durationMinutes: number;
  difficulty?: string;
  tone?: string;
  customContext?: string;
}): Promise<ActionResult<InterviewSessionView>> {
  try {
    const parsed = startInterviewSchema.parse(input);
    const userId = await requireUserId();

    const topic = normalizeTopic(parsed.topic);
    const now = new Date();
    const endsAt = new Date(now.getTime() + parsed.durationMinutes * 60 * 1000);
    const interviewId = crypto.randomUUID();

    const firstQuestion = await generateNextQuestion({
      topic,
      difficulty: parsed.difficulty,
      tone: parsed.tone,
      customContext: parsed.customContext,
      nextQuestionIndex: 1,
      turns: [],
    });

    const [created] = await db
      .insert(interviewTable)
      .values({
        id: interviewId,
        userId,
        topic,
        durationMinutes: parsed.durationMinutes,
        difficulty: parsed.difficulty,
        tone: parsed.tone,
        customContext: parsed.customContext ?? null,
        status: "active",
        nextQuestionIndex: 1,
        pendingQuestion: firstQuestion,
        startedAt: now,
        endsAt,
      })
      .returning();

    return {
      ok: true,
      data: buildView(created, []),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start interview.";
    return { ok: false, error: message };
  }
}

export async function getInterviewSession(input: {
  interviewId: string;
}): Promise<ActionResult<InterviewSessionView>> {
  try {
    const parsed = interviewIdSchema.parse(input);
    const userId = await requireUserId();

    let row = await getOwnedInterview(parsed.interviewId, userId);
    let turns = await getInterviewTurns(parsed.interviewId);

    if (row.status !== "completed" && row.endsAt.getTime() <= Date.now()) {
      row = await completeInterviewInternal(row, turns);
      turns = await getInterviewTurns(row.id);
      return { ok: true, data: buildView(row, turns) };
    }

    if (row.status !== "completed" && !row.pendingQuestion) {
      const generatedQuestion = await generateNextQuestion({
        topic: row.topic,
        difficulty: row.difficulty,
        tone: row.tone,
        customContext: row.customContext,
        nextQuestionIndex: row.nextQuestionIndex,
        turns,
      });

      const [updated] = await db
        .update(interviewTable)
        .set({ pendingQuestion: generatedQuestion })
        .where(eq(interviewTable.id, row.id))
        .returning();

      row = updated;
    }

    return {
      ok: true,
      data: buildView(row, turns),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load interview.";
    return { ok: false, error: message };
  }
}

export async function submitInterviewAnswer(input: {
  interviewId: string;
  answer: string;
}): Promise<ActionResult<InterviewSessionView>> {
  try {
    const parsed = submitAnswerSchema.parse(input);
    const userId = await requireUserId();

    let row = await getOwnedInterview(parsed.interviewId, userId);

    if (row.status === "completed") {
      const turns = await getInterviewTurns(row.id);
      return { ok: true, data: buildView(row, turns) };
    }

    const existingTurns = await getInterviewTurns(row.id);

    const currentQuestion =
      row.pendingQuestion ||
      (await generateNextQuestion({
        topic: row.topic,
        difficulty: row.difficulty,
        tone: row.tone,
        customContext: row.customContext,
        nextQuestionIndex: row.nextQuestionIndex,
        turns: existingTurns,
      }));

    const evaluation = await evaluateAnswer({
      topic: row.topic,
      question: currentQuestion,
      answer: parsed.answer,
      difficulty: row.difficulty,
    });

    await db.insert(interviewTurnTable).values({
      id: crypto.randomUUID(),
      interviewId: row.id,
      questionIndex: row.nextQuestionIndex,
      question: currentQuestion,
      answer: parsed.answer,
      score: evaluation.score,
      feedback: evaluation.feedback,
      competency: evaluation.competency,
    });

    const updatedTurns = await getInterviewTurns(row.id);

    if (row.endsAt.getTime() <= Date.now()) {
      row = await completeInterviewInternal(row, updatedTurns);
      const completedTurns = await getInterviewTurns(row.id);
      return { ok: true, data: buildView(row, completedTurns) };
    }

    const nextQuestionIndex = row.nextQuestionIndex + 1;
    const nextQuestion = await generateNextQuestion({
      topic: row.topic,
      difficulty: row.difficulty,
      tone: row.tone,
      customContext: row.customContext,
      nextQuestionIndex,
      turns: updatedTurns,
    });

    const [updatedInterview] = await db
      .update(interviewTable)
      .set({
        nextQuestionIndex,
        pendingQuestion: nextQuestion,
      })
      .where(eq(interviewTable.id, row.id))
      .returning();

    return {
      ok: true,
      data: buildView(updatedInterview, updatedTurns),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to submit answer.";
    return { ok: false, error: message };
  }
}

export async function completeInterview(input: {
  interviewId: string;
}): Promise<ActionResult<InterviewSessionView>> {
  try {
    const parsed = interviewIdSchema.parse(input);
    const userId = await requireUserId();

    let row = await getOwnedInterview(parsed.interviewId, userId);
    let turns = await getInterviewTurns(row.id);

    if (row.status !== "completed") {
      row = await completeInterviewInternal(row, turns);
      turns = await getInterviewTurns(row.id);
    }

    return {
      ok: true,
      data: buildView(row, turns),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to complete interview.";
    return { ok: false, error: message };
  }
}

export async function saveInterviewOutfitReport(input: {
  interviewId: string;
  outfitReport: OutfitReport;
}): Promise<ActionResult<{ interviewId: string; outfitReport: OutfitReport }>> {
  try {
    const parsed = saveOutfitReportSchema.parse(input);
    const userId = await requireUserId();
    const row = await getOwnedInterview(parsed.interviewId, userId);

    const baseReport =
      row.finalReport && typeof row.finalReport === "object"
        ? (row.finalReport as Record<string, unknown>)
        : {};

    await db
      .update(interviewTable)
      .set({
        finalReport: {
          ...baseReport,
          outfitReport: parsed.outfitReport,
        },
      })
      .where(eq(interviewTable.id, row.id));

    return {
      ok: true,
      data: {
        interviewId: row.id,
        outfitReport: parsed.outfitReport,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save outfit report.";
    return { ok: false, error: message };
  }
}

export async function listInterviewSummaries(): Promise<ActionResult<InterviewSummaryView[]>> {
  try {
    const userId = await requireUserId();

    const rows = await db.query.interview.findMany({
      where: eq(interviewTable.userId, userId),
      orderBy: desc(interviewTable.startedAt),
      limit: 50,
    });

    if (rows.length === 0) {
      return { ok: true, data: [] };
    }

    const interviewIds = rows.map((row) => row.id);
    const turns = await db.query.interviewTurn.findMany({
      where: inArray(interviewTurnTable.interviewId, interviewIds),
      columns: {
        interviewId: true,
      },
    });

    const turnsCountByInterview = new Map<string, number>();
    for (const turn of turns) {
      turnsCountByInterview.set(turn.interviewId, (turnsCountByInterview.get(turn.interviewId) ?? 0) + 1);
    }

    const summaries: InterviewSummaryView[] = rows.map((row) => {
      const finalReport = parseFinalReport(row.finalReport);
      const outfitReport = extractOutfitReport(row.finalReport);

      return {
        interviewId: row.id,
        topic: row.topic,
        difficulty: row.difficulty,
        tone: row.tone,
        status: row.status === "completed" ? "completed" : "active",
        startedAt: row.startedAt.toISOString(),
        completedAt: dateToIso(row.completedAt),
        turnsCount: turnsCountByInterview.get(row.id) ?? 0,
        finalScore: row.finalScore,
        summary: finalReport?.summary ?? null,
        hireRecommendation: finalReport?.hireRecommendation ?? null,
        outfitRating: finalReport?.outfitReport?.totalRating ?? outfitReport?.totalRating ?? null,
        topImprovements: finalReport?.improvementAreas.slice(0, 2) ?? outfitReport?.whatToImprove.slice(0, 2) ?? [],
      };
    });

    return {
      ok: true,
      data: summaries,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load interview summaries.";
    return { ok: false, error: message };
  }
}
