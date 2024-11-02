import { EditorNodeDef, EditorNodeProperties, EditorRED } from "node-red";

declare const RED: EditorRED;

interface Defaults extends EditorNodeProperties {
  universe: number;
  port?: number | undefined;
  interface?: string | undefined;
  speed: number;
  priority: number;
  sourceName: string;
}

RED.nodes.registerType("sacn-out", {
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
  },
  inputs: 1,
  outputs: 0,
  paletteLabel: "sACN out",
  icon: "font-awesome/fa-lightbulb-o",
  label: function () {
    return this.name || "sACN";
  },
  labelStyle: function () {
    return this.name ? "node_label_italic" : "";
  },
} as EditorNodeDef<Defaults>);
