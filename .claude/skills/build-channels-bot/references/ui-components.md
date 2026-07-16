# channels-ui component reference

All components import from `@copilotkit/channels-ui`. You describe a message as a
JSX tree and pass it to `thread.post`, `thread.update`, or `thread.awaitChoice`.
The engine lowers the tree to a platform-neutral IR (`BotNode[]`); each adapter
renders what its surface supports and **skips nodes it can't render** — the
renderer is total, so a rich tree degrades gracefully instead of throwing.

Children may be nested elements, strings, numbers, or conditionals
(`false` / `null` / `undefined` render nothing), plus arrays thereof.

## Layout & content components

| Component | Props | Notes |
| --- | --- | --- |
| `<Message>` | `accent?: string` (hex, e.g. `#27AE60`), `onReaction?` | Top-level wrapper; `accent` sets a colored rail. `onReaction(emoji, ctx)` fires when a user reacts. |
| `<Header>` | children | Bold title row. |
| `<Section>` | children | A block of content. |
| `<Markdown>` | children | Markdown text. |
| `<Fields>` | children (`<Field>`) | Groups key/value fields. |
| `<Field>` | `label?: string`, children | Label rendered on Slack/Discord/Teams; surfaces without field labels fall back to the value text alone. |
| `<Context>` | children | Small secondary/muted context text. |
| `<Divider />` | none | Horizontal rule. |
| `<Image>` | `url: string`, `alt?: string` | Image block. |
| `<Table>` | `columns?: { header, align? }[]`, children (`<Row>`) | |
| `<Row>` | children (`<Cell>`) | |
| `<Cell>` | children | |
| `<Chart>` | `type?`, `title?`, `xAxisTitle?`, `yAxisTitle?`, `data: {label,value}[]` | `type`: `verticalBar` (default), `horizontalBar`, `line`, `pie`, `donut`. Platforms without native charts skip the node. |

## Interactive components

| Component | Props | Notes |
| --- | --- | --- |
| `<Actions>` | children | Container for interactive controls. |
| `<Button>` | `onClick?`, `value?`, `url?`, `style?: "primary" \| "danger"` | Click dispatches `onClick(ctx)` with `ctx.action.value` typed from `value`. If `url` is set it becomes a **link button** and `onClick`/`value` are ignored. `style` is a Slack accent. |
| `<Select>` | `onSelect?`, `options: {label,value}[]`, `placeholder?`, `multi?` | `onSelect(ctx)` gets `ctx.action.value`: a `string`, or `string[]` when `multi`. Multi renders as `multi_static_select` (Slack), max-values (Discord), `isMultiSelect` (Teams); Telegram/WhatsApp degrade to single-select. |
| `<Input>` | `onSubmit?`, `placeholder?`, `multiline?`, `name?` | `onSubmit(ctx)` gets `ctx.action.value` = the entered text. |

## Handler context (onClick / onSelect / onSubmit / onReaction)

Inline handlers receive a context with (at least) `{ action, thread, messageRef, user }`:

- `action.value` — the value echoed back (typed from the `value`/selection).
- `thread` — the live thread, so a handler can `thread.post(...)`,
  `thread.update(messageRef, ...)`, or run a HITL flow.
- `messageRef` — a ref to the message the control lives in (for `update`).

```tsx
<Actions>
  <Button value="approve" style="primary"
    onClick={async ({ action, thread, messageRef }) => {
      await thread.update(messageRef, <Section>Approved ✓</Section>);
    }}>
    Approve
  </Button>
  <Select
    placeholder="Pick an environment"
    options={[{ label: "Staging", value: "staging" }, { label: "Production", value: "production" }]}
    onSelect={async ({ action, thread }) => {
      await thread.post(<Section>Selected {String(action.value)}</Section>);
    }}
  />
</Actions>
```

## Durability of handlers

Inline `onClick`/`onSelect` handlers are bound by **content-stable IDs** — a hash
of the component's name, path, and props. A button clicked long after it was
posted still resolves to the right handler *as long as the binding still exists*.

- Inline handlers route **in-process only** — they're lost on restart.
- Handlers on a **registered component** with a durable `ActionStore` configured
  survive a restart. See `hitl-patterns.md` for the store.

## Choosing components

- Announce/inform → `<Message>` + `<Header>`/`<Section>`/`<Markdown>`/`<Fields>`.
- Offer discrete choices → `<Actions>` with `<Button>`s (or `awaitChoice`).
- Free text / options list → `<Input>` / `<Select>`.
- Structured data → `<Table>` or `<Chart>`.

Do not invent components or props beyond this list — a made-up tag will not lower
to a valid IR node.
