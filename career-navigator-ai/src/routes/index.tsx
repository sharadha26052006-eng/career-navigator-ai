import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Brain, FileText, Compass, MessagesSquare, Sparkles, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-hero">
      {/* Nav */}
      <header className="container mx-auto flex items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary shadow-glow">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-semibold">NeuroHire</span>
        </Link>
        <nav className="flex items-center gap-3">
          <Link to="/auth">
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link to="/auth">
            <Button>Get started</Button>
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-6 pt-20 pb-28 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Multi-agent career intelligence
        </div>
        <h1 className="mx-auto mt-6 max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
          Your AI career team,
          <br />
          <span className="text-gradient">working for you.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          NeuroHire orchestrates specialized AI agents to analyze your resume, map career paths,
          recommend portfolio projects, and run rigorous mock interviews — all in one workspace.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link to="/auth">
            <Button size="lg" className="gap-2">
              Launch your workspace <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto grid gap-4 px-6 pb-24 md:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <div
            key={f.title}
            className="group rounded-xl border border-border bg-card/60 p-6 backdrop-blur transition hover:border-primary/50 hover:shadow-glow"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

const features = [
  { icon: FileText, title: "Resume Analyst", desc: "Deep parse of strengths, gaps, and standout skills with structured scoring." },
  { icon: Compass, title: "Career Strategist", desc: "Personalized path recommendations ranked by fit and growth trajectory." },
  { icon: Sparkles, title: "Project Mentor", desc: "Tailored portfolio project ideas that close the gaps the analyst found." },
  { icon: MessagesSquare, title: "Mock Interviewer", desc: "Role-specific interviews with adaptive follow-ups and rubric feedback." },
];
