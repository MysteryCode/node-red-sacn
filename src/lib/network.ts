export interface NetworkConfig {
  interface?: string;
  port?: number;
}

export interface NetworkOptions {
  iface?: string;
  port: number;
}

/** default sACN (E1.31) network port */
export const DEFAULT_PORT = 5568;

/** resolve the shared interface/port options for a receiver or sender */
export function resolveNetworkOptions(config: NetworkConfig): NetworkOptions {
  const options: NetworkOptions = {
    port: config.port !== undefined && config.port > 0 ? config.port : DEFAULT_PORT,
  };

  if (config.interface !== undefined && config.interface.length > 7) {
    options.iface = config.interface;
  }

  return options;
}
