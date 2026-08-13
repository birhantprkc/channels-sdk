import { createServer } from "node:http";
import {
  CopilotKitIntelligence,
  CopilotRuntime,
} from "@copilotkit/runtime/v2";
import { createCopilotNodeListener } from "@copilotkit/runtime/v2/node";
import { channel } from "./channel.js";
import { required } from "./env.js";

required("OPENAI_API_KEY");

const runtime = new CopilotRuntime({
  agents: {},
  intelligence: new CopilotKitIntelligence({
    apiKey: required("INTELLIGENCE_API_KEY"),
  }),
  channels: [channel],
});

let teardown: (() => Promise<void>) | undefined;
const shutdown = async () => {
  await teardown?.();
};
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

const listener = createCopilotNodeListener({
  runtime,
  basePath: "/api/copilotkit",
  cors: false,
});
const channels = listener.channels;
if (!channels) {
  throw new Error("Channels control surface was not created");
}

const server = createServer(listener);
teardown = async () => {
  await channels.stop();
  if (server.listening) {
    server.close();
  }
};

try {
  await channels.ready({ timeoutMs: 30_000 });

  const status = channels.status();
  if (status.overall !== "online") {
    throw new Error(`Channel is not online: ${JSON.stringify(status)}`);
  }

  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, () => {
    console.log(`Channel online; lifecycle server listening on :${port}`);
  });
} catch (error) {
  await shutdown();
  throw error;
}
