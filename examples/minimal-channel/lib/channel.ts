import { createChannel } from "@copilotkit/channels";
import { slack } from "@copilotkit/channels/slack"
import { HttpAgent } from "@ag-ui/client";
import { required } from "@/lib/env";

const channel = createChannel({
  name: "scratch",
  agent: new HttpAgent({ url: required("AGENT_URL") }),
});

channel.onMention(async ({ thread, message }) => {
  await thread.post(`🪁`);
});

export { channel };
