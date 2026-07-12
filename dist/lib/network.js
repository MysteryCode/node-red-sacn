"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PORT = void 0;
exports.resolveNetworkOptions = resolveNetworkOptions;
exports.DEFAULT_PORT = 5568;
function resolveNetworkOptions(config) {
    const options = {
        port: config.port !== undefined && config.port > 0 ? config.port : exports.DEFAULT_PORT,
    };
    if (config.interface !== undefined && config.interface.length > 7) {
        options.iface = config.interface;
    }
    return options;
}
