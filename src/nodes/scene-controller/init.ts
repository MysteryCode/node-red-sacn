import { EditorNodeDef, EditorNodeProperties, EditorRED } from "node-red";

declare const RED: EditorRED;

interface Defaults extends EditorNodeProperties {
  values: "percent" | "absolute";
}

const def: EditorNodeDef<Defaults> = {
  category: "sACN",
  color: "#dcc515",
  defaults: {
    name: {
      value: "Scene-Controller",
    },
    values: {
      value: "percent",
      required: true,
    },
  },
  inputs: 1,
  outputs: 1,
  paletteLabel: "Scene-Controller",
  icon: "scene-controller.svg",
  label: function () {
    return this.name || "Scene-Controller";
  },
  labelStyle: function () {
    return this.name ? "node_label_italic" : "";
  },
};

RED.nodes.registerType("scene-controller", def);
