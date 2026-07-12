"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sacn_1 = require("sacn");
class NodeHandler {
    node;
    config;
    data = new Map();
    sACN;
    currentUniverse;
    trigger;
    interval;
    keepaliveTimer;
    constructor(node, config) {
        this.node = node;
        this.config = config;
        this.currentUniverse = config.universe;
        this.trigger = config.trigger ?? (config.mode === "passthrough" ? "always" : "changes");
        this.interval = config.interval !== undefined && config.interval > 0 ? config.interval : 1000;
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
            if (this.keepaliveTimer) {
                clearTimeout(this.keepaliveTimer);
            }
            this.data = new Map();
        });
        if (config.mode === "passthrough") {
            this.sACN.on("packet", (packet) => {
                const changed = this.hasChanges(packet.payload, packet.universe);
                const payload = this.parsePayload(packet.payload, packet.universe);
                if (this.trigger === "always" || changed) {
                    this.sendData({
                        universe: packet.universe,
                        payload,
                        sequence: packet.sequence,
                        source: packet.sourceAddress,
                        priority: packet.priority,
                    });
                }
            });
        }
        else {
            this.sACN.on("changed", (data) => {
                const payload = this.parsePayload(data.payload, data.universe);
                if (this.trigger !== "always") {
                    this.sendData({
                        universe: data.universe,
                        payload,
                    });
                }
            });
            if (this.trigger === "always") {
                this.sACN.on("packet", () => {
                    this.emitFull(this.currentUniverse);
                });
            }
        }
        this.node.on("input", (msg) => {
            this.handleUniverseChange(msg);
        });
        this.setStatus();
        this.resetKeepalive();
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
        if (this.config.clearOnUniverseChange) {
            this.data?.set(universe, this.getNulledUniverse());
            this.emitFull(universe);
        }
        else {
            this.resetKeepalive();
        }
    }
    getNulledUniverse() {
        const universe = {};
        for (let ch = 1; ch <= 512; ch++) {
            universe[ch] = 0;
        }
        return universe;
    }
    hasChanges(payload, universe) {
        const full = this.data?.get(universe);
        if (full === undefined) {
            return true;
        }
        return Object.keys(payload).some((key) => {
            const ch = parseInt(key, 10);
            return full[ch] !== payload[ch];
        });
    }
    parsePayload(payload, universe) {
        const full = this.data?.get(universe) ?? this.getNulledUniverse();
        Object.keys(payload).forEach((key) => {
            const ch = parseInt(key, 10);
            full[ch] = payload[ch];
        });
        this.data?.set(universe, full);
        if (this.config.output === "changes") {
            const changes = {};
            Object.keys(payload).forEach((key) => {
                const ch = parseInt(key, 10);
                changes[ch] = payload[ch];
            });
            return changes;
        }
        return full;
    }
    sendData(msg) {
        this.node.send(msg);
        this.resetKeepalive();
    }
    emitFull(universe) {
        const full = this.data?.get(universe) ?? this.getNulledUniverse();
        this.sendData({ universe, payload: { ...full } });
    }
    resetKeepalive() {
        if (this.trigger !== "interval") {
            return;
        }
        if (this.keepaliveTimer) {
            clearTimeout(this.keepaliveTimer);
        }
        this.keepaliveTimer = setTimeout(() => {
            this.keepaliveTick();
        }, this.interval);
    }
    keepaliveTick() {
        if (this.data?.has(this.currentUniverse)) {
            this.emitFull(this.currentUniverse);
        }
        else {
            this.resetKeepalive();
        }
    }
}
exports.default = (RED) => {
    RED.nodes.registerType("sacn-in", function (config) {
        RED.nodes.createNode(this, config);
        new NodeHandler(this, config);
    });
};
