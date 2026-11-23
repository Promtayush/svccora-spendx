import { getToken, logout } from "@/lib/auth";

interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: BodyInit | Record<string, unknown> | null;
}

export const apiFetch = async <T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> => {
  const headers = new Headers(options.headers);
  const token = getToken();
  const body = options.body;

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let requestBody: BodyInit | undefined;
  if (
    body &&
    typeof body === "object" &&
    !(body instanceof FormData) &&
    !(body instanceof Blob)
  ) {
    headers.set("Content-Type", "application/json");
    requestBody = JSON.stringify(body);
  } else {
    requestBody = body as BodyInit | undefined;
  }

  const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL}${path}`,
    {
      ...options,
      headers,
      body: requestBody,
    }
  );

  let responseBody: unknown = null;
  try {
    responseBody = await response.json();
  } catch {
    responseBody = null;
  }

  if (response.status === 401) {
    logout();
    window.location.assign("/auth");
    throw new Error("Your session has expired. Please sign in again.");
  }

  if (!response.ok) {
    const errorMessage =
      typeof responseBody === "object" &&
      responseBody !== null &&
      ("error" in responseBody || "message" in responseBody)
        ? String(
            ("error" in responseBody && responseBody.error) ||
              ("message" in responseBody && responseBody.message)
          )
        : response.statusText || "Request failed";

    throw new Error(errorMessage);
  }

  return responseBody as T;
};
