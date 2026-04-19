import net from "node:net";

export type ProxyHealthResult = {
  status: "WORKING" | "DEAD";
  latency: number;
};

export async function checkProxyHealth(
  address: string,
  port: number,
  timeoutMs = 5000,
): Promise<ProxyHealthResult> {
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const socket = new net.Socket();

    const finalize = (status: "WORKING" | "DEAD") => {
      const elapsed = Date.now() - startedAt;
      const latency = Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : 0;
      resolve({ status, latency });
    };

    socket.setTimeout(timeoutMs);

    socket.once("connect", () => {
      socket.destroy();
      finalize("WORKING");
    });

    socket.once("timeout", () => {
      socket.destroy();
      finalize("DEAD");
    });

    socket.once("error", () => {
      socket.destroy();
      finalize("DEAD");
    });

    socket.connect(port, address);
  });
}
