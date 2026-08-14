# Mastra Sandbox Channel

A backend-only Slack example that runs a Mastra agent with a local workspace
through CopilotKit Channels.

Mentioning the agent subscribes the conversation, so follow-up messages do not
need another mention. The agent can read and write files under `sandbox/`, run
local commands, use the included Datadog APM skill, unsubscribe from the
conversation, and render native Slack bar charts.

`LocalSandbox` runs child processes on your machine. It limits the working
directory, but it is not a container or a production security boundary.

## Run

You need Node.js 22.13+, pnpm, an OpenAI API key, and a managed Channel in
[CopilotKit Intelligence](https://docs.copilotkit.ai/channels).

```sh
pnpm install
cp .env.example .env
pnpm dev
```

Set the real keys and exact Intelligence Channel Code in `.env`. When the
process reports that the Channel is online, invite the connected app to Slack
and try:

```text
@agent Use the sandbox to run pwd and list the files you can see.
```

Follow up without a mention:

```text
Create notes/hello.txt with a short greeting, then read it back to me.
```

To render native UI:

```text
Show a bar chart comparing API: 120, Gateway: 80, and Worker: 45.
```

Ask the agent to stop responding to unsubscribe the conversation. Mention it
again to resubscribe.

Generated files stay under `sandbox/` and are ignored by Git. Datadog queries
also require the `pup` CLI and `pup auth login`; see the bundled
[`dd-apm` skill](./sandbox/skills/dd-apm/SKILL.md).

Sandbox commands emit `[sandbox]` JSON lifecycle logs, including command output.
Treat those logs as development diagnostics because they can contain sensitive
data.

Run `pnpm check` to typecheck the example and run its tests.
