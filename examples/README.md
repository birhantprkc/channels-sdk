# Examples

## OpenTag

[**OpenTag**](https://github.com/CopilotKit/OpenTag) is the flagship application
built on Channels SDK — an open-source, self-hosted on-call triage assistant for
Slack and Microsoft Teams. It is the reference for how the pieces in the root
[README](../README.md) fit together in a complete app: one
`CopilotKitIntelligence`, one `CopilotRuntime`, one adapter-free managed Channel,
and a Python LangGraph agent over AG-UI as the backend.

It is vendored here as a **git submodule** rather than a copy, so this repository
carries no duplicated source to drift out of sync. The submodule records one
pinned commit of OpenTag's `main`.

### Fetch it

A plain `git clone` of this repository leaves `examples/OpenTag` empty. To
populate it:

```sh
git submodule update --init examples/OpenTag
```

Or clone with submodules in the first place:

```sh
git clone --recurse-submodules https://github.com/CopilotKit/ChannelsSDK.git
```

### Run it

See [`OpenTag/README.md`](./OpenTag/README.md) and
[`OpenTag/setup.md`](./OpenTag/setup.md). In short: it needs Node 22+, pnpm,
Python 3.12, and [`uv`](https://docs.astral.sh/uv/), plus a CopilotKit
Intelligence project, Channel, and runtime API key, and an OpenAI key for the
agent.

### Updating the pin

Updates to OpenTag's `main` do **not** appear here automatically — a submodule is
a pinned commit, not a live link. Moving it is a deliberate, reviewable one-line
change:

```sh
git submodule update --remote examples/OpenTag
git add examples/OpenTag
git commit -m "chore(examples): bump OpenTag submodule"
```

The tracking branch is declared as `main` in [`.gitmodules`](../.gitmodules), so
`--remote` follows `main` rather than git's `master` default.
