import { Node, NodeDef, NodeInitializer } from "node-red";
import { Receiver, unstable_MergingReceiver as MergingReceiver } from "sacn";
import { NodeMessage } from "@node-red/registry";

interface SacnInOptions extends NodeDef {
  universe: number;
  reuseAddress?: boolean;
  interface?: string;
  port?: number;
  mode: "htp" | "ltp" | "passthrough";
  output: "full" | "changes";
}

export interface SacnInMessage extends NodeMessage {
  universe: number;
  payload: number[];
}

export interface SacnInDirectMessage extends SacnInMessage {
  sequence: number;
  source: string;
  priority: number;
}

interface DMXValues {
  [key: number]: number | undefined;
}

const nodeInit: NodeInitializer = (RED): void => {
  function SacnInNodeConstructor(this: Node, config: SacnInOptions): void {
    RED.nodes.createNode(this, config);

    // initialize universe data
    let data: Map<number, DMXValues> | undefined = new Map();

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
    }

    // internal functions
    const getNulledUniverse = (): DMXValues => {
      const universe: DMXValues = {};

      for (let ch = 1; ch <= 512; ch++) {
        universe[ch] = 0;
      }

      return universe;
    };

    const getReference = (universe: number): DMXValues => {
      if (config.output === "changes") {
        return {} as DMXValues;
      }

      return data?.get(universe) ?? getNulledUniverse();
    };

    const parsePayload = (payload: DMXValues, universe: number): DMXValues => {
      const processedPayload: DMXValues = getReference(universe);

      Object.keys(payload).forEach((key) => {
        const ch = parseInt(key, 10);
        processedPayload[ch + 1] = payload[ch];
      });

      if (config.output !== "changes") {
        data?.set(universe, processedPayload);
      }

      return processedPayload;
    };

    // init sacn receiver
    let sACN: Receiver;
    switch (config.mode) {
      case "passthrough":
        sACN = new Receiver(options);
        break;
      case "htp":
      case "ltp":
        (options as MergingReceiver.Props).mode = config.mode.toUpperCase() as "HTP" | "LTP";
        sACN = new MergingReceiver(options);
        break;
      default:
        throw new Error("[node-red-sacn] None or invalid mode selected.");
    }

    // run cleanup when node is closed
    this.on("close", () => {
      // close all connections; terminate the receiver
      sACN.close();

      data = new Map();
    });

    // handle sacn packets
    if (config.mode === "passthrough") {
      sACN.on("packet", (packet) => {
        this.send({
          universe: packet.universe,
          payload: parsePayload(packet.payload, packet.universe),
          sequence: packet.sequence,
          source: packet.sourceAddress,
          priority: packet.priority,
        } as SacnInDirectMessage);
      });
    } else if (config.mode === "ltp") {
      // @ts-expect-error // TODO https://github.com/k-yle/sACN/pull/63
      (sACN as MergingReceiver).on("changed", (data) => {
        this.send({
          // @ts-expect-error // TODO https://github.com/k-yle/sACN/pull/63
          universe: data.universe,
          // @ts-expect-error // TODO https://github.com/k-yle/sACN/pull/63
          payload: parsePayload(data.payload, data.universe),
        } as SacnInMessage);
      });
    } else if (config.mode === "htp") {
      // @ts-expect-error // TODO https://github.com/k-yle/sACN/pull/63
      (sACN as MergingReceiver).on("changed", (data) => {
        this.send({
          // @ts-expect-error // TODO https://github.com/k-yle/sACN/pull/63
          universe: data.universe,
          // @ts-expect-error // TODO https://github.com/k-yle/sACN/pull/63
          payload: parsePayload(data.payload, data.universe),
        } as SacnInMessage);
      });
    }
  }

  RED.nodes.registerType("sacn_in", SacnInNodeConstructor);
};

export default nodeInit;
