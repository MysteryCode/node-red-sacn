import { Node, NodeAPI, NodeDef } from "node-red";
import { NodeMessage } from "@node-red/registry";
import { Packet, Receiver, unstable_MergingReceiver as MergingReceiver } from "sacn";
import { DMXValues, fromPercent, nulledUniverse, ValueScale } from "../../lib/dmx";
import { resolveNetworkOptions } from "../../lib/network";
import { registerInterfaceEndpoint } from "../../lib/interfaces";

interface Config extends NodeDef {
  universe: number;
  reuseAddress?: boolean;
  interface?: string;
  port?: number;
  mode: "htp" | "ltp" | "passthrough";
  output: "full" | "changes";
  trigger?: "changes" | "always" | "interval";
  interval?: number;
  clearOnUniverseChange?: boolean;
  values?: ValueScale;
}

export interface MessageIn extends NodeMessage {
  universe: number;
  payload: number[];
}

export interface DirectMessageIn extends MessageIn {
  sequence: number;
  source: string;
  priority: number;
}

class NodeHandler {
  protected node: Node<Config>;

  protected config: Config;

  protected data: Map<number, DMXValues> | undefined = new Map();

  protected sACN: Receiver;

  protected currentUniverse: number;

  protected trigger: "changes" | "always" | "interval";

  protected interval: number;

  protected scale: ValueScale;

  protected keepaliveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(node: Node<Config>, config: Config) {
    this.node = node;
    this.config = config;
    this.currentUniverse = config.universe;
    this.scale = config.values ?? "percent";

    // resolve the output trigger; keep legacy behaviour for nodes without the field
    this.trigger = config.trigger ?? (config.mode === "passthrough" ? "always" : "changes");
    this.interval = config.interval !== undefined && config.interval > 0 ? config.interval : 1000;

    // parse options for receiver instance
    const network = resolveNetworkOptions(config);
    const options: Receiver.Props | MergingReceiver.Props = {
      universes: [config.universe],
      reuseAddr: config.reuseAddress !== undefined ? config.reuseAddress : true,
      port: network.port,
    };
    if (network.iface !== undefined) {
      options.iface = network.iface;
    }

    // init sacn receiver
    switch (config.mode) {
      case "passthrough":
        this.sACN = new Receiver(options);
        break;
      case "htp":
      case "ltp":
        (options as MergingReceiver.Props).mode = config.mode.toUpperCase() as "HTP" | "LTP";
        this.sACN = new MergingReceiver(options);
        break;
      default:
        throw new Error("[node-red-sacn] None or invalid mode selected.");
    }

    // a socket error (bind failure, multicast membership, …) is emitted as an
    // "error" event; without a listener Node.js would treat it as an uncaught
    // exception and could take the whole runtime down. Log it and surface it on
    // the node instead, and keep running so the rest of the flow is unaffected.
    this.sACN.on("error", (err: Error) => {
      this.node.error(err);
      this.node.status({ fill: "red", shape: "dot", text: err.message || "receiver error" });
    });

    // run cleanup when node is closed
    this.node.on("close", () => {
      // close all connections; terminate the receiver
      this.sACN.close();

      if (this.keepaliveTimer) {
        clearTimeout(this.keepaliveTimer);
      }

      this.data = new Map();
    });

    // handle sacn packets according to the configured output trigger
    if (config.mode === "passthrough") {
      this.sACN.on("packet", (packet: Packet) => {
        const { payload, changed } = this.applyFrame(packet.payload, packet.universe);

        if (this.trigger === "always" || changed) {
          this.sendData({
            universe: packet.universe,
            payload,
            sequence: packet.sequence,
            source: packet.sourceAddress,
            priority: packet.priority,
          });
        }
      });
    } else {
      // htp / ltp — merged output
      (this.sACN as MergingReceiver).on("changed", (data) => {
        const { payload } = this.applyFrame(data.payload, data.universe);

        // in "always" mode the packet listener below emits on every packet instead
        if (this.trigger !== "always") {
          this.sendData({
            universe: data.universe,
            payload,
          });
        }
      });

      if (this.trigger === "always") {
        // MergingReceiver merges on its own "packet" listener (registered first),
        // so by the time this runs the full state is already up to date
        this.sACN.on("packet", () => {
          this.emitFull(this.currentUniverse);
        });
      }
    }

    // allow switching the observed universe at runtime via msg.universe
    this.node.on("input", (msg) => {
      this.handleUniverseChange(msg as MessageIn);
    });

    this.setStatus();
    this.resetKeepalive();
  }

  protected setStatus(): void {
    this.node.status({
      fill: "green",
      shape: "dot",
      text: `Universe ${this.currentUniverse}`,
    });
  }

  protected parseUniverse(value: unknown): number | undefined {
    const universe = typeof value === "string" ? parseInt(value, 10) : value;

    if (typeof universe !== "number" || !Number.isInteger(universe) || universe < 1 || universe > 63999) {
      return undefined;
    }

    return universe;
  }

  protected handleUniverseChange(msg: MessageIn): void {
    const universe = this.parseUniverse(msg.universe);

    if (universe === undefined) {
      this.node.warn(
        `The given "universe"-property "${msg.universe}" (${typeof msg.universe}) is invalid or not between 1 and 63999.`,
      );

      return;
    }

    if (universe === this.currentUniverse) {
      return;
    }

    this.sACN.removeUniverse(this.currentUniverse);
    this.sACN.addUniverse(universe);

    // drop the cached state of the previously observed universe
    this.data?.delete(this.currentUniverse);

    this.currentUniverse = universe;
    this.setStatus();

    if (this.config.clearOnUniverseChange) {
      // emit a blanked universe until real data for the new universe arrives
      this.data?.set(universe, nulledUniverse());
      this.emitFull(universe);
    } else {
      // keep the keepalive heartbeat aligned with the new universe
      this.resetKeepalive();
    }
  }

  protected applyFrame(incoming: DMXValues, universe: number): { payload: DMXValues; changed: boolean } {
    // an sACN data packet always describes the complete universe; channels that are
    // absent from the received payload are deliberately 0, not unchanged. Rebuild the
    // full state from a zeroed base so a channel fading to 0 is reflected correctly.
    const previous = this.data?.get(universe);
    const full = nulledUniverse();

    Object.keys(incoming).forEach((key) => {
      const ch = parseInt(key, 10);
      if (ch >= 1 && ch <= 512) {
        // the library always reports percentages; convert to the configured scale
        full[ch] = fromPercent(incoming[ch], this.scale);
      }
    });

    let changed = false;
    const changes: DMXValues = {};
    for (let ch = 1; ch <= 512; ch++) {
      const before = previous ? previous[ch] : 0;
      if (before !== full[ch]) {
        changed = true;
        changes[ch] = full[ch];
      }
    }

    this.data?.set(universe, full);

    const payload = this.config.output === "changes" ? changes : full;

    return { payload, changed };
  }

  protected sendData(msg: NodeMessage): void {
    // never hand out a reference to the cached universe state; a downstream node
    // must not be able to mutate our internal data by holding on to the payload
    if (msg.payload && typeof msg.payload === "object") {
      msg = { ...msg, payload: { ...(msg.payload as DMXValues) } };
    }

    this.node.send(msg);
    this.resetKeepalive();
  }

  protected emitFull(universe: number): void {
    const full = this.data?.get(universe) ?? nulledUniverse();
    this.sendData({ universe, payload: full });
  }

  protected resetKeepalive(): void {
    if (this.trigger !== "interval") {
      return;
    }

    if (this.keepaliveTimer) {
      clearTimeout(this.keepaliveTimer);
    }

    this.keepaliveTimer = setTimeout(() => {
      this.keepaliveTick();
    }, this.interval);
  }

  protected keepaliveTick(): void {
    if (this.data?.has(this.currentUniverse)) {
      this.emitFull(this.currentUniverse);
    } else {
      // no data for the current universe yet; keep the heartbeat armed without emitting
      this.resetKeepalive();
    }
  }
}

export default (RED: NodeAPI): void => {
  registerInterfaceEndpoint(RED);

  RED.nodes.registerType("sacn-in", function (this: Node<Config>, config: Config) {
    RED.nodes.createNode(this, config);

    new NodeHandler(this, config);
  });
};
