import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/stub-page";

export const Route = createFileRoute("/_authenticated/qbanks/search")({
  component: () => <StubPage title="Search Questions" description="Search the QBank by keyword, subject, or system." />,
});
