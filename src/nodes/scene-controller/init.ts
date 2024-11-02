import { EditorNodeDef, EditorNodeProperties, EditorRED } from "node-red";

declare const RED: EditorRED;

type Defaults = EditorNodeProperties;

RED.nodes.registerType("scene-controller", {
  category: "sACN",
  color: "#dcc515",
  defaults: {
    name: {
      value: "Scene-Controller",
    },
  },
  inputs: 1,
  outputs: 1,
  paletteLabel: "Scene-Controller",
  icon: "font-awesome/fa-list-ol",
  label: function () {
    return this.name || "Scene-Controller";
  },
  labelStyle: function () {
    return this.name ? "node_label_italic" : "";
  },
} as EditorNodeDef<Defaults>);
