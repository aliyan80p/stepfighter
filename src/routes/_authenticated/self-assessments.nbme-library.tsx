import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/stub-page";

export const Route = createFileRoute("/_authenticated/self-assessments/nbme-library")({
  component: () => <StubPage title="NBME Library" />,
});
