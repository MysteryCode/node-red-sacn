"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sacn_1 = require("sacn");
class NodeHandler {
    node;
    config;
    data = new Map();
    sACN;
    currentUniverse;
    constructor(node, config) {
        this.node = node;
        this.config = config;
        this.currentUniverse = config.universe;
        const options = {
            universes: [config.universe],
            reuseAddr: config.reuseAddress !== undefined ? config.reuseAddress : true,
        };
        if (config.interface !== undefined && config.interface.length > 7) {
            options.iface = config.interface;
        }
        if (config.port !== undefined && config.port > 0) {
            options.port = config.port;
        }
        else {
            options.port = 5568;
        }
        switch (config.mode) {
            case "passthrough":
                this.sACN = new sacn_1.Receiver(options);
                break;
            case "htp":
            case "ltp":
                options.mode = config.mode.toUpperCase();
                this.sACN = new sacn_1.unstable_MergingReceiver(options);
                break;
            default:
                throw new Error("[node-red-sacn] None or invalid mode selected.");
        }
        this.node.on("close", () => {
            this.sACN.close();
            this.data = new Map();
        });
        if (config.mode === "passthrough") {
            this.sACN.on("packet", (packet) => {
                this.node.send({
                    universe: packet.universe,
                    payload: this.parsePayload(packet.payload, packet.universe),
                    sequence: packet.sequence,
                    source: packet.sourceAddress,
                    priority: packet.priority,
                });
            });
        }
        else if (config.mode === "ltp") {
            this.sACN.on("changed", (data) => {
                this.node.send({
                    universe: data.universe,
                    payload: this.parsePayload(data.payload, data.universe),
                });
            });
        }
        else if (config.mode === "htp") {
            this.sACN.on("changed", (data) => {
                this.node.send({
                    universe: data.universe,
                    payload: this.parsePayload(data.payload, data.universe),
                });
            });
        }
        this.node.on("input", (msg) => {
            this.handleUniverseChange(msg);
        });
        this.setStatus();
    }
    setStatus() {
        this.node.status({
            fill: "green",
            shape: "dot",
            text: `Universe ${this.currentUniverse}`,
        });
    }
    parseUniverse(value) {
        const universe = typeof value === "string" ? parseInt(value, 10) : value;
        if (typeof universe !== "number" || !Number.isInteger(universe) || universe < 1 || universe > 63999) {
            return undefined;
        }
        return universe;
    }
    handleUniverseChange(msg) {
        const universe = this.parseUniverse(msg.universe);
        if (universe === undefined) {
            this.node.warn(`The given "universe"-property "${msg.universe}" (${typeof msg.universe}) is invalid or not between 1 and 63999.`);
            return;
        }
        if (universe === this.currentUniverse) {
            return;
        }
        this.sACN.removeUniverse(this.currentUniverse);
        this.sACN.addUniverse(universe);
        this.data?.delete(this.currentUniverse);
        this.currentUniverse = universe;
        this.setStatus();
    }
    getNulledUniverse() {
        const universe = {};
        for (let ch = 1; ch <= 512; ch++) {
            universe[ch] = 0;
        }
        return universe;
    }
    getReference(universe) {
        if (this.config.output === "changes") {
            return {};
        }
        return this.data?.get(universe) ?? this.getNulledUniverse();
    }
    parsePayload(payload, universe) {
        const processedPayload = this.getReference(universe);
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
exports.default = (RED) => {
    RED.nodes.registerType("sacn-in", function (config) {
        RED.nodes.createNode(this, config);
        new NodeHandler(this, config);
    });
};
