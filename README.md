<div align="center">

# Channels SDK

<img src="./assets/hero-any-agent-any-channel.png" alt="Any agent. Any channel. — Slack, Discord, Teams, Telegram, WhatsApp, and Google Chat" width="820">

**Build AI agents that live in Slack, Teams, Discord, Telegram, WhatsApp, and Google Chat — write the bot once, and it renders native interactive UI on every platform.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![status: preview](https://img.shields.io/badge/status-preview-orange.svg)](#status--roadmap)
[![npm](https://img.shields.io/npm/v/@copilotkit/channels.svg?label=%40copilotkit%2Fchannels)](https://www.npmjs.com/package/@copilotkit/channels)
[![Built on AG-UI](https://img.shields.io/badge/built%20on-AG--UI%20Protocol-6E56CF.svg)](https://github.com/ag-ui-protocol/ag-ui)
[![Powers OpenTag](https://img.shields.io/badge/powers-OpenTag-black.svg)](https://github.com/CopilotKit/OpenTag)

**[▶ Watch the 90-second launch video](./assets/launch.mp4)**

[Quick start](#quick-start) · [Concepts](#core-concepts) · [How it works](#how-it-works) · [Platforms](#supported-platforms) · [OpenTag](#see-it-in-production-opentag) · [Deploy](#deploy-opentag)

</div>

---

> **Channels SDK powers [OpenTag](https://github.com/CopilotKit/OpenTag)** — the open-source alternative to Claude in Slack. If you want to see the SDK driving a real, complete app rather than snippets, read OpenTag. [Jump to details ↓](#see-it-in-production-opentag)

## The pitch

Most "AI in Slack" today is a bot that echoes text back at you. But the agent already knows how to *do things* — look up a record, run a query, draft a change. What it can't do is show you a button, ask you to pick one of three options, or render a chart inline and pause for your approval before it acts.

Doing that today means hand-wiring an agent loop into a platform SDK: Block Kit JSON for Slack, embeds and components for Discord, Adaptive Cards for Teams — three different UI models, three different interaction-callback formats, plus your own plumbing for tool calls, streaming, human-in-the-loop, and conversation state.

**Channels SDK is the layer that removes that plumbing.** You write one bot — handlers, tools, and JSX-rendered messages — and it runs on any messaging platform through a swappable adapter. The agent drives real, interactive UI in the conversation, not just text. It's the same idea behind [CopilotKit](https://github.com/CopilotKit/CopilotKit) — *agents that drive UI, not chat windows bolted on the side* — brought to the surfaces your users already live in. It's the engine behind [OpenTag](https://github.com/CopilotKit/OpenTag), the open-source, self-hosted alternative to Claude in Slack.

```ts
bot.onMention(async ({ thread }) => {
  await thread.runAgent(); // agent replies, calls tools, renders buttons, pauses for input
});
```

## Same agent, every channel

The same bot renders native, interactive UI on each platform — a real tool call and a real card, not a wall of text:

| Slack | Discord | Teams |
| --- | --- | --- |
| <img src="./assets/demo-slack.png" alt="KiteBot in Slack: a search_docs tool call rendering an interactive launch-checklist card"> | <img src="./assets/demo-discord.png" alt="KiteBot in Discord: a read_logs tool call rendering a rolled-back deploy status card"> | <img src="./assets/demo-teams.png" alt="KiteBot in Teams: a fetch_report tool call rendering a Q3 sales metrics card"> |

## Quick start

```sh
pnpm add @copilotkit/channels @copilotkit/channels-ui
pnpm add @copilotkit/channels-slack   # the reference platform adapter
```

```ts
import { createBot, defineBotTool } from "@copilotkit/channels";
import { slack } from "@copilotkit/channels-slack";
import { Section, Actions, Button } from "@copilotkit/channels-ui";
import { z } from "zod";
import { makeAgent } from "./agent";

const bot = createBot({
  adapters: [
    slack({
      botToken: process.env.SLACK_BOT_TOKEN!,
      appToken: process.env.SLACK_APP_TOKEN!,
    }),
  ],
  agent: (threadId) => makeAgent(threadId),
  tools: [
    defineBotTool({
      name: "deploy",
      description: "Trigger a deploy for the given environment.",
      parameters: z.object({ env: z.enum(["staging", "production"]) }),
      async handler({ env }, { thread }) {
        // Show an interactive confirmation before doing anything irreversible.
        const ok = await thread.awaitChoice<boolean>(
          <Section>
            Deploy to <b>{env}</b>?
            <Actions>
              <Button value={true} style="primary">Ship it</Button>
              <Button value={false} style="danger">Cancel</Button>
            </Actions>
          </Section>,
        );
        if (!ok) return "Cancelled by the user.";
        return await deploy(env);
      },
    }),
  ],
});

// Reply whenever the bot is @-mentioned; the agent does the rest.
bot.onMention(async ({ thread }) => {
  await thread.runAgent();
});

await bot.start();
```

That's a complete, working Slack agent: it answers when mentioned, can call the `deploy` tool, and pauses mid-run to render a real confirmation with buttons — no Block Kit JSON, no interaction-payload parsing, no state store to wire up.

## Core concepts

Five pieces, each with one job.

### 1. The Bot — routing

`createBot()` returns a `Bot` you attach handlers to:

| Handler | Fires when… |
| --- | --- |
| `onMention(fn)` / `onMessage(fn)` | a turn comes in (mentions take priority over plain messages) |
| `onThreadStarted(fn)` | a conversation surface opens — good for a welcome message |
| `onCommand(name, fn)` | a slash command is invoked |
| `onInteraction(id, fn)` | a bound action (button/select/input) is triggered |
| `onInterrupt(event, fn)` | the agent pauses mid-run and hands control back to you |

### 2. The Thread — the conversation handle

Every handler receives a `thread`. It's how you render and drive the conversation:

```ts
await thread.post(<Section>Working on it…</Section>);   // render JSX
await thread.stream(tokenStream);                        // stream tokens live
await thread.runAgent();                                 // run the agent loop
const value = await thread.awaitChoice(picker);          // HITL: block for a choice
await thread.setTitle("Incident #4821");                 // rename the surface
```

`post`/`update` render your JSX, mint content-stable handler IDs, and bind their events for you. `runAgent` drives the agent's run/tool/interrupt loop and renders each step as it streams.

### 3. Tools — what the agent can do

Tools are plain functions with a typed parameter schema. They accept any [Standard Schema](https://standardschema.dev) validator (Zod, Valibot, ArkType), and their handler gets the live `thread` — so a tool can post UI, ask a question, or run a HITL flow while it executes:

```ts
defineBotTool({
  name: "read_thread",
  description: "Read the messages in the current conversation.",
  parameters: z.object({}),
  async handler(_args, { thread }) {
    return await thread.getMessages();
  },
});
```

### 4. Interactive UI — JSX that renders everywhere

You describe messages as JSX. The same tree renders as Block Kit on Slack, components on Discord, and Adaptive Cards on Teams — and where a surface lacks a feature, that node degrades gracefully instead of erroring.

```tsx
<Message accent="#ff6600">
  <Header>Top story on Hacker News</Header>
  <Section>
    <Markdown>**{story.title}** — {story.points} points</Markdown>
  </Section>
  <Fields>
    <Field label="Author">{story.by}</Field>
    <Field label="Comments">{story.descendants}</Field>
  </Fields>
  <Actions>
    <Button url={story.url}>Open link</Button>
    <Button value={story.id} style="primary">Summarize thread</Button>
  </Actions>
</Message>
```

The vocabulary: `Message`, `Header`, `Section`, `Markdown`, `Fields`/`Field`, `Context`, `Divider`, `Image`, `Table`/`Row`/`Cell`, `Chart`, and the interactive `Actions`, `Button`, `Select`, and `Input`. Inline `onClick` / `onSelect` / `onSubmit` handlers are bound automatically.

### 5. Context — what the agent knows

`ContextEntry` values are `{ description, value }` pairs injected into the agent's prompt per run — the conversation's channel, the caller's role, whatever grounds the turn.

## How it works

The core engine is platform-agnostic. Every surface is a **`PlatformAdapter`** — a small contract that translates between the platform's API and the engine's message IR:

<img src="./assets/architecture.png" alt="One agent architecture, native to every channel — Channels (CopilotKit + AG-UI) at the center connecting Slack, Teams, Discord, Google Chat, Telegram, and WhatsApp" width="820">

```
  Slack / Teams / Discord / Google Chat / Telegram / WhatsApp / your own
        │  (PlatformAdapter)
        ▼
  ┌─────────────────────────────────────────┐
  │  Channels engine                          │
  │  routing · tools · agent loop · actions   │
  │  JSX → message IR · HITL · action store   │
  └─────────────────────────────────────────┘
        ▲
        │  agent (AG-UI run / tool / interrupt loop)
   your agent — @copilotkit/runtime, LangGraph, CrewAI, custom, …
```

The agent it drives is any AG-UI-compatible backend. OpenTag runs [`@copilotkit/runtime`](https://www.npmjs.com/package/@copilotkit/runtime) as the agent backend (on its own port) and points the bot at it — but a LangGraph, CrewAI, or fully custom agent slots in the same way.

Because interactive handlers are keyed by **content-stable IDs** (a hash of the component's name, path, and props), a button clicked an hour after it was posted still resolves to the right handler. Bindings live in an `ActionStore` — in-memory by default, or your own durable implementation so handlers survive a restart.

Adding a new platform means implementing `PlatformAdapter` — receive turns, render `BotNode[]`, decode interactions — without touching any bot logic. [`@copilotkit/channels-slack`](https://www.npmjs.com/package/@copilotkit/channels-slack) is the reference implementation to read.

## Supported platforms

Slack first — the same bot code also runs on Teams, Discord, Telegram, WhatsApp, and Google Chat. Each platform is its own adapter package, `@copilotkit/channels-<platform>`.

| Platform | Adapter | Notes |
| --- | --- | --- |
| **Slack** | `@copilotkit/channels-slack` | Reference adapter — full interactive UI: buttons, selects, multi-select, modals-as-choices |
| **Microsoft Teams** | `@copilotkit/channels-teams` | Adaptive Cards, field labels, multi-select (`isMultiSelect`) |
| **Discord** | `@copilotkit/channels-discord` | Components, embeds, link buttons |
| **Telegram** | `@copilotkit/channels-telegram` | Degrades multi-select and link buttons to the nearest equivalent |
| **WhatsApp** | `@copilotkit/channels-whatsapp` | Degrades to single-select where rich controls aren't expressible |
| **Google Chat** | `@copilotkit/channels-google-chat` | Cards v2 rendering |
| **Your own surface** | Bring an adapter | Implement `PlatformAdapter` — the engine and your bot don't change |

Feature-detection is built in: a `<Select multi>` renders as `multi_static_select` on Slack, max-values on Discord, `isMultiSelect` on Teams, and degrades to single-select on Telegram/WhatsApp. The renderer is total — a platform that can't render a node skips it rather than throwing.

## Why not just use Bolt / discord.js directly?

Those SDKs are excellent *transports* — and Channels SDK adapters are built on top of them. The difference is everything above the transport:

| You still hand-write with a raw platform SDK | Channels SDK gives you |
| --- | --- |
| The agent run / tool-call / streaming loop | `thread.runAgent()` |
| Block Kit / embeds / Adaptive Cards, per platform | One JSX tree, rendered natively on each |
| Parsing interaction payloads and routing them | Inline `onClick` / `awaitChoice`, auto-bound |
| Human-in-the-loop pause/resume | `awaitChoice` / `onInterrupt` / `resume` |
| Conversation + action state across restarts | `ActionStore` + conversation store |
| Rewriting all of it for the next platform | Swap the adapter |

The category this replaces isn't a library — it's the pile of glue between "an agent that could act" and "a chat surface that lets a human see and steer it."

## See it in production: OpenTag

[**OpenTag**](https://github.com/CopilotKit/OpenTag) is the flagship app built on Channels SDK — an open-source, self-hosted alternative to Claude in Slack:

> *Run your own AI agent inside Slack: it reads a thread, answers, calls your tools, and renders rich results right in the conversation.*

Unlike a bot locked to one vendor's model, OpenTag works with any LLM and any agent framework, and you own the end-to-end logic. It's the best reference for how the pieces in this README fit together in a complete app — generative UI, human-in-the-loop approval gates, tool execution, and threading across Slack, Discord, Telegram, and WhatsApp.

It's wired from these packages:

```sh
pnpm install
pnpm runtime    # the agent backend (@copilotkit/runtime) on :8200
pnpm channel    # run the bot via the managed Intelligence Gateway
# or
pnpm dev        # run the bot fully self-hosted
```

For teams that would rather not operate the gateway themselves, a fully-hosted managed service is on the waitlist (see the OpenTag repo). The SDK itself is and stays open source and self-hostable.

## Deploy OpenTag

OpenTag is a sample project you run with the **Channels SDK for the chat surface** and **[CopilotKit Intelligence](https://www.copilotkit.ai/opentag-managed) for the production layer**. Intelligence hosts the gateway your bot connects through and provides thread persistence, analytics, and continuous learning — so you don't operate that infrastructure yourself.

**Prerequisites**

- Node 18+ and pnpm
- A Slack workspace where you can install an app
- An LLM provider key (OpenTag is model-agnostic)
- A CopilotKit Intelligence account (self-hosted or CopilotKit Cloud)

**1. Clone and install**

```sh
git clone https://github.com/CopilotKit/OpenTag.git
cd OpenTag
pnpm install
```

**2. Create a Slack app (Socket Mode)**

Create an app, enable **Socket Mode**, add a bot user, and subscribe to the `app_mention` (and `message`) events plus any slash commands you want. Install it to your workspace, then copy the **Bot token** (`xoxb-…`) and **App-level token** (`xapp-…`). OpenTag ships a Slack app manifest in the repo — use it for the exact scopes and events rather than adding them by hand.

**3. Configure environment**

```sh
cp .env.example .env
```

Fill in `.env`. At minimum you'll set:

- `SLACK_BOT_TOKEN=xoxb-…`
- `SLACK_APP_TOKEN=xapp-…`
- your LLM provider key
- the **CopilotKit Intelligence** credentials listed in `.env.example` (your Intelligence gateway / API key)

> The exact Intelligence variable names live in OpenTag's `.env.example` — copy them verbatim; don't guess.

**4. Start the agent backend**

```sh
pnpm runtime    # @copilotkit/runtime on :8200
```

**5. Connect the bot through CopilotKit Intelligence**

```sh
pnpm channel    # runs the bot over the managed Intelligence Gateway (recommended)
```

Use `pnpm dev` instead to run the bot fully self-hosted, without the gateway.

**6. Try it**

@mention the bot in any channel thread:

> `@YourBot summarize this thread and file it as a bug`

**Going to production**

- CopilotKit Intelligence runs **self-hosted** or in **CopilotKit Cloud** — either way the SDK stays open source.
- A fully-hosted, managed OpenTag is on the **waitlist**: [go.copilotkit.ai/opentag-managed-gh](https://go.copilotkit.ai/opentag-managed-gh).

> Heads up: these steps need your own Slack tokens and Intelligence account, so run them yourself — a deploy that renders interactive UI in your real workspace shouldn't be driven with someone else's credentials.

## Packages

| Package | What it is |
| --- | --- |
| `@copilotkit/channels` | The platform-agnostic engine: `createBot`, `Bot`, `Thread`, tools, context, action store |
| `@copilotkit/channels-ui` | The JSX vocabulary (`Message`, `Section`, `Button`, `Select`, `Chart`, …) |
| `@copilotkit/channels-slack` | The Slack platform adapter (reference implementation) |
| `@copilotkit/channels-<platform>` | One adapter per surface — `-teams`, `-discord`, `-telegram`, `-whatsapp`, `-google-chat` |
| `@copilotkit/runtime` | The agent backend the bot drives (the AG-UI runtime) — or bring your own agent |

## Relationship to CopilotKit and AG-UI

Channels SDK is part of [CopilotKit](https://github.com/CopilotKit/CopilotKit), the open-source, MIT-licensed stack for agent-native applications, and the team behind the [AG-UI Protocol](https://github.com/ag-ui-protocol/ag-ui) — the open, event-based protocol for how agents talk to user-facing apps (adopted by Google, LangChain, AWS, Microsoft, Mastra, and PydanticAI).

CopilotKit's React hooks put agent-driven UI in your web app. Channels SDK puts the same pattern — agents that render real UI and pause for human input — into the messaging surfaces where teams already work. The agent loop it drives (runs, tool calls, interrupts) is the AG-UI model; any AG-UI-compatible agent slots in. For production, **CopilotKit Intelligence** is the optional managed layer around the SDK (thread persistence, analytics, the Intelligence Gateway used by OpenTag's `pnpm channel`), self-hostable or in CopilotKit Cloud — the SDK stays fully open source either way.

## Status & roadmap

Channels SDK is in **preview**. The core engine, the Slack adapter, and the JSX vocabulary work today; APIs may still shift before a stable release.

- [x] Platform-agnostic engine — routing, tools, agent loop, action binding
- [x] JSX message vocabulary with cross-platform rendering
- [x] Human-in-the-loop via `awaitChoice` / `onInterrupt` / `resume`
- [x] Slack reference adapter (+ Teams, Discord, Telegram, WhatsApp, Google Chat)
- [x] A complete reference app — [OpenTag](https://github.com/CopilotKit/OpenTag)
- [ ] Durable action-store recipes (Redis, Postgres)
- [ ] Adapter authoring guide

## Contributing

Issues and PRs are welcome. If you're building an adapter for a platform we don't cover yet, open an issue first — we'd love to help and to link it here.

## License

[MIT](./LICENSE) © CopilotKit
