import { Socket } from "node:net";

/** Socket construction validates the native handle, including Windows pipes.
 * Regular files and terminals cannot be opened as a Socket. */
export function openPrivateTransport(): {
  deliver: (token: string) => Promise<void>;
  close: () => void;
} {
  const sink = new Socket({ fd: 3, readable: false, writable: true });
  let receiver: Socket;
  try {
    receiver = new Socket({ fd: 0, readable: true, writable: false });
  } catch {
    sink.destroy();
    throw new Error("Private receiver unavailable");
  }
  // Prevent an early receiver disconnect from surfacing raw errors in logs.
  sink.on("error", () => {});
  receiver.on("error", () => {});
  return {
    async deliver(token) {
      const bytes = Buffer.from(`${JSON.stringify({ refresh_token: token })}\n`, "utf8");
      try {
        await new Promise<void>((resolve, reject) => {
          if (sink.destroyed || !sink.writable) {
            reject(new Error("Private delivery unavailable"));
            return;
          }
          let acknowledged = false;
          let flushed = false;
          let reply = "";
          const cleanup = () => {
            clearTimeout(deadline);
            sink.off("error", fail);
            sink.off("close", fail);
            receiver.off("error", fail);
            receiver.off("close", fail);
            receiver.off("end", fail);
            receiver.off("data", receive);
          };
          const fail = () => {
            cleanup();
            reject(new Error("Private delivery unavailable"));
          };
          const finish = () => {
            if (acknowledged && flushed) {
              cleanup();
              resolve();
            }
          };
          const receive = (chunk: Buffer) => {
            reply += chunk.toString("utf8");
            if (reply.length > 64 || !"OAUTH_RECEIVED\n".startsWith(reply)) {
              fail();
              return;
            }
            acknowledged = reply === "OAUTH_RECEIVED\n";
            finish();
          };
          const deadline = setTimeout(() => {
            sink.destroy();
            fail();
          }, 10_000);
          sink.once("error", fail);
          sink.once("close", fail);
          receiver.once("error", fail);
          receiver.once("close", fail);
          receiver.once("end", fail);
          receiver.on("data", receive);
          sink.write(bytes, (error) => {
            if (error) { fail(); return; }
            flushed = true;
            finish();
          });
        });
      } finally {
        sink.destroy();
        receiver.destroy();
        bytes.fill(0);
      }
    },
    close: () => { sink.destroy(); receiver.destroy(); },
  };
}
