import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/stub-page";

export const Route = createFileRoute("/_authenticated/courses/my-courses")({
  component: () => <StubPage title="My Courses" description="Your enrolled courses will appear here." />,
});
