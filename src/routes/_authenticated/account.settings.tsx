import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/stub-page";

export const Route = createFileRoute("/_authenticated/account/settings")({
  component: () => <StubPage title="Settings" />,
});
