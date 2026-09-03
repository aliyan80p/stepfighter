/**
 * Keeps the currently-open test / results id out of the URL.
 *
 * The app navigates to clean paths ("/test", "/test-results") and the numeric
 * test id is preserved in localStorage so refresh, continue/reopen, submit,
 * results and review all keep working exactly as before.
 */
const TEST_KEY = "sf_active_test_id";
const RESULTS_KEY = "sf_active_results_id";

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(key);
    return v && /^\d+$/.test(v) ? v : null;
  } catch {
    return null;
  }
}

function write(key: string, id: string | number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, String(id));
  } catch {
    /* ignore */
  }
}

export const getActiveTestId = () => read(TEST_KEY);
export const getActiveResultsId = () => read(RESULTS_KEY);

export function setActiveTestId(id: string | number) {
  write(TEST_KEY, id);
}

export function setActiveResultsId(id: string | number) {
  write(RESULTS_KEY, id);
}
