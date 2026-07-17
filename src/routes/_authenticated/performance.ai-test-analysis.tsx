import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/stub-page";

export const Route = createFileRoute("/_authenticated/performance/ai-test-analysis")({
  component: () => <StubPage title="AI Test Analysis" />,
});
