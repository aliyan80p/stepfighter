import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMediaToken, getLibraryMediaToken } from "@/lib/media-token.functions";

/**
 * Fetch a short-lived, entitlement-checked token that authorizes the
 * current user to load media for a given qbank through /api/media/*.
 */
export function useMediaToken(qbankId: number | null | undefined): string | undefined {
  const fn = useServerFn(getMediaToken);
  const q = useQuery({
    queryKey: ["media-token", qbankId],
    queryFn: async () => fn({ data: { qbankId: qbankId as number } }),
    enabled: typeof qbankId === "number" && qbankId > 0,
    // Refresh well before the 1h server-side expiry.
    staleTime: 45 * 60 * 1000,
    refetchInterval: 45 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  return q.data?.token;
}

/**
 * Media token for the shared Medical Library (qbank 2), available to any user
 * with an active plan for any course.
 */
export function useLibraryMediaToken(enabled = true): string | undefined {
  const fn = useServerFn(getLibraryMediaToken);
  const q = useQuery({
    queryKey: ["library-media-token"],
    queryFn: async () => fn({}),
    enabled,
    staleTime: 45 * 60 * 1000,
    refetchInterval: 45 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  return q.data?.token;
}
