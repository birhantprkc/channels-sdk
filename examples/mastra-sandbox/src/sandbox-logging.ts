import {
  LocalSandbox,
  type ExecuteCommandOptions,
  type LocalSandboxOptions,
} from "@mastra/core/workspace";

export type SandboxLogEvent =
  | {
      event: "sandbox.command.started";
      command: string;
      args: string[];
      cwd: string;
    }
  | {
      event: "sandbox.command.stdout" | "sandbox.command.stderr";
      output: string;
    }
  | {
      event: "sandbox.command.finished";
      exitCode: number;
      success: boolean;
      executionTimeMs: number;
      timedOut: boolean;
    }
  | {
      event: "sandbox.command.failed";
      error: string;
      executionTimeMs: number;
    };

export type SandboxEventLogger = (event: SandboxLogEvent) => void;

function consoleSandboxLogger(event: SandboxLogEvent) {
  const message = `[sandbox] ${JSON.stringify(event)}`;
  if (
    event.event === "sandbox.command.stderr" ||
    event.event === "sandbox.command.failed"
  ) {
    console.error(message);
  } else {
    console.log(message);
  }
}

function emit(logger: SandboxEventLogger, event: SandboxLogEvent) {
  try {
    logger(event);
  } catch {
    // Diagnostic logging must never break command execution.
  }
}

export function createLoggedLocalSandbox(
  options: LocalSandboxOptions,
  logger: SandboxEventLogger = consoleSandboxLogger,
) {
  const sandbox = new LocalSandbox(options);
  const execute = sandbox.executeCommand?.bind(sandbox);

  if (!execute) {
    throw new Error("LocalSandbox does not support command execution");
  }

  sandbox.executeCommand = async (
    command: string,
    args: string[] = [],
    commandOptions: ExecuteCommandOptions = {},
  ) => {
    const startedAt = Date.now();
    const { onStdout, onStderr } = commandOptions;

    emit(logger, {
      event: "sandbox.command.started",
      command,
      args,
      cwd: commandOptions.cwd ?? sandbox.workingDirectory,
    });

    try {
      const result = await execute(command, args, {
        ...commandOptions,
        onStdout(output) {
          emit(logger, { event: "sandbox.command.stdout", output });
          onStdout?.(output);
        },
        onStderr(output) {
          emit(logger, { event: "sandbox.command.stderr", output });
          onStderr?.(output);
        },
      });

      emit(logger, {
        event: "sandbox.command.finished",
        exitCode: result.exitCode,
        success: result.success,
        executionTimeMs: result.executionTimeMs,
        timedOut: result.timedOut ?? false,
      });

      return result;
    } catch (error) {
      emit(logger, {
        event: "sandbox.command.failed",
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs: Date.now() - startedAt,
      });
      throw error;
    }
  };

  return sandbox;
}
