const scheduledRoutes = new Set([
  "run-campaigns",
  "send-worker",
  "followups",
  "cleanup-orders",
]);

function siteBaseUrl(env) {
  return (
    env.URL ||
    env.DEPLOY_PRIME_URL ||
    env.NEXT_PUBLIC_SITE_URL ||
    env.NEXT_PUBLIC_BASE_URL ||
    ""
  )
    .trim()
    .replace(/\/+$/, "");
}

export async function dispatchNetlifyCron(route, { env = process.env, fetchImpl = fetch } = {}) {
  if (!scheduledRoutes.has(route)) {
    return { ok: false, status: 400, reason: "unknown_cron_route" };
  }

  const baseUrl = siteBaseUrl(env);
  const cronSecret = env.CRON_SECRET?.trim();
  if (!baseUrl || !cronSecret) {
    return {
      ok: false,
      status: 500,
      reason: !baseUrl ? "missing_site_url" : "missing_cron_secret",
    };
  }

  try {
    const response = await fetchImpl(`${baseUrl}/api/cron/${route}`, {
      method: "GET",
      headers: { authorization: `Bearer ${cronSecret}` },
      cache: "no-store",
      signal: AbortSignal.timeout(28_000),
    });

    return {
      ok: response.ok,
      status: response.status,
      reason: response.ok ? null : "cron_endpoint_rejected_request",
    };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      reason: error instanceof Error ? error.name : "cron_request_failed",
    };
  }
}

export function createNetlifyCronHandler(route) {
  return async function handleScheduledCron() {
    const result = await dispatchNetlifyCron(route);
    const summary = JSON.stringify({ route, ...result });

    if (result.ok) console.info("Salesbot scheduled task completed:", summary);
    else console.error("Salesbot scheduled task failed:", summary);

    return Response.json(result, { status: result.ok ? 200 : 502 });
  };
}
