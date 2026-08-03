import { createServer } from "node:http";
import { listener } from "@/lib/runtime";

await listener.channels?.ready({ timeoutMs: 15_000 });

const server = createServer(listener);

server.listen(3000, () => {
  console.log("\nServer listening on port 3000...");
});

process.on("SIGINT", async () => {
  await listener.channels?.stop();
  server.close();
});
