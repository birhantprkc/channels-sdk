# Agent instructions

## Repository-owned skills

This repository ships its own skills. They are the authority on the Channels SDK
API and on setup workflows — the API is recent and easy to get wrong from memory,
so ground your work in them rather than in recalled patterns.

Canonical location: **`.agents/skills/<name>/SKILL.md`**

Outside this repository, these skills install into any coding agent (Claude Code,
Codex, Cursor, Gemini, and others) with the CopilotKit CLI. This is the default
path for a developer setting up Slack:

```sh
npx copilotkit skills install --skill setup-slack-channel
```

Or install every CopilotKit skill:

```sh
npx copilotkit skills install
```

| Skill | Use it when |
| --- | --- |
| `.agents/skills/setup-slack-channel/SKILL.md` | Getting a locally running Channels agent to answer in Slack: creating the Slack app, the managed Intelligence Channel, the local runtime — or diagnosing a Channel stuck at `setup_required` or a mention that gets no reply. |

Read the relevant `SKILL.md` before starting that kind of task, and follow its
references rather than re-deriving the workflow.

`.claude/skills/` mirrors these for Claude Code, which discovers skills there.
`.claude/skills/setup-slack-channel` is a symlink to the canonical copy under
`.agents/skills/` — edit the canonical file, never the link, so the two cannot
drift apart.
