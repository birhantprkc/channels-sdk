import {
  CopilotRuntime,
  CopilotKitIntelligence,
} from "@copilotkit/runtime/v2";
import {
  createCopilotNodeListener
} from "@copilotkit/runtime/v2/node";
import { channel } from "@/lib/channel";
import { required } from "@/lib/env";

const intelligence = new CopilotKitIntelligence({
  apiUrl: required("INTELLIGENCE_API_URL"),
  wsUrl: required("INTELLIGENCE_GATEWAY_WS_URL"),
  apiKey: required("INTELLIGENCE_API_KEY"),
});

const runtime = new CopilotRuntime({
  agents: {},
  intelligence,
  identifyUser: () => ({ id: "scratch-user", name: "Scratch User" }),
  channels: [channel],
});

export const listener = createCopilotNodeListener({
  runtime,
  basePath: "/api/copilotkit",
});
