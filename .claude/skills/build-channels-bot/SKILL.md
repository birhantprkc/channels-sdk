---
name: build-channels-bot
description: >-
  Build an AI bot with the CopilotKit Channels SDK (@copilotkit/channels) — a
  platform-agnostic engine for agents that live in Slack, Teams, Discord,
  Telegram, WhatsApp, and Google Chat and render native interactive UI. It's the
  engine behind OpenTag, the open-source alternative to Claude in Slack. Use this
  whenever the user wants to
  create, scaffold, or extend a Channels SDK bot; wire an agent into Slack/
  Discord/Teams; add a tool, slash command, button, select, or human-in-the-loop
  confirmation to a chat bot; or asks about createChannel, defineChannelTool,
  thread.runAgent, awaitChoice, or the channels-ui JSX components. Trigger even
  when the user says "Slack bot", "Discord bot", or "chat agent" without naming
  the SDK, as long as the context is CopilotKit / Channels. The Channels API is
  new and easy to get wrong from memory — always ground code in this skill.
---

# Build a Channels SDK bot

The Channels SDK (`@copilotkit/channels`) is a **platform-agnostic bot engine**.
You write bot logic once — handlers, tools, and JSX-rendered messages — and it
runs on any messaging platform through a swappable adapter. The agent drives
real interactive UI in the conversation (buttons, selects, charts), runs tools,
and can pause for human input mid-run.

This API is recent and not reliably in model memory. **Do not guess the API from
what a Slack/Discord SDK usually looks like** — the shapes below are the real
ones, verified against `@copilotkit/channels@0.6.0`. When in doubt, prefer the
exact names here over anything remembered.

> **Naming:** the factory is `createChannel`, not `createBot`; tools are
> `defineChannelTool`, not `defineBotTool`. An earlier generation of this SDK
> used `Bot`-prefixed names and they do **not** exist in the shipped packages —
> importing them fails to compile. "Bot" survives only as an informal word for
> the thing you build (and as the conventional variable name).

## The mental model (five pieces)

1. **Channel** — `createChannel()` returns a `Channel`; you attach handlers to it.
2. **Thread** — the per-conversation handle passed to every handler; you render
   and drive the conversation through it.
3. **Tools** — typed functions the agent can call (`defineChannelTool`).
4. **UI** — JSX from `@copilotkit/channels-ui` that renders natively per platform.
5. **Context** — knowledge injected into the agent's prompt per run.

## Packages

`@copilotkit/channels` is **batteries-included**: one install gives you the
engine, the JSX vocabulary, the UI primitives, the testing API, and every
adapter. Prefer it over the split packages.

```sh
pnpm add @copilotkit/channels @copilotkit/runtime
```

- `@copilotkit/channels` — `createChannel`, `defineChannelTool`,
  `defineChannelCommand`, `ContextEntry`, **and** the UI components
  (`Message`, `Section`, `Button`, …) all from the root import.
  Adapters live on subpaths: `@copilotkit/channels/slack`, `/teams`,
  `/discord`, `/telegram`, `/whatsapp`. UI is also at `/ui`.
- `@copilotkit/runtime` — **required to start a Channel.** The runtime owns the
  Channel lifecycle (see below). Your *agent* can still be anything AG-UI
  compatible (LangGraph, CrewAI, custom) via the `agent` factory.

Channels and Runtime ship as a tested pair — upgrade them together. Standalone
`@copilotkit/channels-ui` / `-slack` / `-teams` / … packages also exist and work,
but the single dependency is the documented path.

**A CopilotKit Intelligence API key is required** (free tier available). There is
no standalone/DIY way to run a Channel — the runtime starts each Channel only
once Intelligence is configured.

**Reference app:** [OpenTag](https://github.com/CopilotKit/OpenTag) is a complete, real bot built on this SDK (the open-source alternative to Claude in Slack). When a task is close to "a full Slack agent app", it's the best end-to-end example to mirror.

## createChannel — the entry point

**Default to a managed Channel.** Intelligence holds the platform credentials,
so your process carries no Slack or Teams tokens and you add platforms in the
dashboard rather than in code. There is no adapter at all:

```ts
import { createChannel } from "@copilotkit/channels";

const bot = createChannel({
  name: process.env.CHANNEL_CODE!, // must match the Channel code in Intelligence
  identifyUser: "platform",        // REQUIRED — see below
  agent: (threadId) => makeAgent(threadId), // factory: one agent per thread
});
```

- **`identifyUser` is required.** `"platform"` derives the canonical user from
  provider + workspace + platform user id — the right default. Or pass a
  callback `(ctx) => ApplicationUser | null` to map onto your own user table.
- `agent` accepts a factory `(threadId) => agent` **or** a single agent. Prefer
  the factory: turns default to `"parallel"` concurrency and sharing one agent
  instance across concurrent turns corrupts its message state.

Other useful options: `tools`, `context`, `components` (register JSX components
so their handlers survive a restart), `store` (persistence, per-thread state
schema, transcripts, `concurrency`), `commands` (`defineChannelCommand` specs),
`showToolStatus`, `sanitizeAgentEvents`.

### Direct adapter — only when you own the platform connection

Pass `adapters` when *you* hold the platform tokens. This is the secondary path:
it means platform secrets in your app and per-platform wiring in code. It does
**not** avoid needing Intelligence — the runtime still owns the lifecycle.

Do not reach for this because a managed Channel is reporting `setup_required` or
because the dashboard is unfamiliar — swapping to a direct adapter to "make it
work" is a known failure mode, not a fallback. Fix the managed setup instead.

```ts
import { slack, defaultSlackTools, defaultSlackContext } from "@copilotkit/channels/slack";

const bot = createChannel({
  name: "support-bot",
  identifyUser: "platform",
  adapters: [
    slack({
      botToken: process.env.SLACK_BOT_TOKEN!, // xoxb-…
      appToken: process.env.SLACK_APP_TOKEN!, // xapp-… (Socket Mode)
    }),
  ],
  agent: (threadId) => makeAgent(threadId),
  tools: [...defaultSlackTools /* , ...yourTools */],
  context: [...defaultSlackContext /* , ...yourContext */],
});
```

`adapters` is an array — one bot can run several platforms at once.
`defaultSlackTools` / `defaultSlackContext` add `lookup_slack_user` plus
tagging/mrkdwn/threading guidance; include them for direct Slack.

For getting the Slack app, tokens, Intelligence Channel, and a local agent
actually lined up, that is a setup workflow rather than an API question — see the
`setup-slack-channel` skill if it is available in the repo.

## Starting it — the runtime owns the lifecycle

**There is no `bot.start()`.** A Channel is runtime-driven: attach it to a
`CopilotRuntime` and create a listener. Creating the listener starts the
connection.

```ts
import { CopilotRuntime, CopilotKitIntelligence } from "@copilotkit/runtime/v2";
import { createCopilotNodeListener } from "@copilotkit/runtime/v2/node";

const runtime = new CopilotRuntime({
  agents: {}, // required, even when the Channel supplies the agent
  intelligence: new CopilotKitIntelligence({
    apiKey: process.env.COPILOTKIT_INTELLIGENCE_API_KEY!,
  }),
  channels: [bot],
});

const listener = createCopilotNodeListener({ runtime });
const channels = listener.channels;
if (!channels) throw new Error("Channels control surface was not created.");

await channels.ready({ timeoutMs: 30_000 });

// `ready()` is NOT proof the Channel is connected — it also resolves on
// `setup_required`, a declared-but-unprovisioned Channel (a "valid degraded
// state"). Check the status or you get a process that starts cleanly, serves
// HTTP 200, and answers nothing in Slack.
const status = channels.status();
if (status.overall !== "online") {
  throw new Error(`Channel is not online: ${JSON.stringify(status)}`);
}

process.once("SIGTERM", () => channels.stop());
```

Needs Node.js 22+ and a long-running process or container. For an HTTP server,
pass the listener to `createServer(listener)` and `server.listen(port)`.

## Channel handlers

Attach these to the object `createChannel` returned, before the runtime starts it.

| Handler | Fires when | Handler gets |
| --- | --- | --- |
| `bot.onMention(fn)` | the bot is @-mentioned (takes priority over `onMessage`) | `{ thread, message }` |
| `bot.onMessage(fn)` | any message the bot sees | `{ thread, message }` |
| `bot.onThreadStarted(fn)` | a conversation surface opens (e.g. Slack assistant pane) | `{ thread, user, actor }` |
| `bot.onWelcome(fn)` | the app is installed / a conversation is activated | `{ thread, user, actor, platform }` |
| `bot.onCommand(name, fn)` | a slash command runs | `CommandContext` |
| `bot.onInteraction<T>(id, fn)` | a bound action fires (explicit binding) | `InteractionContext<T>` |
| `bot.onInterrupt<T>(event, fn)` | the agent pauses mid-run | `{ payload, thread, user, actor }` |
| `bot.onReaction([emoji,] fn)` | an emoji reaction is added/removed | `ReactionEvent` |
| `bot.onModalSubmit(id, fn)` | a modal is submitted (return `{ errors }` to keep it open) | `ModalSubmitEvent` |
| `bot.onModalClose(id, fn)` | a modal is dismissed | `ModalCloseEvent` |

Note `onMention`/`onMessage` get `{ thread, message }` only — no `user`. Reach
the caller via the message, or use `identifyUser` plus a handler that exposes
`user` (`onThreadStarted`, `onWelcome`, tool context).

The most common shape is: reply on mention by running the agent.

```ts
bot.onMention(async ({ thread }) => {
  await thread.runAgent();
});
```

## The Thread API

Every handler receives `thread`. Key methods:

```ts
thread.post(ui)                 // render a JSX message → returns a MessageRef
thread.update(ref, ui)          // replace a previously posted message
thread.delete(ref)              // remove a message
thread.stream(src)              // stream a string / AsyncIterable<string> live
thread.postFile({ ... })        // upload a file
thread.postEphemeral(user, ui)  // visible to one user (capability-gated)
thread.runAgent(input?)         // run the agent loop; input?: { prompt?, context?, tools? }
thread.resume(value)            // re-enter after an interrupt → MessageRef | undefined
thread.awaitChoice<T>(ui)       // post a picker and BLOCK until the user chooses
thread.getMessages()            // read the conversation (capability-gated)
thread.setTitle(title)          // rename the surface
thread.setSuggestedPrompts(...) // suggest follow-ups
thread.react(ref, emoji)        // add / remove a reaction (also unreact)
thread.state<T>() / setState(v) // per-thread state (typed by store.state schema)
thread.lookupUser(query)        // resolve a platform user (capability-gated)
```

`runAgent` drives the agent's run / tool-call / interrupt loop and renders each
step as it streams. Prefer it over hand-managing the loop.

## Tools

Tools are plain functions with a typed parameter schema. Parameters accept any
[Standard Schema](https://standardschema.dev) validator (Zod, Valibot, ArkType).
The handler receives the parsed args and a context object with the **live
thread** — so a tool can post UI, ask a question, or run a HITL flow mid-execution.

```ts
import { defineChannelTool } from "@copilotkit/channels";
import { z } from "zod";

const getSchedule = defineChannelTool({
  name: "get_oncall",
  description: "Look up who is currently on call for a team.",
  parameters: z.object({ team: z.string() }),
  async handler({ team }, { thread, user, actor, signal, platform }) {
    return await fetchOncall(team); // returned value goes back to the agent
  },
});
```

`ChannelToolContext` = `{ thread, message?, user, actor, signal?, platform }`,
where `user` is `ApplicationUser | null`.

The return value is what the **agent** reads back, not the user. Return the raw
data (it's JSON-stringified for you — don't hand-stringify, don't return
`{ ok: true }`). For a tool that posts a card, return a short natural-language
confirmation like `"Displayed the issue card."` so the model doesn't restate it.
On failure, return the actual error text so the model can repair and retry.

Register tools via `createChannel({ tools })`, or `bot.tool(t)` before start.

## Interactive UI — the channels-ui JSX vocabulary

Import components from `@copilotkit/channels-ui` and pass a tree to `thread.post`,
`thread.update`, or `thread.awaitChoice`. The **same tree** renders as Block Kit
on Slack, components on Discord, and Adaptive Cards on Teams. A surface that
can't render a node skips it (the renderer is total) — so rich UI degrades
gracefully instead of erroring.

```tsx
import {
  Message, Header, Section, Markdown, Fields, Field,
  Actions, Button, Divider, Image,
} from "@copilotkit/channels-ui";

await thread.post(
  <Message accent="#ff6600">
    <Header>Top story</Header>
    <Section><Markdown>**{story.title}** — {story.points} points</Markdown></Section>
    <Fields>
      <Field label="Author">{story.by}</Field>
      <Field label="Comments">{story.descendants}</Field>
    </Fields>
    <Actions>
      <Button url={story.url}>Open link</Button>
      <Button value={story.id} style="primary" onClick={async ({ action, thread }) => {
        await thread.post(<Section>Summarizing {action.value}…</Section>);
      }}>Summarize</Button>
    </Actions>
  </Message>,
);
```

See [references/ui-components.md](references/ui-components.md) for the full
component list and their props (`Select`, `Input`, `Table`, `Chart`, etc.) and
the cross-platform degradation rules. **Read it before using a component you
haven't used here** — do not invent tag names or props.

### JSX setup (required, easy to miss)

A file containing JSX must be **`.tsx`** and the tsconfig must point the JSX
factory at Channels — this is not React:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@copilotkit/channels",
    "module": "nodenext",
    "moduleResolution": "nodenext"
  }
}
```

Without `jsxImportSource` the tree compiles against React and fails. (Pointing it
at `@copilotkit/channels-ui` also works if you installed that package directly.)

## Human-in-the-loop

Two patterns. Use `awaitChoice` for a simple picker; use `onInterrupt` +
`resume` when the agent itself pauses (e.g. a LangGraph interrupt).

```tsx
const ok = await thread.awaitChoice<boolean>(
  <Message accent="#E01E5A">
    <Section><Markdown>Deploy to **production**? This is irreversible.</Markdown></Section>
    <Actions>
      <Button value={true} style="primary">Ship it</Button>
      <Button value={false} style="danger">Cancel</Button>
    </Actions>
  </Message>,
);
if (!ok) return "User cancelled; nothing was deployed.";
```

`awaitChoice<T>` blocks the handler until the user clicks; the clicked
`Button`'s `value` (typed as `T`) is what it resolves to. Because a tool handler
gets the live `thread`, call it directly inside a `defineChannelTool` handler to
gate a destructive tool on approval. See
[references/hitl-patterns.md](references/hitl-patterns.md) for `onInterrupt` /
`resume`, and for why action handlers survive restarts (content-stable IDs +
a durable store).

## Context

`ContextEntry` values are `{ description: string; value: string }` pairs injected
into the agent's prompt per run — the channel, the caller's role, anything that
grounds the turn. Pass them at `createChannel({ context })` or per-run via
`thread.runAgent({ context })`.

## Slash commands

```ts
bot.onCommand("top", async ({ thread }) => {
  const stories = await fetchTopStories(5);
  await thread.post(/* a <Message> listing them */);
});
```

For richer command metadata (description, argument hints registered with the
platform), use `defineChannelCommand` and pass it via `commands` — see the
adapter's `registerCommands` capability.

## Adding a new platform

If the user needs a surface with no adapter yet, they implement `PlatformAdapter`
— the engine and bot logic don't change. This is an advanced path; read
[references/adapter-authoring.md](references/adapter-authoring.md) only when the
task is specifically "add support for platform X".

## Common mistakes to avoid

- Do **not** use `createBot`, `defineBotTool`, `defineBotCommand`, or
  `BotToolContext` — they do not exist. Use `createChannel`,
  `defineChannelTool`, `defineChannelCommand`, `ChannelToolContext`.
- Do **not** call `bot.start()` / `bot.stop()` — there is no public lifecycle
  method. Attach the Channel to `CopilotRuntime` and create a listener.
- Do **not** omit `identifyUser` — it is a required option.
- Do **not** pass `provider: "slack"` to `createChannel` — no such option. The
  platform comes from the adapter, or from Intelligence for a managed Channel.
- Do **not** call `new Bot()` or `bot.on("message", …)` — use the named
  `onMention` / `onMessage` / `onCommand` handlers.
- Do **not** hand-build Block Kit / embeds / Adaptive Cards JSON — render JSX
  from `@copilotkit/channels-ui` and let the adapter translate it.
- Prefer a factory `agent: (threadId) => agent` over a shared agent instance.
- Prefer `thread.runAgent()` over manually looping over agent events.
- Do **not** write a handler as a concise arrow returning `thread.post(...)` —
  handlers must return `void | Promise<void>` and `post` returns a `MessageRef`,
  which fails under `strict`. Use a block body and `await` it:
  `async ({ thread }) => { await thread.post(…); }`.
- A file that contains JSX must be **`.tsx`** with
  `jsxImportSource: "@copilotkit/channels-ui"` — otherwise it won't compile.
