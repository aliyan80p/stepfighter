import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/stub-page";

export const Route = createFileRoute("/_authenticated/study-planner")({
  component: () => <StubPage title="Study Planner" />,
});
