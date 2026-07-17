import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/stub-page";

export const Route = createFileRoute("/_authenticated/performance/overall")({
  component: () => <StubPage title="Overall Performance" />,
});
