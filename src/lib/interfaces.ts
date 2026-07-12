import { networkInterfaces } from "node:os";
import { NodeAPI } from "node-red";

export interface InterfaceInfo {
  name: string;
  address: string;
}

/** all local IPv4 interfaces with their address, for the editor to offer */
export function listInterfaces(): InterfaceInfo[] {
  const result: InterfaceInfo[] = [];
  const interfaces = networkInterfaces();

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

/** register the admin endpoint that lists the interfaces; safe to call more than once */
export function registerInterfaceEndpoint(RED: NodeAPI): void {
  if (registered) {
    return;
  }
  registered = true;

  RED.httpAdmin.get("/sacn/interfaces", RED.auth.needsPermission("flows.read"), (_req, res) => {
    res.json(listInterfaces());
  });
}
