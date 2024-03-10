"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sacn_1 = require("sacn");
// TODO https://github.com/k-yle/sACN/pull/57
const nodeInit = (RED) => {
    function SacnOutNodeConstructor(config) {
        RED.nodes.createNode(this, config);
        const options = {
            universe: config.universe,
            reuseAddr: config.reuseAddress !== undefined ? config.reuseAddress : true,
            minRefreshRate: config.speed !== undefined ? config.speed : 0,
        };
        if (config.interface !== undefined && config.interface.length > 7) {
            options.iface = config.interface;
        }
        if (config.port !== undefined && config.port > 0) {
            options.port = config.port;
        }
        const sACN = new sacn_1.Sender(options);
        this.on("close", () => {
            // close all connections; terminate the receiver
            sACN.close();
        });
        this.on("input", function (msg) {
            void (async () => {
                await sACN.send({
                    payload: msg.payload,
                    sourceName: config.sourceName,
                    priority: config.priority || 100,
                });
            })();
        });
    }
    RED.nodes.registerType("sacn_out", SacnOutNodeConstructor);
};
exports.default = nodeInit;
//# sourceMappingURL=sacn-out.js.map