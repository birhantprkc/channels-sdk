import { MastraAgent } from "@ag-ui/mastra";
import { Agent } from "@mastra/core/agent";
import { LocalFilesystem, Workspace } from "@mastra/core/workspace";
import { resolve } from "node:path";
import {
  createLoggedLocalSandbox,
  type SandboxEventLogger,
} from "./sandbox-logging.js";

const agentId = "mastra-sandbox-agent";

export function createSandboxWorkspace(sandboxLogger?: SandboxEventLogger) {
  const sandboxDirectory = resolve("sandbox");
  return new Workspace({
    id: "sandbox-workspace",
    filesystem: new LocalFilesystem({ basePath: sandboxDirectory }),
    sandbox: createLoggedLocalSandbox(
      { workingDirectory: sandboxDirectory },
      sandboxLogger,
    ),
    skills: ["skills"],
  });
}

export function createMastraAgent() {
  const agent = new Agent({
    id: agentId,
    name: "Mastra Sandbox Agent",
    model: "openai/gpt-5.6-terra",
    defaultOptions: {
      maxSteps: 50,
      providerOptions: {
        openai: { reasoningEffort: "low" },
      },
    },
    instructions: `
      You are a concise assistant connected to a Slack channel.

      Your workspace is rooted in the sandbox directory. Use its file tools to
      read and write files. Use its command tool to run the Datadog Pup CLI for
      logs, service information, and application performance metrics.

      Use these exact Datadog APM identifiers:
      - Environments: dev, staging, prod.
      - Services: app-api, realtime-gateway.
      - Map "production" to prod, "App API" to app-api, and "Realtime Gateway"
        to realtime-gateway.
      - Pass the canonical values to --env, --service, and env:/service: trace
        filters.
      - Before querying APM resources, list the service operations and pass an
        exact returned operation name to --name.

      When numeric results are easier to compare visually, call show_bar_chart
      with the exact values instead of formatting a text chart.
    `,
    workspace: createSandboxWorkspace(),
  });

  // With no fixed resourceId, the AG-UI adapter scopes Mastra memory to the
  // incoming Channels thread.
  return new MastraAgent({ agent });
}
