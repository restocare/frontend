import axios from "axios";

interface ApiErrorBody {
  message?: string | string[];
}

/**
 * Human-readable message for a failed real-estate API call.
 *
 * NestJS puts the message in `response.data.message`, either a string or, for
 * validation failures, a list of strings. Falls back to the Error's own
 * message, then to `fallback`.
 */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorBody>(err)) {
    const raw = err.response?.data?.message;
    if (Array.isArray(raw) && raw.length > 0) return raw.join(", ");
    if (typeof raw === "string" && raw) return raw;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
