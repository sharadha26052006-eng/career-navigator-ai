import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, Compass, MessagesSquare, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/app/")({
  component: Overview,
});

function Overview() {
  const [counts, setCounts] = useState({ resumes: 0, sessions: 0 });
  const [name, setName] = useState("there");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ count: r }, { count: s }, { data: p }] = await Promise.all([
        supabase.from("resumes").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("interview_sessions").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      ]);
      setCounts({ resumes: r ?? 0, sessions: s ?? 0 });
      if (p?.full_name) setName(p.full_name.split(" ")[0]);
    })();
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, {name}</h1>
        <p className="mt-1 text-muted-foreground">Your AI career agents are ready.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Resumes analyzed" value={counts.resumes} />
        <StatCard label="Mock interviews" value={counts.sessions} />
        <StatCard label="AI agents" value={4} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ActionCard to="/app/resume" icon={FileText} title="Analyze a resume" desc="Get strengths, gaps and skill mapping." />
        <ActionCard to="/app/career" icon={Compass} title="Explore career paths" desc="Ranked paths with project ideas." />
        <ActionCard to="/app/interview" icon={MessagesSquare} title="Run a mock interview" desc="Role-specific adaptive questions." />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="border-border/60 bg-card/60">
      <CardContent className="p-6">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-2 font-display text-4xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function ActionCard({ to, icon: Icon, title, desc }: { to: string; icon: any; title: string; desc: string }) {
  return (
    <Link to={to} className="group">
      <Card className="h-full border-border/60 bg-card/60 transition hover:border-primary/50 hover:shadow-glow">
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <CardTitle className="font-display text-lg">{title}</CardTitle>
          <CardDescription>{desc}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center text-sm text-primary opacity-0 transition group-hover:opacity-100">
            Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
