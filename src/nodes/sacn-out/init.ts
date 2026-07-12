import { EditorNodeDef, EditorNodeProperties, EditorRED } from "node-red";

declare const RED: EditorRED;
declare const $: {
  getJSON(url: string, success: (data: { name: string; address: string }[]) => void): void;
};

function populateInterfaceOptions(): void {
  const list = document.getElementById("node-input-interface-options");
  if (!list) {
    return;
  }

  $.getJSON("sacn/interfaces", (interfaces) => {
    list.replaceChildren();
    interfaces.forEach((iface) => {
      const option = document.createElement("option");
      option.value = iface.address;
      option.label = `${iface.name} (${iface.address})`;
      list.appendChild(option);
    });
  });
}

function toInt(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    return parseInt(value, 10);
  }
  return NaN;
}

function isValidInterface(value: unknown): boolean {
  if (typeof value !== "string" || value === "") {
    return true;
  }
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(value);
}

function isValidUniverse(value: unknown): boolean {
  const n = toInt(value);
  return !isNaN(n) && n >= 1 && n <= 63999;
}

function isValidPort(value: unknown): boolean {
  if (value === undefined || value === null || value === "") {
    return true;
  }
  const n = toInt(value);
  return !isNaN(n) && n >= 1 && n <= 65535;
}

interface Defaults extends EditorNodeProperties {
  universe: number;
  port?: number | undefined;
  interface?: string | undefined;
  speed: number;
  priority: number;
  sourceName: string;
  blankOnClose: boolean;
  values: "percent" | "absolute";
}

const def: EditorNodeDef<Defaults> = {
  category: "sACN",
  color: "#dcc515",
  defaults: {
    name: {
      value: "",
    },
    universe: {
      value: 1,
      required: true,
      validate: function (v) {
        return isValidUniverse(v);
      },
    },
    port: {
      value: undefined,
      required: false,
      validate: function (v) {
        return isValidPort(v);
      },
    },
    interface: {
      value: "",
      required: false,
      validate: function (v) {
        return isValidInterface(v);
      },
    },
    speed: {
      value: 0,
      required: true,
    },
    priority: {
      value: 100,
      required: true,
    },
    sourceName: {
      value: "Node-RED",
      required: true,
    },
    blankOnClose: {
      value: false,
    },
    values: {
      value: "percent",
      required: true,
    },
  },
  inputs: 1,
  outputs: 0,
  paletteLabel: "sACN out",
  icon: "font-awesome/fa-lightbulb-o",
  label: function () {
    return this.name || `sACN out · U${this.universe}`;
  },
  labelStyle: function () {
    return this.name ? "node_label_italic" : "";
  },
  oneditprepare: function () {
    populateInterfaceOptions();
  },
};

RED.nodes.registerType("sacn-out", def);
