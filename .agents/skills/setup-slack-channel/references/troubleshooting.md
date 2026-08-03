# Troubleshooting a managed Slack Channel

Diagnose by layer, in this order: **runtime → Intelligence → Slack → agent**.
Runtime comes first because one command there names the failure, which saves you
from guessing at the other three.

Everything below was verified against the currently published
`@copilotkit/channels@0.6.0` and `@copilotkit/runtime@1.65.0`. Never quote line
numbers at the developer, and re-read the installed package if a claim looks
wrong — the API is moving, and a starter may pin something older or newer.

## First move: make the runtime tell the truth

A Channels runtime that starts, prints its listening line, and answers nothing
is the **normal** appearance of a misconfigured Channel. Two verified facts
combine to produce that silence:

1. `ready()` resolves once every Channel settles into a **terminal** state, and
   `setup_required` is terminal. It is documented as "a valid degraded state,
   not a failure." So `await ready()` succeeding does not mean Slack is
   connected.
2. Every Channel lifecycle breadcrumb — including `channel "<name>" requires
   setup` — is emitted through `logger.warn`, and the runtime's logger defaults
   to `level: process.env.LOG_LEVEL || level || "error"`. **At the default
   level, warn is discarded.** The diagnosis is already being written and
   thrown away.

So the first thing you do is restart with the logs turned up:

```bash
LOG_LEVEL=debug pnpm runtime
```

Then send one fresh mention and read the output.

| Log line | Layer | Meaning and fix |
| --- | --- | --- |
| `channel "<name>" requires setup` | Intelligence | The Channel exists but has no working platform provider for this project. Fix in the dashboard — attach or repair the Slack adapter. Never a code fix. |
| `channel "<name>" failed to activate` | Intelligence | Activation was rejected: wrong or revoked API key, or an unreachable gateway. The attached error names which. |
| `managed session dropped; reconnecting` / `gave up reconnecting` | Runtime/network | Transport, not configuration. Check egress to `wss://realtime.intelligence.copilotkit.ai`. |
| `channel delivery claim or join failed` | Intelligence | The turn **did** arrive and this process lost the claim. Almost always a second consumer on the same Channel name. |
| Nothing at all on mention | Slack or Intelligence | The event never reached this process. Continue below. |

## Ground truth: `status()`, not "it started"

There is **no HTTP endpoint that reports Channel status** — `/api/copilotkit/info`
reports license and runtime info, not channel state. The status only exists
in-process, so read it there:

```ts
const status = controls.status(); // { overall, channels: Record<string, ChannelStatus> }
console.log("[channels] status", JSON.stringify(status));
```

Better, make a non-online start a crash instead of a silent success — this is
what the Channels SDK README's quickstart does, and what `examples/OpenTag`'s
`server.ts` omits:

```ts
await controls.ready({ timeoutMs: 30_000 });
const status = controls.status();
if (status.overall !== "online") {
  throw new Error(`Channel is not online: ${JSON.stringify(status)}`);
}
```

`ChannelStatus` is a closed union. Each value points at exactly one layer:

| Status | Layer | What it means | What to do |
| --- | --- | --- | --- |
| `online` | — | Activated **and** the managed session can currently send. | The runtime is fine. Move to the Slack layer. |
| `setup_required` | Intelligence | Declared, but no managed provider is bound. | Attach the Slack adapter to *this* Channel in *this* project. |
| `connecting` | Runtime | Never settled. | `ready()`'s timeout is too short for this network, or the gateway is unreachable. |
| `reconnecting` | Runtime/network | The managed session dropped; Phoenix is retrying. Not sendable. | Transport problem. Check egress and stability. |
| `error` | Intelligence/runtime | Activation rejected with a non-setup error, or reconnect gave up. | Read the rejection from `ready()` — it does reject on `error`. |
| `stopped` | Runtime | `stop()` has run. | Something tore the Channel down — usually a shutdown path firing early. |

## Slack layer

Check in this order; each is cheap and each fully explains "nothing happens".

1. **Is the app actually in the channel?** Workspace-installed ≠ channel member.
   Slack does not emit `app_mention` for a channel the app is not in — it shows
   the human an invite prompt instead, and nothing enters the pipeline. Run
   `/invite @YourBot` in that channel.
2. **Does a DM work?** This is the cleanest discriminator. DMs arrive via
   `message.im` without channel membership. *DM works, channel doesn't* is a
   near-certain membership problem — **but read the handler-routing section
   below first**, because for some apps the reverse is expected.
3. **Did the `xoxb-` and `xapp-` tokens come from the same Slack app?** A
   valid-but-mismatched pair cannot be detected during setup. It looks
   configured and never delivers.
4. **Is Socket Mode still enabled, and interactivity still on?** Managed
   delivery consumes events over Socket Mode using the app-level token.
   Interactivity off means buttons and selects are never delivered even when
   text replies work.
5. **Are the event subscriptions present?** `app_mention` for channel mentions,
   `message.im` for DMs. Editing the manifest after install can drop them.

## Handler routing — the silent no-op that looks like a Slack failure

Turn routing is not symmetric, and this trips people constantly:

- A **mentioned** turn goes to `onMention` handlers if any are registered, and
  otherwise falls back to `onMessage`.
- A **non-mentioned** turn (a DM, a plain message) goes **only** to `onMessage`.

So an app that registers `onMention` and not `onMessage` — which is what OpenTag
does — handles mentioned turns, and does **nothing at all**, with no log and no
error, for any turn that is not flagged as mentioned.

Whether a **managed DM** is flagged as mentioned is decided by Intelligence
server-side and arrives in the delivery payload, so it cannot be determined by
reading the SDK. Treat it as an empirical question rather than assuming either
way, and note that the client distinguishes a `direct_message` surface from an
`app_mention` surface — so do not assume a DM implies `mentioned`.

Diagnose it like this: if a **channel mention works but a DM does nothing**, and
only `onMention` is registered, that is handler coverage, not a Slack or
Intelligence fault. Adding an `onMessage` handler is the fix. Check what is
actually registered before touching either of the other layers:

```bash
grep -n "onMention\|onMessage\|onCommand\|onThreadStarted" app/channel.tsx
```

## Silent drops, and what concurrency actually does

**Turns run in parallel by default.** `store.concurrency` is
`"parallel" | "serial" | "drop"` and defaults to **`"parallel"`** — concurrent
turns on one conversation run together with no exclusive turn lock. So an
overlapping turn being silently discarded is **not** the default behavior. Only
reach for this explanation if the app opts in:

| Setting | Overlapping turn on the same conversation |
| --- | --- |
| `"parallel"` (default) | Runs alongside the in-flight turn |
| `"serial"` | Waits for the in-flight turn to finish |
| `"drop"` | **Discarded, with no log** |

`store.onLockConflict` (`"drop"` / `"force"`) is the legacy form of the same
setting; `concurrency` wins when both are set. Check which the app configures
before theorizing:

```bash
grep -n "concurrency\|onLockConflict\|dedupTtl" app/channel.tsx app/*.ts
```

**Inbound dedup is still a silent drop.** A repeated event id inside the dedup
window (default 300000 ms) returns with no log at any level. With a durable
store this survives a restart, so a re-fired identical event stays dropped.

**The test that separates a drop from a delivery failure:** create a brand-new
Slack channel, invite the bot, and mention it with text you have never sent
before.

- Fresh channel + novel text works → it was a dedup drop (or a configured
  `drop`/`serial` mode) scoped to the old conversation.
- Fresh channel is also silent → not a drop. Back to the Slack or Intelligence
  layer.

## A shared agent instance blocks unrelated conversations

Because turns default to parallel, **sharing one `AbstractAgent` across turns is
not safe.** The SDK isolates per turn by cloning, and fails loud if cloning
cannot isolate — a missing `clone()`, a `clone()` returning the same object, or
one that drops subclass state.

The symptom to recognize: managed delivery serializes on **object identity**, so
one shared instance **head-of-line blocks two different conversations**. If
unrelated threads queue behind each other, the agent factory is handing back the
same object rather than a fresh agent per `threadId`.

## Two consumers on one Channel

If any other process declares the **same Channel name against the same
project** — a deployed staging/production runtime, or a stale local process —
your mention may be served there instead. The tell is that Slack gets a reply
that your terminal knows nothing about.

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
pgrep -fl "tsx.*server.ts"
```

For a deployed twin, either stop it or give your local runtime its **own**
Channel and name. Do not race two consumers on one Channel — one of them
silently loses every claim.

## Intelligence layer

Four things must line up. All four failures converge on the same silent
`setup_required`, which is why the log line above is worth more than any amount
of dashboard clicking:

1. The Channel's identifier matches what the process declares, **character for
   character** (lowercase kebab-case).
2. The Channel has a Slack adapter attached and reporting connected — created is
   not the same as connected.
3. The Channel lives in the **same project** as the API key the runtime is
   using. A key from another project activates a *different* Channel set.
4. Both endpoint overrides agree. `INTELLIGENCE_API_URL` and
   `INTELLIGENCE_GATEWAY_WS_URL` are separate hosts, so the ws URL cannot be
   derived from the API URL. Override **both or neither**, as bare base URLs
   with no `/api` or `/socket` path. Setting only one silently leaves the other
   pointed at the managed host, and a wrong ws URL does not raise — it hangs in
   `connecting`. For this skill's scope, leave both unset so they default to
   production.

## Agent layer

Reached only once the Channel is `online` and the turn is arriving. The tell is
that Slack gets *something* — a reply, an error message, a stall — rather than
silence.

| Symptom | Cause |
| --- | --- |
| A user-facing error reply appears in Slack | The agent run threw. Read the runtime console: OpenTag's mention handler posts an apology and reports the error via `console.error`, which is visible at **any** `LOG_LEVEL`. |
| Long stall, then nothing | `AGENT_URL` points somewhere that is not answering. Verify the agent is up (`curl` its health path) before blaming the Channel. |
| Replies mix up conversations | The agent factory is returning a shared instance. It must return a fresh agent per `threadId`. |
| The agent answers but renders no UI | A component or tool isn't registered, or the surface degraded the node. The renderer is total: an unrenderable node is skipped, not thrown. |

## The trap to remember

A correctly installed Slack app plus a misconfigured Channel produces a runtime
that prints a cheerful listening line and does nothing forever, because
`setup_required` is a valid state, `ready()` accepts it, its warning is at
`warn`, and the logger defaults to `error`. **That is the single most likely
explanation for "no error in my terminal."** Start there.
