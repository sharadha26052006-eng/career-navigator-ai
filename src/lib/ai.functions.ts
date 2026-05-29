import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

async function callGateway(body: unknown) {
 const key = process.env.GROQ_API_KEY || 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;
  if (!key) throw new Error("VITE_GROQ_API_KEY not configured");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (res.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
  if (!res.ok) {
    const t = await res.text();
    console.error("Groq error", res.status, t);
    throw new Error(`AI error ${res.status}: ${t}`);
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

    const result = await callGateway({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are NeuroHire, a multi-agent career assistant. Analyze the resume and return a JSON object with these fields:
{
  "summary": "2-3 sentence professional summary",
  "strengths": ["strength1", "strength2"],
  "gaps": ["gap1", "gap2"],
  "skills": ["skill1", "skill2"],
  "experience_level": "entry|mid|senior|lead",
  "career_paths": [
    {
      "title": "Role Title",
      "fit_score": 85,
      "why": "reason",
      "next_steps": ["step1", "step2"]
    }
  ],
  "projects": [
    {
      "title": "Project Title",
      "difficulty": "beginner|intermediate|advanced",
      "description": "description",
      "tech": ["tech1", "tech2"]
    }
  ]
}
Return ONLY the JSON object, no markdown, no explanation.`,
        },
        { role: "user", content: `Resume:\n\n${data.rawText}` },
      ],
    });

    const raw = result.choices?.[0]?.message?.content ?? "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const analysis = JSON.parse(clean);

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

    const result = await callGateway({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are evaluating a mock interview for: ${session.role}. Return a JSON object:
{
  "overall_score": 80,
  "communication": 75,
  "technical": 85,
  "problem_solving": 80,
  "strengths": ["strength1"],
  "improvements": ["improvement1"],
  "summary": "overall summary"
}
Return ONLY the JSON object, no markdown, no explanation.`,
        },
        { role: "user", content: `Transcript:\n\n${transcript}` },
      ],
    });

    const raw = result.choices?.[0]?.message?.content ?? "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const feedback = JSON.parse(clean);

    await supabase
      .from("interview_sessions")
      .update({ feedback })
      .eq("id", data.sessionId)
      .eq("user_id", userId);

    return { feedback };
  });