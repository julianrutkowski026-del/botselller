import { createNetlifyCronHandler } from "../../lib/netlifyCron.mjs";

export default createNetlifyCronHandler("run-campaigns");

export const config = {
  schedule: "* * * * *",
};
