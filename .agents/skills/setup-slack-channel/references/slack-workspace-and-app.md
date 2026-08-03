# Slack workspace and app

Goal: a **dedicated** Slack app, installed in a workspace where an in-progress
bot is harmless, with its two tokens in hand.

## Pick a workspace

In preference order:

1. **A workspace the developer can install into** — their own, or one where they
   are an owner or app manager.
2. **A new free workspace**, created at `slack.com/create`. Fastest path when
   company approval would block them. A free workspace is fine for this.
3. **A Slack Developer Program sandbox** — a workspace intended for app
   development.

Never test in a workspace where an unapproved or half-built bot would disrupt
people. That is the whole reason installs are gated.

## Understand the approval boundary before promising a timeline

- **Creating** an app is normally not gated (an Enterprise Grid org may restrict
  it; if so, the developer will hit that immediately and should ask their admin).
- **Installing** it into a workspace is the gated step. By default only Workspace
  Owners can review app requests, and they may appoint other members as **app
  managers** to review them too.
- **Changing scopes later forces re-approval and re-installation.** Get the
  manifest right the first time rather than adding scopes incrementally — this is
  also why you should not add scopes to someone else's app for your convenience.

So: create the app immediately, and start the install request in parallel if one
is needed. Do not sit idle waiting for approval before creating.

## Create the app from a manifest

Which manifest:

- **`assets/slack-app-manifest.yaml`** (this skill) — a neutral dev app. Use it
  by default.
- **The starter's own `slack-app-manifest.yaml`** — use it if the Channel
  implements slash commands, because the manifest is where commands are declared.
  `examples/OpenTag` declares `/agent`, `/triage`, `/preview`, `/file-issue`; a
  command the manifest does not declare cannot be invoked, and a command the
  manifest declares but the Channel does not implement fails in front of the user.

Then, in a browser at `api.slack.com/apps`: create a new app **from an app
manifest**, choose the workspace, paste the manifest, review the requested
scopes, and create it.

Before creating, change `display_information.name` and
`features.bot_user.display_name` so the bot is obviously a dev app in the member
list. Two bots with the same name in one workspace is a support burden for
whoever finds it later.

**Never paste a manifest over an app that is already installed and in use.** That
can reinstall it and rotate its tokens, breaking every consumer holding the old
ones. Configuring a *new* app is the only safe path.

## Install it and collect the two tokens

1. **Install to the workspace** and complete the OAuth consent. This yields the
   **bot token**, `xoxb-…`, on the app's OAuth page.
2. **Generate an app-level token** on the app's Basic Information page, with the
   **`connections:write`** scope. This yields `xapp-…`.

Both tokens go into the Slack adapter form in Intelligence, entered by the
developer. Neither belongs in this repo, in `.env`, or in the conversation — see
`references/secrets-and-credentials.md`.

They must come from the **same app**. A valid-but-mismatched `xoxb`/`xapp` pair
cannot be detected during setup: it looks configured and never delivers.

## Settings that must stay as the manifest sets them

| Setting | Why |
| --- | --- |
| **Socket Mode enabled** | Managed delivery consumes events over Socket Mode using the `xapp-` token. This is why no public URL or tunnel is needed. |
| **Interactivity enabled** | Off means button and select clicks are never delivered, even while text replies work — a confusing partial failure. |
| **Event subscriptions** | `app_mention` for channel mentions, `message.im` for DMs. Editing the app after install can drop these. |

## Invite the bot to a test channel

Workspace-installed is **not** the same as channel member. Slack does not emit
`app_mention` at all for a channel the app is not in — it shows the human an
invite prompt instead, and nothing reaches your runtime.

```
/invite @YourBot
```

Prefer a channel the developer created for this. A DM to the bot also works for
testing, but check which handlers the app registers first: an app with only
`onMention` ignores plain DMs (see `references/troubleshooting.md`).

## Phase 1 is done when

- The app exists and is **installed** in the chosen workspace.
- An `xoxb-` token and an `xapp-` token (with `connections:write`) from **that**
  app are in the developer's hands, and neither has touched the repo or the chat.
- The bot appears in the member list of the test channel.

## What not to do

- Do not create the app for the developer by driving their browser session, and do
  not enter credentials on their behalf.
- Do not request scopes beyond the manifest.
- Do not enumerate the workspace's channels or users. You need one test channel,
  which the developer names.
- Do not touch an existing app to "save time." Creating a new one takes minutes;
  breaking a shared bot costs someone else their day.
