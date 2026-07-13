"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SceneStore = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
class SceneStore {
  file;
  constructor(baseDir, nodeId) {
    const dir = (0, node_path_1.join)(baseDir, "sacn-scenes");
    (0, node_fs_1.mkdirSync)(dir, { recursive: true });
    this.file = (0, node_path_1.join)(dir, `${nodeId}.json`);
  }
  load() {
    if (!(0, node_fs_1.existsSync)(this.file)) {
      return {};
    }
    try {
      return JSON.parse((0, node_fs_1.readFileSync)(this.file, "utf8"));
    } catch {
      return {};
    }
  }
  save(scenes) {
    (0, node_fs_1.writeFileSync)(this.file, JSON.stringify(scenes));
  }
}
exports.SceneStore = SceneStore;
