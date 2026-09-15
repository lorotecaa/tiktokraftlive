import WebSocket from "ws";

function toWebSocketUrl(baseUrl) {
  const parsed = new URL(baseUrl);
  parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  parsed.pathname = `${parsed.pathname.replace(/\/$/, "")}/v1/ws/console`;
  parsed.search = "";
  return parsed.toString();
}

export class ServerTapClient {
  constructor({ onState, onConsole, onError, commandsPerSecond = 5 }) {
    this.onState = onState;
    this.onConsole = onConsole;
    this.onError = onError;
    this.commandsPerSecond = Math.max(1, Math.min(commandsPerSecond, 20));
    this.socket = null;
    this.config = null;
    this.queue = [];
    this.lastCommandAt = 0;
    this.timer = null;
    this.status = "disconnected";
    this.keepAliveTimer = null;
    this.reconnectTimer = null;
    this.manualDisconnect = false;
  }

  emitState(status, detail = "") {
    this.status = status;
    this.onState({ status, detail });
  }
  startKeepAlive(socket) {
  this.stopKeepAlive();

  this.keepAliveTimer = setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.ping();
    }
  }, 30_000);
}

stopKeepAlive() {
  if (this.keepAliveTimer) {
    clearInterval(this.keepAliveTimer);
    this.keepAliveTimer = null;
  }
}
  async check(config) {
    const endpoint = new URL("/v1/server", config.url);
    try {
      const response = await fetch(endpoint, {
        headers: config.key ? { key: config.key } : {},
        signal: AbortSignal.timeout(8_000)
      });
      if (!response.ok) {
        throw new Error(`ServerTap respondió HTTP ${response.status}`);
      }
      return response.json();
    } catch (error) {
      // Una instalación normal de ServerTap no usa TLS. Antes de mostrar un error
      // genérico, detectamos de forma segura si el mismo puerto responde por HTTP.
      if (endpoint.protocol === "https:" && error.cause) {
        try {
          const httpEndpoint = new URL(endpoint);
          httpEndpoint.protocol = "http:";
          const probe = await fetch(httpEndpoint, { signal: AbortSignal.timeout(4_000) });
          if ([200, 401, 403].includes(probe.status)) {
            throw new Error(`El puerto ${endpoint.port} responde por HTTP, no por HTTPS. Selecciona HTTP y vuelve a conectar.`);
          }
        } catch (probeError) {
          if (probeError.message?.includes("responde por HTTP")) throw probeError;
        }
      }
      const detail = error.cause?.code ? ` (${error.cause.code})` : "";
      throw new Error(`No se pudo conectar a ServerTap${detail}: ${error.message}`);
    }
  }

  async connect(config, isReconnect = false) {

  if (!isReconnect) {
  this.manualDisconnect = false;

  if (this.reconnectTimer) {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  this.stopKeepAlive();

  if (this.socket) {
    const oldSocket = this.socket;
    this.socket = null;
    oldSocket.removeAllListeners();
    oldSocket.close();
  }

  if (this.timer) {
    clearTimeout(this.timer);
    this.timer = null;
  }

  this.queue = [];
}

  this.config = config;
    if (!config.url) throw new Error("Indica la URL de ServerTap.");
    let socket = null;
    try {
      this.emitState("connecting", "Comprobando ServerTap…");
      const server = await this.check(config);
      const headers = config.key ? { Cookie: `x-servertap-key=${encodeURIComponent(config.key)}` } : {};
      socket = new WebSocket(toWebSocketUrl(config.url), { headers, handshakeTimeout: 8_000 });
      this.socket = socket;

      await new Promise((resolve, reject) => {
        socket.once("open", resolve);
        socket.once("error", reject);
      });

      socket.on("message", (data) => {
        try {
          const entry = JSON.parse(data.toString());
          this.onConsole(entry);
        } catch {
          this.onConsole({ message: data.toString(), level: "INFO", timestampMillis: Date.now() });
        }
      });
      socket.on("close", (code) => {

  if (this.socket === socket) {

    this.socket = null;
    this.stopKeepAlive();

    this.emitState(
      "disconnected",
      `Consola desconectada (${code})`
    );

    if (!this.manualDisconnect && this.config) {

      if (!this.reconnectTimer) {

        this.reconnectTimer = setTimeout(async () => {

          this.reconnectTimer = null;

          try {
            await this.connect(this.config, true);
          } catch {
            // Si vuelve a fallar, se intentará nuevamente
          }

        }, 5000);

      }

    }

  }

});
      socket.on("error", (error) => this.onError(`ServerTap: ${error.message}`));
      this.startKeepAlive(socket);
      this.emitState("connected", `${server.name || "Minecraft"} conectado`);
      return server;
    } catch (error) {
      if (this.socket === socket) this.socket = null;
      socket?.close();
      this.emitState("error", error.message);
      if (!this.manualDisconnect && this.config) {
  if (!this.reconnectTimer) {
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;

      try {
        await this.connect(this.config, true);
      } catch {
        // Se volverá a intentar si falla
      }
    }, 5000);
  }
}
      throw error;
    }
  }

  disconnect(detail = "Desconectado") {

  this.manualDisconnect = true;

  if (this.reconnectTimer) {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  this.stopKeepAlive();

  if (this.socket) {
      const socket = this.socket;
      this.socket = null;
      socket.removeAllListeners();
      socket.close();
    }
    this.queue = [];
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.emitState("disconnected", detail);
  }

  enqueue(command, context) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("ServerTap no está conectado.");
    }
    if (!command || /[\r\n\0]/.test(command)) {
      throw new Error("El comando es inválido.");
    }
    this.queue.push({ command: command.slice(0, 256), context });
    this.flush();
  }

  flush() {
    if (this.timer || this.queue.length === 0) return;
    const interval = Math.ceil(1_000 / this.commandsPerSecond);
    const wait = Math.max(0, this.lastCommandAt + interval - Date.now());
    this.timer = setTimeout(() => {
      this.timer = null;
      const next = this.queue.shift();
      if (!next) return;
      try {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
          throw new Error("La consola de ServerTap se desconectó.");
        }
        this.socket.send(next.command);
        this.lastCommandAt = Date.now();
        this.onConsole({
          message: `> ${next.command}`,
          level: "COMMAND",
          timestampMillis: this.lastCommandAt,
          context: next.context
        });
      } catch (error) {
        this.onError(error.message);
      }
      this.flush();
    }, wait);
  }
}
