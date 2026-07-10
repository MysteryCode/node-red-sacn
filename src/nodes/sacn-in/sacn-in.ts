import { Node, NodeAPI, NodeDef } from "node-red";
import { NodeMessage } from "@node-red/registry";
import { Packet, Receiver, unstable_MergingReceiver as MergingReceiver } from "sacn";

interface DMXValues {
  [key: number]: number | undefined;
}

interface Config extends NodeDef {
  universe: number;
  reuseAddress?: boolean;
  interface?: string;
  port?: number;
  mode: "htp" | "ltp" | "passthrough";
  output: "full" | "changes";
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

  constructor(node: Node<Config>, config: Config) {
    this.node = node;
    this.config = config;
    this.currentUniverse = config.universe;

    // parse options for receiver instance
    const options: Receiver.Props | MergingReceiver.Props = {
      universes: [config.universe],
      reuseAddr: config.reuseAddress !== undefined ? config.reuseAddress : true,
    };
    if (config.interface !== undefined && config.interface.length > 7) {
      options.iface = config.interface;
    }
    if (config.port !== undefined && config.port > 0) {
      options.port = config.port;
    } else {
      options.port = 5568;
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

    // run cleanup when node is closed
    this.node.on("close", () => {
      // close all connections; terminate the receiver
      this.sACN.close();

      this.data = new Map();
    });

    // handle sacn packets
    if (config.mode === "passthrough") {
      this.sACN.on("packet", (packet: Packet) => {
        this.node.send({
          universe: packet.universe,
          payload: this.parsePayload(packet.payload, packet.universe),
          sequence: packet.sequence,
          source: packet.sourceAddress,
          priority: packet.priority,
        });
      });
    } else if (config.mode === "ltp") {
      (this.sACN as MergingReceiver).on("changed", (data) => {
        this.node.send({
          universe: data.universe,
          payload: this.parsePayload(data.payload, data.universe),
        });
      });
    } else if (config.mode === "htp") {
      (this.sACN as MergingReceiver).on("changed", (data) => {
        this.node.send({
          universe: data.universe,
          payload: this.parsePayload(data.payload, data.universe),
        });
      });
    }

    // allow switching the observed universe at runtime via msg.universe
    this.node.on("input", (msg) => {
      this.handleUniverseChange(msg as MessageIn);
    });

    this.setStatus();
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
  }

  protected getNulledUniverse(): DMXValues {
    const universe: DMXValues = {};

    for (let ch = 1; ch <= 512; ch++) {
      universe[ch] = 0;
    }

    return universe;
  }

  protected getReference(universe: number): DMXValues {
    if (this.config.output === "changes") {
      return {};
    }

    return this.data?.get(universe) ?? this.getNulledUniverse();
  }

  protected parsePayload(payload: DMXValues, universe: number): DMXValues {
    const processedPayload: DMXValues = this.getReference(universe);

    Object.keys(payload).forEach((key) => {
      const ch = parseInt(key, 10);
      processedPayload[ch] = payload[ch];
    });

    if (this.config.output !== "changes") {
      this.data?.set(universe, processedPayload);
    }

    return processedPayload;
  }
}

export default (RED: NodeAPI): void => {
  RED.nodes.registerType("sacn-in", function (this: Node<Config>, config: Config) {
    RED.nodes.createNode(this, config);

    new NodeHandler(this, config);
  });
};
