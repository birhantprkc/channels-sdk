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
  confirmation to a chat bot; or asks about createBot, defineBotTool,
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
ones. When in doubt, prefer the exact names here over anything remembered.

## The mental model (five pieces)

1. **Bot** — `createBot()` returns a `Bot`; you attach handlers to it.
2. **Thread** — the per-conversation handle passed to every handler; you render
   and drive the conversation through it.
3. **Tools** — typed functions the agent can call (`defineBotTool`).
4. **UI** — JSX from `@copilotkit/channels-ui` that renders natively per platform.
5. **Context** — knowledge injected into the agent's prompt per run.

## Packages

- `@copilotkit/channels` — the engine (`createBot`, `defineBotTool`, `defineBotCommand`, `ContextEntry`, `ActionStore`).
- `@copilotkit/channels-ui` — the JSX vocabulary (`Message`, `Section`, `Button`, …).
- `@copilotkit/channels-slack` — the Slack adapter (reference implementation). Each surface is its own adapter package following `@copilotkit/channels-<platform>`: `-teams`, `-discord`, `-telegram`, `-whatsapp`, `-google-chat`.
- `@copilotkit/runtime` — the agent backend the bot drives (the AG-UI runtime). Optional — any AG-UI-compatible agent (LangGraph, CrewAI, custom) works via the `agent` factory.

Install: `pnpm add @copilotkit/channels @copilotkit/channels-ui @copilotkit/channels-slack`

**Reference app:** [OpenTag](https://github.com/CopilotKit/OpenTag) is a complete, real bot built on this SDK (the open-source alternative to Claude in Slack). When a task is close to "a full Slack agent app", it's the best end-to-end example to mirror — it wires `@copilotkit/runtime` as the agent backend and the Channels SDK as the chat surface.

## createBot — the entry point

```ts
import { createBot, defineBotTool } from "@copilotkit/channels";
import { slack } from "@copilotkit/channels-slack";

const bot = createBot({
  adapters: [
    slack({
      botToken: process.env.SLACK_BOT_TOKEN!,
      appToken: process.env.SLACK_APP_TOKEN!,
    }),
  ],
  agent: (threadId) => makeAgent(threadId), // factory: one agent per thread
  tools: [/* defineBotTool(...) */],
  context: [/* { description, value } */],
});

await bot.start(); // bot.stop() to tear down
```

`adapters` is an array — the same bot can run on several platforms at once.
`agent` is a **factory** taking a `threadId` and returning the agent to drive.

## Bot handlers

Attach these to the returned `bot`. Register them before `start()`.

| Handler | Fires when | Handler gets |
| --- | --- | --- |
| `bot.onMention(fn)` | the bot is @-mentioned (takes priority over `onMessage`) | `{ thread, message, user? }` |
| `bot.onMessage(fn)` | any message the bot sees | `{ thread, message, user? }` |
| `bot.onThreadStarted(fn)` | a conversation surface opens | `{ thread, user? }` |
| `bot.onCommand(name, fn)` | a slash command runs | `{ thread, args?, user? }` |
| `bot.onInteraction<T>(id, fn)` | a bound action fires (explicit binding) | interaction ctx |
| `bot.onInterrupt<T>(event, fn)` | the agent pauses mid-run | interrupt payload |

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
thread.runAgent(input?)         // run the agent loop; input?: { context?, tools? }
thread.resume(value)            // re-enter after an interrupt with a value
thread.awaitChoice<T>(ui)       // post a picker and BLOCK until the user chooses
thread.getMessages()            // read the conversation (capability-gated)
thread.setTitle(title)          // rename the surface
thread.setSuggestedPrompts(...) // suggest follow-ups
```

`runAgent` drives the agent's run / tool-call / interrupt loop and renders each
step as it streams. Prefer it over hand-managing the loop.

## Tools

Tools are plain functions with a typed parameter schema. Parameters accept any
[Standard Schema](https://standardschema.dev) validator (Zod, Valibot, ArkType).
The handler receives the parsed args and a context object with the **live
thread** — so a tool can post UI, ask a question, or run a HITL flow mid-execution.

```ts
import { defineBotTool } from "@copilotkit/channels";
import { z } from "zod";

const getSchedule = defineBotTool({
  name: "get_oncall",
  description: "Look up who is currently on call for a team.",
  parameters: z.object({ team: z.string() }),
  async handler({ team }, { thread, user, signal, platform }) {
    return await fetchOncall(team); // returned value goes back to the agent
  },
});
```

`BotToolContext` = `{ thread, message?, user?, signal?, platform }`.

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

## Human-in-the-loop

Two patterns. Use `awaitChoice` for a simple picker; use `onInterrupt` +
`resume` when the agent itself pauses (e.g. a LangGraph interrupt).

```tsx
const ok = await thread.awaitChoice<boolean>(
  <Section>
    Deploy to <b>production</b>?
    <Actions>
      <Button value={true} style="primary">Ship it</Button>
      <Button value={false} style="danger">Cancel</Button>
    </Actions>
  </Section>,
);
if (!ok) return "Cancelled.";
```

`awaitChoice<T>` blocks the handler until the user clicks; the clicked
`Button`'s `value` (typed as `T`) is what it resolves to. See
[references/hitl-patterns.md](references/hitl-patterns.md) for `onInterrupt` /
`resume`, and for why action handlers survive restarts (content-stable IDs +
`ActionStore`).

## Context

`ContextEntry` values are `{ description: string; value: string }` pairs injected
into the agent's prompt per run — the channel, the caller's role, anything that
grounds the turn. Pass them at `createBot({ context })` or per-run via
`thread.runAgent({ context })`.

## Slash commands

```ts
bot.onCommand("top", async ({ thread, args }) => {
  const stories = await fetchTopStories(5);
  await thread.post(/* a <Message> listing them */);
});
```

For richer command metadata (description, argument hints registered with the
platform), use `defineBotCommand` and pass it via `commands` — see the adapter's
`registerCommands` capability.

## Adding a new platform

If the user needs a surface with no adapter yet, they implement `PlatformAdapter`
— the engine and bot logic don't change. This is an advanced path; read
[references/adapter-authoring.md](references/adapter-authoring.md) only when the
task is specifically "add support for platform X".

## Common mistakes to avoid

- Do **not** call `new Bot()` or `bot.on("message", …)` — use `createBot(...)`
  and the named `onMention` / `onMessage` / `onCommand` handlers.
- Do **not** hand-build Block Kit / embeds / Adaptive Cards JSON — render JSX
  from `@copilotkit/channels-ui` and let the adapter translate it.
- Do **not** invent a tool-registration API — tools are `defineBotTool(...)`
  passed to `createBot({ tools })` (or `bot.tool(t)` before `start()`).
- `agent` is a **factory** `(threadId) => agent`, not an agent instance.
- Prefer `thread.runAgent()` over manually looping over agent events.
- A file that contains JSX (`<Section>…`, `<Button>…`) must use the **`.tsx`**
  extension and a JSX-enabled tsconfig, not `.ts` — otherwise it won't compile.
