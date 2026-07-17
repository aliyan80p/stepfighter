import { Construction } from "lucide-react";

export function StubPage({ title, description }: { title: string; description?: string }) {
  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Construction className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-semibold">{title}</h1>
      </div>
      <p className="text-muted-foreground">
        {description ?? "This section is coming soon."}
      </p>
    </div>
  );
}
