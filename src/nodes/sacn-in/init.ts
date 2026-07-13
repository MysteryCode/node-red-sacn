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
  mode: "htp" | "ltp" | "passthrough";
  output: "full" | "changes";
  trigger: "changes" | "always" | "interval";
  interval: number;
  clearOnUniverseChange: boolean;
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
    mode: {
      value: "htp",
      required: true,
    },
    output: {
      value: "full",
      required: true,
    },
    trigger: {
      value: "changes",
      required: true,
    },
    interval: {
      value: 1000,
      required: true,
    },
    clearOnUniverseChange: {
      value: false,
    },
    values: {
      value: "percent",
      required: true,
    },
  },
  inputs: 1,
  outputs: 1,
  paletteLabel: function () {
    return this._("sacn-in.paletteLabel");
  },
  icon: "sacn-in.svg",
  label: function () {
    return this.name || this._("sacn-in.label.fallback", { universe: this.universe });
  },
  labelStyle: function () {
    return this.name ? "node_label_italic" : "";
  },
  oneditprepare: function () {
    const select = document.getElementById("node-input-trigger") as HTMLSelectElement | null;
    const row = document.getElementById("row-interval");

    const toggleInterval = (): void => {
      if (row) {
        row.style.display = select?.value === "interval" ? "" : "none";
      }
    };

    select?.addEventListener("change", toggleInterval);
    toggleInterval();

    populateInterfaceOptions();
  },
};

RED.nodes.registerType("sacn-in", def);
