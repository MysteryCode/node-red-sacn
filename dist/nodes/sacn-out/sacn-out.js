"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sacn_1 = require("sacn");
const dmx_1 = require("../../lib/dmx");
const network_1 = require("../../lib/network");
const interfaces_1 = require("../../lib/interfaces");
class NodeHandler {
    node;
    config;
    sACN;
    options;
    constructor(node, config) {
        this.node = node;
        this.config = config;
        const network = (0, network_1.resolveNetworkOptions)(config);
        this.options = {
            universe: config.universe,
            reuseAddr: config.reuseAddress !== undefined ? config.reuseAddress : true,
            minRefreshRate: config.speed !== undefined ? config.speed : 0,
            port: network.port,
            defaultPacketOptions: {
                useRawDmxValues: (config.values ?? "percent") === "absolute",
            },
        };
        if (network.iface !== undefined) {
            this.options.iface = network.iface;
        }
        this.sACN = new sacn_1.Sender(this.options);
        this.sACN.on("error", (err) => {
            this.node.error(err);
            this.node.status({ fill: "red", shape: "dot", text: err.message || "sender error" });
        });
        this.node.on("close", (done) => {
            const shutdown = () => {
                this.sACN.close();
                done();
            };
            if (this.config.blankOnClose) {
                this.sACN
                    .send({
                    payload: (0, dmx_1.nulledUniverse)(),
                    sourceName: config.sourceName,
                    priority: config.priority || 100,
                })
                    .then(shutdown)
                    .catch(shutdown);
            }
            else {
                shutdown();
            }
        });
        this.node.on("input", (msg) => {
            this.sACN
                .send({
                payload: msg.payload,
                sourceName: config.sourceName,
                priority: config.priority || 100,
            })
                .then(() => {
                this.setStatus();
            })
                .catch((err) => {
                this.node.error(err, msg);
                this.node.status({ fill: "red", shape: "dot", text: err.message || "send failed" });
            });
        });
        this.setStatus();
    }
    setStatus() {
        const rate = this.config.speed !== undefined && this.config.speed > 0 ? `${this.config.speed} Hz` : "once";
        this.node.status({
            fill: "green",
            shape: "dot",
            text: `Universe ${this.config.universe} · ${rate}`,
        });
    }
}
exports.default = (RED) => {
    (0, interfaces_1.registerInterfaceEndpoint)(RED);
    RED.nodes.registerType("sacn-out", function (config) {
        RED.nodes.createNode(this, config);
        new NodeHandler(this, config);
    });
};
