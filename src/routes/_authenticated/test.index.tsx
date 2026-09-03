import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getActiveTestId } from "@/lib/active-test";
import { Loader } from "@/components/loader";
import { TestRunner } from "./test.$id";

export const Route = createFileRoute("/_authenticated/test/")({
  component: TestIndex,
});

function TestIndex() {
  const [id, setId] = useState<string | null | undefined>(undefined);
  useEffect(() => setId(getActiveTestId()), []);

  if (id === undefined) return <Loader label="Loading test…" />;
  if (!id) return <Navigate to="/tests" replace />;
  return <TestRunner testId={id} />;
}
