import { Node, NodeAPI, NodeDef } from "node-red";
import { NodeMessage } from "@node-red/registry";
import { Sender } from "sacn";
import { Options } from "sacn/dist/packet";
import { nulledUniverse, ValueScale } from "../../lib/dmx";
import { resolveNetworkOptions } from "../../lib/network";
import { registerInterfaceEndpoint } from "../../lib/interfaces";

interface SenderProps {
  universe: number;
  port?: number;
  reuseAddr?: boolean;
  minRefreshRate?: number;
  defaultPacketOptions?: Pick<Options, "cid" | "sourceName" | "priority" | "useRawDmxValues">;
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
  blankOnClose?: boolean;
  values?: ValueScale;
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

    const network = resolveNetworkOptions(config);
    this.options = {
      universe: config.universe,
      reuseAddr: config.reuseAddress !== undefined ? config.reuseAddress : true,
      minRefreshRate: config.speed !== undefined ? config.speed : 0,
      port: network.port,
      // in absolute mode the payload is already raw DMX (0–255); otherwise the
      // library scales the percentage values (0–100) when building the packet
      defaultPacketOptions: {
        useRawDmxValues: (config.values ?? "percent") === "absolute",
      },
    };
    if (network.iface !== undefined) {
      this.options.iface = network.iface;
    }

    this.sACN = new Sender(this.options);

    // a socket error is emitted as an "error" event; without a listener Node.js
    // would treat it as an uncaught exception and could take the whole runtime
    // down. Log it and surface it on the node instead, without throwing.
    this.sACN.on("error", (err: Error) => {
      this.node.error(err);
      this.node.status({ fill: "red", shape: "dot", text: err.message || "sender error" });
    });

    this.node.on("close", (done: () => void) => {
      const shutdown = (): void => {
        // close all connections; terminate the sender
        this.sACN.close();
        done();
      };

      // optionally blank the universe (send all-zero values) before closing, so
      // receivers do not hold the last look until their own signal-loss timeout
      if (this.config.blankOnClose) {
        this.sACN
          .send({
            payload: nulledUniverse(),
            sourceName: config.sourceName,
            priority: config.priority || 100,
          })
          .then(shutdown)
          .catch(shutdown);
      } else {
        shutdown();
      }
    });

    this.node.on("input", (msg) => {
      this.sACN
        .send({
          payload: msg.payload as number[],
          sourceName: config.sourceName,
          priority: config.priority || 100,
        })
        .then(() => {
          this.setStatus();
        })
        .catch((err: Error) => {
          // a failed send rejects the promise; handle it so it does not become
          // an unhandled rejection (which would terminate the process)
          this.node.error(err, msg);
          this.node.status({ fill: "red", shape: "dot", text: err.message || "send failed" });
        });
    });

    this.setStatus();
  }

  protected setStatus(): void {
    const rate = this.config.speed !== undefined && this.config.speed > 0 ? `${this.config.speed} Hz` : "once";

    this.node.status({
      fill: "green",
      shape: "dot",
      text: `Universe ${this.config.universe} · ${rate}`,
    });
  }
}

export default (RED: NodeAPI): void => {
  registerInterfaceEndpoint(RED);

  RED.nodes.registerType("sacn-out", function (this: Node<Config>, config: Config) {
    RED.nodes.createNode(this, config);

    new NodeHandler(this, config);
  });
};
