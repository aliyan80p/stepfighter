import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/test/$id/results")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/test-results",
      replace: true,
    });
  },
  component: () => null,
});