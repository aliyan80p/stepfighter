import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/stub-page";

export const Route = createFileRoute("/_authenticated/flashcards/my-decks")({
  component: () => <StubPage title="My Decks" description="Your flashcard decks will appear here." />,
});
