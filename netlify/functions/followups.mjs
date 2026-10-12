import { createNetlifyCronHandler } from "../../lib/netlifyCron.mjs";

export default createNetlifyCronHandler("followups");

export const config = {
  schedule: "0 */2 * * *",
};
