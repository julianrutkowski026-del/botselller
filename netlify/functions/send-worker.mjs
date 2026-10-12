import { createNetlifyCronHandler } from "../../lib/netlifyCron.mjs";

export default createNetlifyCronHandler("send-worker");

export const config = {
  schedule: "* * * * *",
};
