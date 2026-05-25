import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { interviewTurn, interviewFeedback } from "@/lib/ai.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Brain, User as UserIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/interview")({
  validateSearch: (s: Record<string, unknown>) => ({ role: typeof s.role === "string" ? s.role : undefined }),
  component: InterviewPage,
});

type Msg = { role: "user" | "assistant"; content: string };

function InterviewPage() {
  const { role: roleParam } = Route.useSearch();
  const turn = useServerFn(interviewTurn);
  const feedback = useServerFn(interviewFeedback);

  const [role, setRole] = useState(roleParam || "");
  const [difficulty, setDifficulty] = useState("mid");
  const [session, setSession] = useState<{ id: string; messages: Msg[]; feedback: any } | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [session?.messages.length]);

  const startInterview = async () => {
    if (!role.trim()) return toast.error("Enter a role");
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("interview_sessions")
        .insert({ user_id: user.id, role, difficulty })
        .select()
        .single();
      if (error) throw error;
      const res = await turn({ data: { sessionId: data.id, start: true } });
      setSession({ id: data.id, messages: res.messages as Msg[], feedback: null });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };

  const send = async () => {
    if (!session || !input.trim()) return;
    const text = input;
    setInput("");
    setSession({ ...session, messages: [...session.messages, { role: "user", content: text }] });
    setLoading(true);
    try {
      const res = await turn({ data: { sessionId: session.id, userMessage: text } });
      setSession({ ...session, messages: res.messages as Msg[] });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };

  const finish = async () => {
    if (!session) return;
    setEvaluating(true);
    try {
      const res = await feedback({ data: { sessionId: session.id } });
      setSession({ ...session, feedback: res.feedback });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setEvaluating(false); }
  };

  if (!session) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mock Interview</h1>
          <p className="mt-1 text-muted-foreground">Configure the role and difficulty to start.</p>
        </div>
        <Card className="bg-card/60">
          <CardHeader><CardTitle className="font-display">New session</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm">Role</label>
              <Input placeholder="e.g. Senior Backend Engineer" value={role} onChange={(e) => setRole(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm">Difficulty</label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entry">Entry</SelectItem>
                  <SelectItem value="mid">Mid</SelectItem>
                  <SelectItem value="senior">Senior</SelectItem>
                  <SelectItem value="lead">Lead / Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={startInterview} disabled={loading} className="w-full gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Start interview
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-xl font-semibold">{role}</div>
          <Badge variant="secondary" className="mt-1">{difficulty}</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={finish} disabled={evaluating || session.messages.length < 4}>
          {evaluating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Get feedback"}
        </Button>
      </div>

      <Card className="bg-card/60">
        <CardContent className="p-0">
          <div ref={scrollRef} className="max-h-[60vh] space-y-4 overflow-y-auto p-6">
            {session.messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${m.role === "user" ? "bg-secondary" : "bg-primary"}`}>
                  {m.role === "user" ? <UserIcon className="h-4 w-4" /> : <Brain className="h-4 w-4 text-primary-foreground" />}
                </div>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-secondary" : "bg-background/80 border border-border"}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…</div>}
          </div>
          <div className="flex gap-2 border-t border-border p-3">
            <Textarea
              placeholder="Your answer…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              className="min-h-[48px] resize-none"
            />
            <Button onClick={send} disabled={loading || !input.trim()}><Send className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {session.feedback && (
        <Card className="border-primary/40 bg-card/60">
          <CardHeader><CardTitle className="font-display">Feedback</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-3 text-center">
              <Stat label="Overall" v={session.feedback.overall_score} />
              <Stat label="Communication" v={session.feedback.communication} />
              <Stat label="Technical" v={session.feedback.technical} />
              <Stat label="Problem-solving" v={session.feedback.problem_solving} />
            </div>
            <p className="text-sm">{session.feedback.summary}</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 text-sm font-medium">Strengths</div>
                <ul className="space-y-1 text-sm text-muted-foreground">{session.feedback.strengths.map((s: string, i: number) => <li key={i}>• {s}</li>)}</ul>
              </div>
              <div>
                <div className="mb-2 text-sm font-medium">Improvements</div>
                <ul className="space-y-1 text-sm text-muted-foreground">{session.feedback.improvements.map((s: string, i: number) => <li key={i}>• {s}</li>)}</ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-3">
      <div className="font-display text-2xl font-semibold text-primary">{v}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
