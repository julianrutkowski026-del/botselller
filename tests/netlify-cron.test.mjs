import assert from "node:assert/strict";

import * as runCampaigns from "../netlify/functions/run-campaigns.mjs";
import * as sendWorker from "../netlify/functions/send-worker.mjs";
import * as followups from "../netlify/functions/followups.mjs";
import * as cleanupOrders from "../netlify/functions/cleanup-orders.mjs";
import { dispatchNetlifyCron } from "../lib/netlifyCron.mjs";

assert.equal(runCampaigns.config.schedule, "* * * * *");
assert.equal(sendWorker.config.schedule, "* * * * *");
assert.equal(followups.config.schedule, "0 */2 * * *");
assert.equal(cleanupOrders.config.schedule, "30 2 * * *");

let called = false;
const missingSecret = await dispatchNetlifyCron("run-campaigns", {
  env: { URL: "https://salesbot.example" },
  fetchImpl: async () => {
    called = true;
    return { ok: true, status: 200 };
  },
});
assert.deepEqual(missingSecret, { ok: false, status: 500, reason: "missing_cron_secret" });
assert.equal(called, false);

let requestDetails;
const successfulRequest = await dispatchNetlifyCron("run-campaigns", {
  env: { URL: "https://salesbot.example/", CRON_SECRET: "test-secret" },
  fetchImpl: async (url, options) => {
    requestDetails = { url, options };
    return { ok: true, status: 200 };
  },
});
assert.deepEqual(successfulRequest, { ok: true, status: 200, reason: null });
assert.equal(requestDetails.url, "https://salesbot.example/api/cron/run-campaigns");
assert.equal(requestDetails.options.headers.authorization, "Bearer test-secret");

const rejectedRequest = await dispatchNetlifyCron("send-worker", {
  env: { NEXT_PUBLIC_SITE_URL: "https://salesbot.example", CRON_SECRET: "test-secret" },
  fetchImpl: async () => ({ ok: false, status: 401 }),
});
assert.deepEqual(rejectedRequest, {
  ok: false,
  status: 401,
  reason: "cron_endpoint_rejected_request",
});

const unknownRoute = await dispatchNetlifyCron("admin-data", {
  env: { URL: "https://salesbot.example", CRON_SECRET: "test-secret" },
});
assert.deepEqual(unknownRoute, { ok: false, status: 400, reason: "unknown_cron_route" });

console.log("Netlify scheduled-cron tests passed");
