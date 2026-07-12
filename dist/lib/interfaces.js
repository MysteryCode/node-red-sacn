"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listInterfaces = listInterfaces;
exports.registerInterfaceEndpoint = registerInterfaceEndpoint;
const node_os_1 = require("node:os");
function listInterfaces() {
    const result = [];
    const interfaces = (0, node_os_1.networkInterfaces)();
    for (const name of Object.keys(interfaces)) {
        for (const info of interfaces[name] ?? []) {
            if (info.family === "IPv4") {
                result.push({ name, address: info.address });
            }
        }
    }
    return result;
}
let registered = false;
function registerInterfaceEndpoint(RED) {
    if (registered) {
        return;
    }
    registered = true;
    RED.httpAdmin.get("/sacn/interfaces", RED.auth.needsPermission("flows.read"), (_req, res) => {
        res.json(listInterfaces());
    });
}
