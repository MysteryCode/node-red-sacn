import { Node, NodeDef, NodeInitializer } from "node-red";
import { HTPMergingReceiver, LTPMergingReceiver, Receiver } from "sacn";
import { ReceiverProps } from "sacn/dist/receiver";
import { NodeMessage } from "@node-red/registry";

interface SacnInOptions extends NodeDef {
  universe: number;
  reuseAddress?: boolean;
  interface?: string;
  port?: number;
  mode: "htp" | "ltp" | "passthrough";
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

    const options: ReceiverProps = {
      universes: [config.universe],
      reuseAddr: config.reuseAddress !== undefined ? config.reuseAddress : true,
    };
    if (config.interface !== undefined && config.interface.length > 7) {
      options.iface = config.interface;
    }
    if (config.port !== undefined && config.port > 0) {
      options.port = config.port;
    }

    let sACN: Receiver;
    if (config.mode === "passthrough") {
      sACN = new Receiver(options);
    } else if (config.mode === "ltp") {
      sACN = new LTPMergingReceiver(options);
    } else if (config.mode === "htp") {
      sACN = new HTPMergingReceiver(options);
    } else {
      throw new Error("[node-red-sacn] None or invalid mode selected.");
    }

    this.on("close", () => {
      // close all connections; terminate the receiver
      sACN.close();
    });

    if (config.mode === "passthrough") {
      sACN.on("packet", (packet) => {
        this.send({
          universe: packet.universe,
          payload: incrementPayload(packet.payload),
          sequence: packet.sequence,
          source: packet.sourceAddress,
          priority: packet.priority,
        } as SacnInDirectMessage);
      });
    } else if (config.mode === "ltp") {
      (sACN as LTPMergingReceiver).on("changed", (data) => {
        this.send({
          universe: data.universe,
          payload: incrementPayload(data.payload),
        } as SacnInMessage);
      });
    } else if (config.mode === "htp") {
      (sACN as HTPMergingReceiver).on("changed", (data) => {
        this.send({
          universe: data.universe,
          payload: incrementPayload(data.payload),
        } as SacnInMessage);
      });
    }
  }

  function incrementPayload(payload: DMXValues): DMXValues {
    const result: DMXValues = {};

    Object.keys(payload).forEach((key) => {
      const ch = parseInt(key, 10);
      result[ch + 1] = payload[ch];
    });

    return result;
  }

  RED.nodes.registerType("sacn_in", SacnInNodeConstructor);
};

export default nodeInit;
