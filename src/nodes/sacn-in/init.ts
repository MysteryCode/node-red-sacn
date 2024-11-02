import { EditorNodeDef, EditorNodeProperties, EditorRED } from "node-red";

declare const RED: EditorRED;

interface Defaults extends EditorNodeProperties {
  universe: number;
  port?: number | undefined;
  interface?: string | undefined;
  mode: "htp" | "ltp" | "passthrough";
  output: "full" | "changes";
}

RED.nodes.registerType("sacn-in", {
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
  },
  inputs: 0,
  outputs: 1,
  paletteLabel: "sACN in",
  icon: "font-awesome/fa-lightbulb-o",
  label: function () {
    return this.name || "sACN";
  },
  labelStyle: function () {
    return this.name ? "node_label_italic" : "";
  },
} as EditorNodeDef<Defaults>);
