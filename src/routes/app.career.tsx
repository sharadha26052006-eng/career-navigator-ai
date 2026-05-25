import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/career")({
  component: CareerPage,
});

function CareerPage() {
  const [analyses, setAnalyses] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("resumes")
        .select("id, title, analysis, created_at")
        .eq("user_id", user.id)
        .not("analysis", "is", null)
        .order("created_at", { ascending: false });
      setAnalyses(data || []);
    })();
  }, []);

  if (analyses.length === 0) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <Card className="bg-card/60">
          <CardContent className="space-y-4 p-10 text-center">
            <h2 className="font-display text-2xl">No career paths yet</h2>
            <p className="text-muted-foreground">Analyze a resume first to surface ranked career paths.</p>
            <Link to="/app/resume"><Button>Analyze a resume</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Career Paths</h1>
        <p className="mt-1 text-muted-foreground">Recommendations from your latest analyses.</p>
      </div>

      {analyses.map((r) => (
        <Card key={r.id} className="bg-card/60">
          <CardHeader>
            <CardTitle className="font-display text-lg">{r.title}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {r.analysis.career_paths.map((p: any, i: number) => (
              <div key={i} className="rounded-lg border border-border bg-background/40 p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{p.title}</div>
                  <Badge>{p.fit_score}%</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{p.why}</p>
                <Link
                  to="/app/interview"
                  search={{ role: p.title } as any}
                  className="mt-3 inline-block text-xs text-primary hover:underline"
                >
                  Practice interview →
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
