import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/stub-page";

export const Route = createFileRoute("/_authenticated/medical-library")({
  component: () => <StubPage title="Medical Library" />,
});
