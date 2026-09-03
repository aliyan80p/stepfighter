import { createFileRoute, Navigate } from "@tanstack/react-router";
import { resultsNav } from "@/lib/active-test";

export const Route = createFileRoute("/_authenticated/test/$id/results")({
  component: LegacyResultsRedirect,
});

/** Legacy /test/:id/results URLs: keep the id internally, show the clean URL. */
function LegacyResultsRedirect() {
  const { id } = Route.useParams();
  return <Navigate {...resultsNav(id)} replace />;
}
