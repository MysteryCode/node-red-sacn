import { EditorNodeDef, EditorNodeProperties, EditorRED } from "node-red";

declare const RED: EditorRED;

interface Defaults extends EditorNodeProperties {
  universe: number;
  port?: number | undefined;
  interface?: string | undefined;
  mode: "htp" | "ltp" | "passthrough";
  output: "full" | "changes";
  trigger: "changes" | "always" | "interval";
  interval: number;
  clearOnUniverseChange: boolean;
}

const def: EditorNodeDef<Defaults> = {
  category: "sACN",
  color: "#dcc515",
  defaults: {
    name: {
      value: "Scene-Controller",
    },
    universe: {
      value: 1,
      required: true,
    },
    port: {
      value: undefined,
      required: false,
    },
    interface: {
      value: "",
      required: false,
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
  },
  inputs: 1,
  outputs: 1,
  paletteLabel: "sACN in",
  icon: "font-awesome/fa-lightbulb-o",
  label: function () {
    return this.name || "sACN";
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
  },
};

RED.nodes.registerType("sacn-in", def);
