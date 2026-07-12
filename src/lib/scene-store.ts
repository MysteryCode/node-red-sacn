import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** persists recorded scenes to a JSON file so they survive a Node-RED restart */
export class SceneStore<T> {
  private readonly file: string;

  constructor(baseDir: string, nodeId: string) {
    const dir = join(baseDir, "sacn-scenes");
    mkdirSync(dir, { recursive: true });
    this.file = join(dir, `${nodeId}.json`);
  }

  load(): Record<number, T> {
    if (!existsSync(this.file)) {
      return {};
    }

    try {
      return JSON.parse(readFileSync(this.file, "utf8")) as Record<number, T>;
    } catch {
      // a corrupt or unreadable file must not take the node down; start empty
      return {};
    }
  }

  save(scenes: Record<number, T>): void {
    writeFileSync(this.file, JSON.stringify(scenes));
  }
}
