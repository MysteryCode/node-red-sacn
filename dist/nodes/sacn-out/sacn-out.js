"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sacn_1 = require("sacn");
class NodeHandler {
    node;
    config;
    sACN;
    options;
    constructor(node, config) {
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
        }
        else {
            this.options.port = 5568;
        }
        this.sACN = new sacn_1.Sender(this.options);
        this.sACN.on("error", (err) => {
            this.node.error(err);
            this.node.status({ fill: "red", shape: "dot", text: err.message || "sender error" });
        });
        this.node.on("close", () => {
            this.sACN.close();
        });
        this.node.on("input", (msg) => {
            void this.sACN.send({
                payload: msg.payload,
                sourceName: config.sourceName,
                priority: config.priority || 100,
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
    RED.nodes.registerType("sacn-out", function (config) {
        RED.nodes.createNode(this, config);
        new NodeHandler(this, config);
    });
};
