import { Node, NodeDef, NodeInitializer } from "node-red";
import { Sender } from "sacn";
import { Options } from "sacn/dist/packet";

interface SacnOutOptions extends NodeDef {
  universe: number;
  reuseAddress?: boolean;
  interface?: string;
  port?: number;
  sourceName: string;
  priority?: number;
  speed?: number;
}

interface SenderProps {
  universe: number;
  port?: number;
  reuseAddr?: boolean;
  minRefreshRate?: number;
  defaultPacketOptions?: Pick<Options, "cid" | "sourceName" | "priority">;
  iface?: string;
  useUnicastDestination?: string;
}

// TODO https://github.com/k-yle/sACN/pull/57

const nodeInit: NodeInitializer = (RED): void => {
  function SacnOutNodeConstructor(this: Node, config: SacnOutOptions): void {
    RED.nodes.createNode(this, config);

    const options: SenderProps = {
      universe: config.universe,
      reuseAddr: config.reuseAddress !== undefined ? config.reuseAddress : true,
      minRefreshRate: config.speed !== undefined ? config.speed : 0,
    };
    if (config.interface !== undefined && config.interface.length > 7) {
      options.iface = config.interface;
    }
    if (config.port !== undefined && config.port > 0) {
      options.port = config.port;
    } else {
      options.port = 5568;
    }

    const sACN = new Sender(options);

    this.on("close", () => {
      // close all connections; terminate the receiver
      sACN.close();
    });

    this.on("input", function (msg) {
      void (async () => {
        await sACN.send({
          payload: msg.payload as number[],
          sourceName: config.sourceName,
          priority: config.priority || 100,
        });
      })();
    });
  }

  RED.nodes.registerType("sacn_out", SacnOutNodeConstructor);
};

export default nodeInit;
