import { Node, NodeAPI, NodeDef } from "node-red";
import { NodeMessage } from "@node-red/registry";
import { Receiver, unstable_MergingReceiver as MergingReceiver } from "sacn";

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

  protected sACN: Receiver | MergingReceiver;

  constructor(node: Node<Config>, config: Config) {
    this.node = node;
    this.config = config;

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
      this.sACN.on("packet", (packet) => {
        this.node.send({
          universe: packet.universe,
          payload: this.parsePayload(packet.payload, packet.universe),
          sequence: packet.sequence,
          source: packet.sourceAddress,
          priority: packet.priority,
        } as DirectMessageIn);
      });
    } else if (config.mode === "ltp") {
      // @ts-expect-error // TODO https://github.com/k-yle/sACN/pull/63
      (this.sACN as MergingReceiver).on("changed", (data) => {
        this.node.send({
          // @ts-expect-error // TODO https://github.com/k-yle/sACN/pull/63
          universe: data.universe,
          // @ts-expect-error // TODO https://github.com/k-yle/sACN/pull/63
          payload: parsePayload(data.payload, data.universe),
        } as MessageIn);
      });
    } else if (config.mode === "htp") {
      // @ts-expect-error // TODO https://github.com/k-yle/sACN/pull/63
      (this.sACN as MergingReceiver).on("changed", (data) => {
        this.node.send({
          // @ts-expect-error // TODO https://github.com/k-yle/sACN/pull/63
          universe: data.universe,
          // @ts-expect-error // TODO https://github.com/k-yle/sACN/pull/63
          payload: parsePayload(data.payload, data.universe),
        } as MessageIn);
      });
    }
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
      return {} as DMXValues;
    }

    return this.data?.get(universe) ?? this.getNulledUniverse();
  }

  protected parsePayload(payload: DMXValues, universe: number): DMXValues {
    const processedPayload: DMXValues = this.getReference(universe);

    Object.keys(payload).forEach((key) => {
      const ch = parseInt(key, 10);
      processedPayload[ch + 1] = payload[ch];
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
