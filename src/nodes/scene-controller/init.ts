import { EditorNodeDef, EditorNodeProperties, EditorRED } from "node-red";

declare const RED: EditorRED;

interface Defaults extends EditorNodeProperties {
  values: "percent" | "absolute";
  playMode: "switch" | "add";
  blackoutOnStop: boolean;
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
    playMode: {
      value: "switch",
      required: true,
    },
    blackoutOnStop: {
      value: false,
    },
  },
  inputs: 1,
  outputs: 1,
  paletteLabel: function () {
    return this._("scene-controller.paletteLabel");
  },
  icon: "scene-controller.svg",
  label: function () {
    return this.name || this._("scene-controller.label.fallback");
  },
  labelStyle: function () {
    return this.name ? "node_label_italic" : "";
  },
};

RED.nodes.registerType("scene-controller", def);
