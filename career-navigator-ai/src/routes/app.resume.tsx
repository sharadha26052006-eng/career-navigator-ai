import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { analyzeResume } from "@/lib/ai.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Sparkles, Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/resume")({
  component: ResumePage,
});

type Resume = { id: string; title: string; raw_text: string; analysis: any; created_at: string };

function ResumePage() {
  const analyze = useServerFn(analyzeResume);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [title, setTitle] = useState("My Resume");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Resume | null>(null);

  const refresh = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("resumes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setResumes((data as Resume[]) || []);
    if (data && data.length && !selected) setSelected(data[0] as Resume);
  };

  useEffect(() => { refresh(); }, []);

  const handleAnalyze = async () => {
    if (text.trim().length < 50) return toast.error("Paste your full resume text (min 50 chars).");
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data: inserted, error } = await supabase
        .from("resumes")
        .insert({ user_id: user.id, title, raw_text: text })
        .select()
        .single();
      if (error) throw error;
      await analyze({ data: { resumeId: inserted.id, rawText: text } });
      toast.success("Analysis complete");
      setText("");
      await refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("resumes").delete().eq("id", id);
    if (selected?.id === id) setSelected(null);
    refresh();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Resume Analyzer</h1>
        <p className="mt-1 text-muted-foreground">Paste your resume — the analyst agent extracts strengths, gaps, paths, and projects.</p>
      </div>

      <Card className="bg-card/60">
        <CardHeader><CardTitle className="font-display">New analysis</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Title (e.g. Senior PM resume)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea
            placeholder="Paste your resume text here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[200px] font-mono text-sm"
          />
          <Button onClick={handleAnalyze} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Analyzing…" : "Analyze with AI"}
          </Button>
        </CardContent>
      </Card>

      {resumes.length > 0 && (
        <div className="grid gap-6 md:grid-cols-[260px_1fr]">
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">History</div>
            {resumes.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className={`w-full rounded-lg border p-3 text-left transition ${
                  selected?.id === r.id ? "border-primary bg-primary/10" : "border-border bg-card/40 hover:border-primary/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="truncate text-sm font-medium">{r.title}</div>
                  <Trash2
                    className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
                  />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>

          <div>
            {selected?.analysis ? <AnalysisView a={selected.analysis} /> : (
              <Card className="bg-card/60"><CardContent className="p-8 text-center text-muted-foreground">
                Select a resume to see its analysis.
              </CardContent></Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AnalysisView({ a }: { a: any }) {
  return (
    <div className="space-y-4">
      <Card className="bg-card/60">
        <CardHeader><CardTitle className="font-display">Summary</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm">{a.summary}</p>
          <div className="mt-3"><Badge variant="secondary">Level: {a.experience_level}</Badge></div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-card/60">
          <CardHeader><CardTitle className="font-display text-base">Strengths</CardTitle></CardHeader>
          <CardContent><ul className="space-y-2 text-sm">{a.strengths.map((s: string, i: number) => <li key={i}>• {s}</li>)}</ul></CardContent>
        </Card>
        <Card className="bg-card/60">
          <CardHeader><CardTitle className="font-display text-base">Gaps</CardTitle></CardHeader>
          <CardContent><ul className="space-y-2 text-sm">{a.gaps.map((s: string, i: number) => <li key={i}>• {s}</li>)}</ul></CardContent>
        </Card>
      </div>

      <Card className="bg-card/60">
        <CardHeader><CardTitle className="font-display text-base">Skills</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {a.skills.map((s: string, i: number) => <Badge key={i} variant="outline">{s}</Badge>)}
        </CardContent>
      </Card>

      <Card className="bg-card/60">
        <CardHeader><CardTitle className="font-display text-base">Career Paths</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {a.career_paths.map((p: any, i: number) => (
            <div key={i} className="rounded-lg border border-border bg-background/40 p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">{p.title}</div>
                <Badge>{p.fit_score}% fit</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{p.why}</p>
              <div className="mt-3 text-xs font-medium text-muted-foreground">Next steps:</div>
              <ul className="mt-1 space-y-1 text-sm">{p.next_steps.map((n: string, j: number) => <li key={j}>→ {n}</li>)}</ul>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-card/60">
        <CardHeader><CardTitle className="font-display text-base">Project Ideas</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {a.projects.map((p: any, i: number) => (
            <div key={i} className="rounded-lg border border-border bg-background/40 p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">{p.title}</div>
                <Badge variant="outline">{p.difficulty}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {p.tech.map((t: string, j: number) => <Badge key={j} variant="secondary" className="text-xs">{t}</Badge>)}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
