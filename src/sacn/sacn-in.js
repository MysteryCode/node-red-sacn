"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sacn_1 = require("sacn");
const nodeInit = (RED) => {
    function SacnInNodeConstructor(config) {
        RED.nodes.createNode(this, config);
        // initialize universe data
        let data = new Map();
        // parse options for receiver instance
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
        // internal functions
        const getNulledUniverse = () => {
            const universe = {};
            for (let ch = 1; ch <= 512; ch++) {
                universe[ch] = 0;
            }
            return universe;
        };
        const getReference = (universe) => {
            if (config.output === "changes") {
                return {};
            }
            return data?.get(universe) ?? getNulledUniverse();
        };
        const parsePayload = (payload, universe) => {
            const processedPayload = getReference(universe);
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
        let sACN;
        switch (config.mode) {
            case "passthrough":
                sACN = new sacn_1.Receiver(options);
                break;
            case "htp":
            case "ltp":
                options.mode = config.mode.toUpperCase();
                sACN = new sacn_1.unstable_MergingReceiver(options);
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
                    payload: parsePayload(data.payload, data.universe),
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
                    payload: parsePayload(data.payload, data.universe),
                });
            });
        }
    }
    RED.nodes.registerType("sacn_in", SacnInNodeConstructor);
};
exports.default = nodeInit;
//# sourceMappingURL=sacn-in.js.map