import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/stub-page";

export const Route = createFileRoute("/_authenticated/performance/peer-ranking")({
  component: () => <StubPage title="Peer Ranking" />,
});
