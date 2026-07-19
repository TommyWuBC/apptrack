function baseUrl(): string {
  return (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export async function callInternalApi(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<unknown> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-apptrack-internal":
        process.env.INTERNAL_JOB_SECRET ??
        process.env.SESSION_SECRET ??
        "apptrack-development-internal-secret-not-for-production",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    // Keep non-JSON error bodies; never log request data.
  }
  if (!res.ok) {
    throw Object.assign(new Error(`internal_api_${res.status}`), {
      status: res.status,
      response: parsed,
    });
  }
  return parsed;
}
