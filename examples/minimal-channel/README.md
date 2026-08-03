# Minimal Channel

The smallest complete Channels listener: a long-running Node process that registers a Channel with CopilotKit Intelligence, waits until it is online, and replies in-thread when someone mentions the app.

Ported from [tylerslaton/minimal-channel](https://github.com/tylerslaton/minimal-channel).

## What it shows

| File               | Responsibility                                                                     |
| ------------------ | ---------------------------------------------------------------------------------- |
| `lib/channel.ts`   | `createChannel` plus one `onMention` handler                                        |
| `lib/runtime.ts`   | `CopilotRuntime` with a `CopilotKitIntelligence` connection and the Channel attached |
| `lib/env.ts`       | Loads `.env` and fails fast on missing variables                                    |
| `server.ts`        | Waits for `channels.ready()`, serves the lifecycle HTTP server, stops on `SIGINT`   |

The mention handler posts a single `🪁` instead of running the agent, so you can confirm the connection end to end without spending a model call. Swap the body of `onMention` for `thread.runAgent({ prompt: message.text })` once the round trip works.

## Setup

You need Node.js 22 or later, a [Channel created in CopilotKit Intelligence](https://docs.copilotkit.ai/channels) with Slack connected, and an AG-UI-compatible agent reachable over HTTP.

```sh
pnpm install
cp .env.example .env
```

Fill in `.env`:

```dotenv
AGENT_URL=<http-url-of-your-ag-ui-agent>
INTELLIGENCE_API_URL=<intelligence-api-url>
INTELLIGENCE_GATEWAY_WS_URL=<intelligence-gateway-ws-url>
INTELLIGENCE_API_KEY=<project-api-key>
```

## Run

```sh
pnpm dev
```

The process listens on port 3000 and prints `Server listening on port 3000...` after the Channel reports ready. When Intelligence shows **Online**, invite the app to a Slack channel and mention it — it replies with a kite in the thread.

## Next steps

- [Channels documentation](https://docs.copilotkit.ai/channels) for Microsoft Teams, interactive UI, approvals, and deployment
- [OpenTag](https://github.com/CopilotKit/OpenTag) for a complete production-shaped Channels application
