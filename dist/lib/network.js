"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PORT = void 0;
exports.resolveNetworkOptions = resolveNetworkOptions;
const node_net_1 = require("node:net");
exports.DEFAULT_PORT = 5568;
function resolveNetworkOptions(config) {
    const options = {
        port: config.port !== undefined && config.port > 0 ? config.port : exports.DEFAULT_PORT,
    };
    if (config.interface !== undefined && (0, node_net_1.isIP)(config.interface) === 4) {
        options.iface = config.interface;
    }
    return options;
}
