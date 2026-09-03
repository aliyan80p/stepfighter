import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getActiveResultsId } from "@/lib/active-test";
import { Loader } from "@/components/loader";
import { TestResults } from "./test-results.$id";

export const Route = createFileRoute("/_authenticated/test-results/")({
  component: TestResultsIndex,
});

function TestResultsIndex() {
  const [id, setId] = useState<string | null | undefined>(undefined);
  useEffect(() => setId(getActiveResultsId()), []);

  if (id === undefined) return <Loader label="Loading results…" />;
  if (!id) return <Navigate to="/tests" replace />;
  return <TestResults testId={id} />;
}
