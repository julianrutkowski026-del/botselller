import { createNetlifyCronHandler } from "../../lib/netlifyCron.mjs";

export default createNetlifyCronHandler("cleanup-orders");

export const config = {
  schedule: "30 2 * * *",
};
