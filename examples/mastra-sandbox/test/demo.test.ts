import assert from "node:assert/strict";
import { test } from "node:test";
import { createSandboxWorkspace } from "../src/agent.js";
import type { SandboxLogEvent } from "../src/sandbox-logging.js";
import { stopRespondingTool } from "../src/stop-responding-tool.js";

test("the workspace executes commands in the sandbox directory", async (t) => {
  const workspace = createSandboxWorkspace(() => {});
  t.after(async () => workspace.destroy());

  const result = await workspace.sandbox?.executeCommand?.(
    "node",
    ["-e", "process.stdout.write(process.cwd())"],
    { timeout: 10_000 },
  );

  assert.equal(result?.success, true);
  assert.equal(result?.exitCode, 0);
  assert.equal(result?.stdout, resolveSandboxPath());
});

test("the sandbox logger captures stderr and completion", async (t) => {
  const events: SandboxLogEvent[] = [];
  const workspace = createSandboxWorkspace((event) => events.push(event));
  t.after(async () => workspace.destroy());

  const result = await workspace.sandbox?.executeCommand?.(
    "node",
    ["-e", "process.stderr.write('diagnostic output')"],
    { timeout: 10_000 },
  );

  assert.equal(result?.success, true);
  assert.ok(
    events.some(
      (event) =>
        event.event === "sandbox.command.stderr" &&
        event.output === "diagnostic output",
    ),
  );
  assert.ok(
    events.some(
      (event) =>
        event.event === "sandbox.command.finished" && event.exitCode === 0,
    ),
  );
});

test("the workspace discovers the bundled Datadog skill", async (t) => {
  const workspace = createSandboxWorkspace(() => {});
  t.after(async () => workspace.destroy());

  const skills = await workspace.skills?.list();
  const ddApm = skills?.find((skill) => skill.name === "dd-apm");
  assert.ok(ddApm, "expected the dd-apm skill");

  const skill = await workspace.skills?.get(ddApm.name);
  assert.match(skill?.instructions ?? "", /pup traces search/u);
});

test("the stop tool unsubscribes the conversation", async () => {
  let unsubscribed = false;
  const context = {
    thread: {
      async unsubscribe() {
        unsubscribed = true;
      },
    },
  } as unknown as Parameters<typeof stopRespondingTool.handler>[1];

  const result = await stopRespondingTool.handler({}, context);

  assert.equal(unsubscribed, true);
  assert.equal(result, "Unsubscribed from this conversation.");
});

function resolveSandboxPath() {
  return new URL("../sandbox", import.meta.url).pathname.replace(/\/$/u, "");
}
