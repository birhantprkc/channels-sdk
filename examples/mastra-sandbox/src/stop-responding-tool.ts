import { defineChannelTool } from "@copilotkit/channels";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import * as v from "valibot";

export const stopRespondingTool = defineChannelTool({
  name: "stop_responding",
  description:
    "Unsubscribe when the user asks the agent to stop responding in this conversation.",
  parameters: toStandardJsonSchema(v.object({})),
  async handler(_args, { thread }) {
    await thread.unsubscribe();
    return "Unsubscribed from this conversation.";
  },
});
