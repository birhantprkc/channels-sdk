# Intelligence project, API key, and Channel

This phase is **entirely browser work, in the developer's own signed-in session**.
No command creates a project, a Channel, an API key, or a Slack adapter.

The dashboard is at **`https://intelligence.copilotkit.ai`** — the URL documented
by the starter's `.env.example`. Confirm it from the app you are setting up rather
than assuming; `INTELLIGENCE_API_URL` in that file names the API host for the same
environment.

## Navigate by goal, not by remembered labels

There is **no published dashboard walkthrough** for managed Channels — the Slack
platform page in the public docs covers only the direct adapter, and the
Intelligence platform page is not currently published. So you cannot pre-load the
UI's labels, and you must not invent them.

Work by goal, and for each step: **read the page, state what you are about to
change, get an explicit yes, then act.** Creating a Channel, attaching a platform,
and issuing a key are consequential mutations in a live account. Never click a
control you have not read.

If a goal has no obvious control on the page, say so and ask the developer what
they see. That is faster and safer than guessing.

## The four things that must line up

Every failure in this phase collapses into the same silent `setup_required`, so
check all four rather than assuming:

1. **The Channel's name matches what the code declares**, character for character.
   Lowercase kebab-case. `examples/OpenTag` declares `open-tag` by default.
2. **A Slack adapter is attached to that Channel and reports connected.** Created
   is not connected.
3. **The Channel and the API key belong to the same project.** The key selects the
   project; a key from another project activates a different Channel set entirely
   and looks like a name mismatch.
4. **The endpoint defaults are untouched.** Leave `INTELLIGENCE_API_URL` and
   `INTELLIGENCE_GATEWAY_WS_URL` unset so both default to production.

## The order to do it in

1. **Sign in** and select or create a project. One project per environment is the
   documented convention — do not point a local runtime at a project a deployed
   service is using.
2. **Create the Channel**, named exactly what the code declares. Get this from the
   code, not from memory:

   ```bash
   grep -rn "CHANNEL_NAME\|CHANNEL_CODE\|createChannel(" app/ server.ts .env.example
   ```

   Naming it after the display name instead of the code's name is a common and
   confusing failure — a Channel shown as "OpenTag (Dev)" whose name is
   `open-tag` is fine; a Channel whose *name* is `OpenTag (Dev)` is not.
3. **Attach the Slack adapter** to that Channel. This is where the `xapp-` and
   `xoxb-` tokens go, **typed by the developer**. Tell them which field takes
   which token; never take the values yourself.
4. **Issue a project-scoped runtime API key.** The developer copies it straight
   into `.env` as `INTELLIGENCE_API_KEY`. It should not pass through the chat.

## Reading the status

Before your runtime connects, the Channel is expected to show that it is waiting
for a runtime. Once your process activates it, it should flip to **Online**.

- **Waiting for runtime, while your process is running** → the process is not
  reaching this Channel: name mismatch, wrong project, or the key is not the one
  in `.env`.
- **Online, while your process is stopped** → something else is claiming this
  Channel. Find it before starting yours.
- **Online, while your process runs** → this phase is done.

## One consumer per Channel

Managed delivery is claim-based. Two runtimes declaring the **same Channel name in
the same project** race for each delivery, and the loser gets nothing — silently.
The tell is a reply appearing in Slack that your terminal knows nothing about.

Give the local runtime its own project, or at minimum stop the other consumer.
Never run a laptop runtime against a Channel a deployed service is serving.

## If the dashboard cannot do what this phase needs

Managed Channels are **enabled by default on production Intelligence for
everyone**, so expect creating a Channel and attaching Slack to be available. If
they are not — with all four alignments verified you see any of:

- no option to attach a Slack platform to a Channel at all,
- no way to create a Channel in the project, or
- a Channel that stays `setup_required` with a correctly attached Slack adapter,

then this is **unexpected**, not a known limitation to route around. **Stop and
say so plainly**, with what you observed: it is an account or platform question
for the CopilotKit team.

Do **not** respond by switching to a direct Slack adapter, and do not point the
runtime at a non-production Intelligence environment. Both are out of scope, and
both mean the developer ends up validating something other than what they asked
about. Report the blocker and let them decide.

## Things that are not required

The runtime needs the API key and the Channel name. It does **not** need an
organization id, project id, Channel id, or runtime-instance id in its
environment, and it does **not** need Slack credentials. If you find yourself
hunting for those, re-read the app's env parser — you are solving a problem it
does not have.
