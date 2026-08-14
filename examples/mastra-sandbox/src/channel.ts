import { createChannel } from "@copilotkit/channels";
import { createMastraAgent } from "./agent.js";
import { barChart } from "./bar-chart.js";
import { required } from "./env.js";
import { stopRespondingTool } from "./stop-responding-tool.js";

export const channel = createChannel({
  name: required("CHANNEL_CODE"),
  identifyUser: "platform",
  agent: createMastraAgent,
  tools: [stopRespondingTool],
  components: [barChart],
});

channel.onMention(async ({ thread }) => {
  await thread.subscribe();
  await thread.runAgent();
});

channel.onMessage(async ({ thread }) => {
  if (await thread.isSubscribed()) {
    await thread.runAgent();
  }
});
