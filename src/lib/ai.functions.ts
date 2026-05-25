import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

async function callGateway(body: unknown) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (res.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
  if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
  if (!res.ok) {
    const t = await res.text();
    console.error("AI gateway error", res.status, t);
    throw new Error("AI service unavailable");
  }
  return res.json();
}

/* ---------------- Resume Analysis ---------------- */

const analyzeSchema = z.object({
  resumeId: z.string().uuid(),
  rawText: z.string().min(20).max(20000),
});

export const analyzeResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => analyzeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const tools = [
      {
        type: "function",
        function: {
          name: "report_resume_analysis",
          description: "Return structured resume analysis.",
          parameters: {
            type: "object",
            properties: {
              summary: { type: "string", description: "2-3 sentence professional summary" },
              strengths: { type: "array", items: { type: "string" } },
              gaps: { type: "array", items: { type: "string" } },
              skills: { type: "array", items: { type: "string" } },
              experience_level: { type: "string", enum: ["entry", "mid", "senior", "lead"] },
              career_paths: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    fit_score: { type: "number", minimum: 0, maximum: 100 },
                    why: { type: "string" },
                    next_steps: { type: "array", items: { type: "string" } },
                  },
                  required: ["title", "fit_score", "why", "next_steps"],
                },
              },
              projects: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
                    description: { type: "string" },
                    tech: { type: "array", items: { type: "string" } },
                  },
                  required: ["title", "difficulty", "description", "tech"],
                },
              },
            },
            required: ["summary", "strengths", "gaps", "skills", "experience_level", "career_paths", "projects"],
            additionalProperties: false,
          },
        },
      },
    ];

    const result = await callGateway({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are NeuroHire, a multi-agent career assistant. Analyze the resume rigorously. Return 3-5 career paths with realistic fit scores, and 3-5 portfolio project ideas tailored to the candidate's gaps.",
        },
        { role: "user", content: `Resume:\n\n${data.rawText}` },
      ],
      tools,
      tool_choice: { type: "function", function: { name: "report_resume_analysis" } },
    });

    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI returned no analysis");
    const analysis = JSON.parse(toolCall.function.arguments);

    const { error } = await supabase
      .from("resumes")
      .update({ analysis })
      .eq("id", data.resumeId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    return { analysis };
  });

/* ---------------- Mock Interview ---------------- */

const interviewSchema = z.object({
  sessionId: z.string().uuid(),
  userMessage: z.string().min(1).max(4000).optional(),
  start: z.boolean().optional(),
});

export const interviewTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => interviewSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: session, error: sErr } = await supabase
      .from("interview_sessions")
      .select("*")
      .eq("id", data.sessionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!session) throw new Error("Session not found");

    const history = (session.messages as Array<{ role: string; content: string }>) || [];
    const systemPrompt = `You are NeuroHire, conducting a ${session.difficulty}-level mock interview for the role: ${session.role}.
Ask one focused question at a time. After the candidate answers, briefly acknowledge then ask a follow-up or move to the next topic.
Cover: behavioral, technical depth, and problem-solving. Be encouraging but rigorous. Keep responses under 120 words.`;

    const newHistory = [...history];
    if (data.start && history.length === 0) {
      // kick off
    } else if (data.userMessage) {
      newHistory.push({ role: "user", content: data.userMessage });
    } else {
      throw new Error("No input");
    }

    const result = await callGateway({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...newHistory,
        ...(data.start && history.length === 0
          ? [{ role: "user", content: "Please begin the interview with your first question." }]
          : []),
      ],
    });

    const reply = result.choices?.[0]?.message?.content ?? "";
    newHistory.push({ role: "assistant", content: reply });

    const { error: uErr } = await supabase
      .from("interview_sessions")
      .update({ messages: newHistory })
      .eq("id", data.sessionId)
      .eq("user_id", userId);
    if (uErr) throw new Error(uErr.message);

    return { reply, messages: newHistory };
  });

/* ---------------- Interview Feedback ---------------- */

export const interviewFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sessionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: session } = await supabase
      .from("interview_sessions")
      .select("*")
      .eq("id", data.sessionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!session) throw new Error("Session not found");

    const transcript = (session.messages as Array<{ role: string; content: string }>)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    const tools = [
      {
        type: "function",
        function: {
          name: "report_feedback",
          parameters: {
            type: "object",
            properties: {
              overall_score: { type: "number", minimum: 0, maximum: 100 },
              communication: { type: "number", minimum: 0, maximum: 100 },
              technical: { type: "number", minimum: 0, maximum: 100 },
              problem_solving: { type: "number", minimum: 0, maximum: 100 },
              strengths: { type: "array", items: { type: "string" } },
              improvements: { type: "array", items: { type: "string" } },
              summary: { type: "string" },
            },
            required: ["overall_score", "communication", "technical", "problem_solving", "strengths", "improvements", "summary"],
            additionalProperties: false,
          },
        },
      },
    ];

    const result = await callGateway({
      model: MODEL,
      messages: [
        { role: "system", content: `You are evaluating a mock interview for: ${session.role}. Provide rigorous, fair feedback.` },
        { role: "user", content: `Transcript:\n\n${transcript}` },
      ],
      tools,
      tool_choice: { type: "function", function: { name: "report_feedback" } },
    });

    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI returned no feedback");
    const feedback = JSON.parse(toolCall.function.arguments);

    await supabase
      .from("interview_sessions")
      .update({ feedback })
      .eq("id", data.sessionId)
      .eq("user_id", userId);

    return { feedback };
  });
