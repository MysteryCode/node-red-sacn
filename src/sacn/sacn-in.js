"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sacn_1 = require("sacn");
const nodeInit = (RED) => {
    function SacnInNodeConstructor(config) {
        RED.nodes.createNode(this, config);
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
        let sACN;
        if (config.mode === "passthrough") {
            sACN = new sacn_1.Receiver(options);
        }
        else if (config.mode === "ltp" || config.mode === "htp") {
            options.mode = config.mode.toUpperCase();
            sACN = new sacn_1.unstable_MergingReceiver(options);
        }
        else {
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
                });
            });
        }
        else if (config.mode === "ltp") {
            // @ts-expect-error // TODO https://github.com/k-yle/sACN/pull/63
            sACN.on("changed", (data) => {
                this.send({
                    // @ts-expect-error // TODO https://github.com/k-yle/sACN/pull/63
                    universe: data.universe,
                    // @ts-expect-error // TODO https://github.com/k-yle/sACN/pull/63
                    payload: incrementPayload(data.payload),
                });
            });
        }
        else if (config.mode === "htp") {
            // @ts-expect-error // TODO https://github.com/k-yle/sACN/pull/63
            sACN.on("changed", (data) => {
                this.send({
                    // @ts-expect-error // TODO https://github.com/k-yle/sACN/pull/63
                    universe: data.universe,
                    // @ts-expect-error // TODO https://github.com/k-yle/sACN/pull/63
                    payload: incrementPayload(data.payload),
                });
            });
        }
    }
    function incrementPayload(payload) {
        const result = {};
        Object.keys(payload).forEach((key) => {
            const ch = parseInt(key, 10);
            result[ch + 1] = payload[ch];
        });
        return result;
    }
    RED.nodes.registerType("sacn_in", SacnInNodeConstructor);
};
exports.default = nodeInit;
//# sourceMappingURL=sacn-in.js.map