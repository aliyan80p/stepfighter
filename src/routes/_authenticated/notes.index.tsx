import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/stub-page";

export const Route = createFileRoute("/_authenticated/notes/")({
  component: () => <StubPage title="Notes" description="Your saved question notes will appear here." />,
});
