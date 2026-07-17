import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BookOpen, Target, TrendingUp, Bookmark } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
              IMD
            </div>
            <span className="font-semibold">QBank</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" asChild><Link to="/auth">Sign in</Link></Button>
            <Button asChild><Link to="/auth" search={{ mode: "signup" }}>Get started</Link></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold tracking-tight">
            USMLE Step 2 <span className="text-primary">QBank</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            4,089 board-style questions with in-depth explanations, custom test builder, and progress tracking.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button size="lg" asChild><Link to="/auth" search={{ mode: "signup" }}>Start practicing</Link></Button>
            <Button size="lg" variant="outline" asChild><Link to="/auth">Sign in</Link></Button>
          </div>
        </div>

        <div className="mt-20 grid gap-6 md:grid-cols-4">
          {[
            { icon: BookOpen, title: "4,089 Questions", desc: "Full Step 2 pool" },
            { icon: Target, title: "Custom Tests", desc: "By subject or system" },
            { icon: TrendingUp, title: "Track Progress", desc: "Per subject stats" },
            { icon: Bookmark, title: "Flag & Review", desc: "Save for later" },
          ].map((f) => (
            <div key={f.title} className="rounded-lg border border-border p-5">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
