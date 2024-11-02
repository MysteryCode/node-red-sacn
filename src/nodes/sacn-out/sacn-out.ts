import { Node, NodeAPI, NodeDef } from "node-red";
import { NodeMessage } from "@node-red/registry";
import { Sender } from "sacn";
import { Options } from "sacn/dist/packet";

interface SenderProps {
  universe: number;
  port?: number;
  reuseAddr?: boolean;
  minRefreshRate?: number;
  defaultPacketOptions?: Pick<Options, "cid" | "sourceName" | "priority">;
  iface?: string;
  useUnicastDestination?: string;
}

export interface Config extends NodeDef {
  universe: number;
  reuseAddress?: boolean;
  interface?: string;
  port?: number;
  sourceName: string;
  priority?: number;
  speed?: number;
}

export type MessageIn = NodeMessage;

class NodeHandler {
  protected node: Node<Config>;

  protected config: Config;

  protected sACN: Sender;

  protected options: SenderProps;

  constructor(node: Node<Config>, config: Config) {
    this.node = node;
    this.config = config;

    this.options = {
      universe: config.universe,
      reuseAddr: config.reuseAddress !== undefined ? config.reuseAddress : true,
      minRefreshRate: config.speed !== undefined ? config.speed : 0,
    };
    if (config.interface !== undefined && config.interface.length > 7) {
      this.options.iface = config.interface;
    }
    if (config.port !== undefined && config.port > 0) {
      this.options.port = config.port;
    } else {
      this.options.port = 5568;
    }

    this.sACN = new Sender(this.options);

    this.node.on("close", () => {
      // close all connections; terminate the receiver
      this.sACN.close();
    });

    this.node.on("input", (msg) => {
      void this.sACN.send({
        payload: msg.payload as number[],
        sourceName: config.sourceName,
        priority: config.priority || 100,
      });
    });
  }
}

export default (RED: NodeAPI): void => {
  RED.nodes.registerType("sacn-out", function (this: Node<Config>, config: Config) {
    RED.nodes.createNode(this, config);

    new NodeHandler(this, config);
  });
};
