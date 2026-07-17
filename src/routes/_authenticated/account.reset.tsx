import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/stub-page";

export const Route = createFileRoute("/_authenticated/account/reset")({
  component: () => <StubPage title="Reset Progress" description="Clear your attempts, tests, or bookmarks." />,
});
