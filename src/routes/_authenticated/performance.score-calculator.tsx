import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/stub-page";

export const Route = createFileRoute("/_authenticated/performance/score-calculator")({
  component: () => <StubPage title="Score Calculator" />,
});
