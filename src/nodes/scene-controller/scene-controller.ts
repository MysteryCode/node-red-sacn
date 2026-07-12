import { Node, NodeAPI, NodeDef } from "node-red";
import { NodeMessage } from "@node-red/registry";
import { DMXValues, maxValue, nulledUniverse, ValueScale } from "../../lib/dmx";
import { SceneStore } from "../../lib/scene-store";

type SceneControllerAction = "save" | "play" | "stop" | "reset";

/** whether a new play replaces the running look ("switch") or stacks on top of it ("add") */
type PlayMode = "switch" | "add";

interface Universes {
  [key: number]: DMXValues;
}

interface Scene {
  scene: number;
  data: Universes;
}

export interface Config extends NodeDef {
  values?: ValueScale;
  playMode?: PlayMode;
  blackoutOnStop?: boolean;
}

type MessageInPayload =
  | {
      [key: number | string]: number[] | DMXValues;
    }
  | number[]
  | Universes;

interface MessageIn extends NodeMessage {
  payload: MessageInPayload;
  action: SceneControllerAction;
  universe?: number;
  scene: number;
  isSingleUniverse?: boolean;
}

interface MessageOut extends NodeMessage {
  scene: number;
  reset?: boolean;
  stopped?: boolean;
  universe?: number | undefined;
  payload: DMXValues | Universes;
}

class NodeHandler {
  protected node: Node<Config>;

  protected config: Config;

  protected scale: ValueScale;

  protected store: SceneStore<Scene>;

  protected scenes: Record<number, Scene>;

  protected playMode: PlayMode;

  /** scenes whose look is currently on the output; more than one only in "add" mode */
  protected activeScenes: Set<number> = new Set();

  constructor(node: Node<Config>, config: Config, store: SceneStore<Scene>) {
    this.node = node;
    this.config = config;
    this.scale = config.values ?? "percent";
    this.store = store;
    this.scenes = store.load();
    this.playMode = config.playMode ?? "switch";

    this.node.on("input", (msg) => {
      const message: MessageIn = msg as MessageIn;

      switch (message.action || "undefined") {
        case "save":
          if (this.validateSave(message)) {
            this.handleSave(message);
          }
          break;
        case "play":
          if (this.validatePlay(message)) {
            this.handlePlay(message);
          }
          break;
        case "stop":
          if (this.validateStop(message)) {
            this.handleStop(message);
          }
          break;
        case "reset":
          if (this.validateReset(message)) {
            this.handleReset(message);
          }
          break;
        default:
          // validate action
          if (message.action === undefined) {
            this.node.warn('Message-Object is missing the "action"-property.');
            break;
          }

          this.node.warn(
            `The given "action"-property "${message.action as string}" (${typeof message.action}) is not supported.`,
          );
          break;
      }
    });
  }

  protected validateUniverse(universe: number | undefined): void {
    if (universe === undefined || isNaN(universe) || universe < 1 || universe > 63999) {
      throw new Error(`The universe number '${universe}' (${typeof universe}) is invalid or not between 1 and 63999.`);
    }
  }

  protected validateChannel(
    channel: number,
    universe: number,
    firstChannel: number = 1,
    lastChannel: number = 512,
  ): void {
    if (isNaN(channel) || channel < firstChannel || channel > lastChannel) {
      throw new Error(
        `Channel number '${channel}' (${typeof channel}) of universe '${universe}' is invalid or not between ${firstChannel} and ${lastChannel}.`,
      );
    }
  }

  protected validateValue(value: number, channel: number, universe: number): void {
    const max = maxValue(this.scale);

    if (isNaN(value) || value < 0 || value > max) {
      throw new Error(
        `Value '${value}' (${typeof value}) for channel '${channel}' of universe '${universe}' is invalid or not between 0 and ${max}.`,
      );
    }
  }

  protected parseUniverseObject(input: object, universe: number): DMXValues {
    const keys = Object.keys(input);
    const output: DMXValues = {};
    const startIndex = keys.includes("0") || keys.includes(0 as keyof object) ? 0 : 1;
    const endIndex = startIndex === 0 ? 511 : 512;

    if (keys.length !== 512) {
      throw new Error(`Universe ${universe} contains ${keys.length} values, but not 512 values.`);
    }

    let channel: unknown;
    for (channel in input) {
      let value: unknown = input[channel as keyof object];

      if (typeof channel === "string") {
        channel = parseInt(channel, 10);
      }

      this.validateChannel(channel as number, universe, startIndex, endIndex);

      if (typeof value === "string") {
        // parse as float so fractional percentage values keep their precision
        value = parseFloat(value);
      }

      this.validateValue(value as number, channel as number, universe);

      output[channel as number] = value as number;
    }

    return output;
  }

  protected parseUniverseArray(input: unknown[], universe: number): DMXValues {
    const output: DMXValues = {};

    if (input.length !== 512) {
      throw new Error(`Universe ${universe} contains ${input.length} values, but not 512 values.`);
    }

    input.forEach((value, channel) => {
      this.validateChannel(channel, universe, 0, 511);

      if (typeof value === "string") {
        // parse as float so fractional percentage values keep their precision
        value = parseFloat(value);
      }

      this.validateValue(value as number, channel, universe);

      output[channel] = value as number;
    });

    return output;
  }

  protected parseUniverseData(input: unknown, universe: number | undefined): Universes {
    const output: Universes = {};

    if (input === undefined || input === null || (typeof input !== "object" && !Array.isArray(input))) {
      throw new Error(`Payload must be an object or an array. Type "${typeof input}" is not supported.`);
    }

    if (Array.isArray(input)) {
      if (typeof universe === "string") {
        universe = parseInt(universe, 10);
      }

      this.validateUniverse(universe);

      output[universe!] = this.parseUniverseArray(input, universe!);
    } else if (typeof input === "object") {
      let containsPossibleNumericValues = false;
      let containsPossibleUniverses = false;
      let containsDifferent = false;

      for (const key in input) {
        const item = input[key as keyof object];

        if (typeof item === "string" || !isNaN(item)) {
          containsPossibleNumericValues = true;
        } else if (Array.isArray(item) || typeof item === "object") {
          containsPossibleUniverses = true;
        } else {
          containsDifferent = true;
        }
      }

      if (containsDifferent) {
        throw new Error("Payload contains invalid data.");
      }

      if (containsPossibleUniverses && containsPossibleNumericValues) {
        throw new Error("Payload contains objects or arrays parallel to numeric values");
      }

      if (containsPossibleNumericValues) {
        if (typeof universe === "string") {
          universe = parseInt(universe, 10);
        }

        this.validateUniverse(universe);

        output[universe!] = this.parseUniverseObject(input, universe!);
      } else if (containsPossibleUniverses) {
        let key: unknown;
        for (key in input) {
          if (typeof key === "string") {
            key = parseInt(key, 10);
          }

          this.validateUniverse(key as number);

          const item = input[key as keyof object];

          if (Array.isArray(item)) {
            output[key as number] = this.parseUniverseArray(item, key as number);
          } else if (typeof item === "object") {
            output[key as number] = this.parseUniverseObject(item, key as number);
          } else {
            throw new Error(`Data for universe ${key as number} is invalid.`);
          }
        }
      }
    }

    return output;
  }

  protected validateScene(message: MessageIn) {
    // validate scene
    if (message.scene === undefined) {
      this.node.warn('Message-Object is missing the "scene"-property.');

      return false;
    }

    if (isNaN(message.scene)) {
      this.node.warn(
        `The given "scene"-property "${message.scene}" (${typeof message.scene}) is not a positive number.`,
      );

      return false;
    }

    return true;
  }

  protected validateSave(message: MessageIn) {
    if (!this.validateScene(message)) {
      return false;
    }

    if (typeof message.payload !== "object" && !Array.isArray(message.payload)) {
      this.node.warn("The given payload has to be an object or array.");

      return false;
    }

    try {
      message.payload = this.parseUniverseData(message.payload, message.universe);
    } catch (e) {
      if (e instanceof Error) {
        this.node.warn(e.message);
      }

      return false;
    }

    return true;
  }

  protected validatePlay(message: MessageIn) {
    if (!this.validateScene(message)) {
      return false;
    }

    return true;
  }

  protected validateStop(message: MessageIn) {
    if (!this.validateScene(message)) {
      return false;
    }

    return true;
  }

  protected validateReset(_: MessageIn) {
    // nothing required yet.
    return true;
  }

  protected handleSave(message: MessageIn) {
    this.scenes[message.scene] = {
      scene: message.scene,
      data: message.payload as Universes,
    };
    this.store.save(this.scenes);
  }

  /** combine every active scene into one look, per channel by HTP (highest value wins) */
  protected mergeActiveScenes(): Universes {
    const combined: Universes = {};

    for (const id of this.activeScenes) {
      const scene = this.scenes[id];
      if (!scene) {
        continue;
      }

      for (const universeKey of Object.keys(scene.data)) {
        const universe = parseInt(universeKey, 10);
        const channels = scene.data[universe];
        const target = combined[universe] ?? (combined[universe] = {});

        for (const channelKey of Object.keys(channels)) {
          const channel = parseInt(channelKey, 10);
          target[channel] = Math.max(target[channel] ?? 0, channels[channel]);
        }
      }
    }

    return combined;
  }

  /** shape universes for output: a single universe is flattened + tagged with its number */
  protected shapeOutput(universes: Universes): { payload: DMXValues | Universes; universe: number | undefined } {
    const keys = Object.keys(universes);

    if (keys.length === 1) {
      const universe = parseInt(keys[0], 10);

      return { payload: universes[universe], universe };
    }

    return { payload: universes, universe: undefined };
  }

  /** build an all-zero look for exactly the universes the given scene covers */
  protected buildBlackout(data: Universes): { payload: DMXValues | Universes; universe: number | undefined } {
    const universes = Object.keys(data);

    if (universes.length === 1) {
      return { payload: nulledUniverse(), universe: parseInt(universes[0], 10) };
    }

    const payload: Universes = {};
    universes.forEach((universe) => {
      payload[parseInt(universe, 10)] = nulledUniverse();
    });

    return { payload, universe: undefined };
  }

  /** emit the combined look of all currently active scenes and reflect it in the node status */
  protected emitActiveLook(scene: number, topic?: string): void {
    const { payload, universe } = this.shapeOutput(this.mergeActiveScenes());
    const count = this.activeScenes.size;
    const label = count === 1 ? (topic ?? `Scene ${scene}`) : `${count} scenes`;

    const out: MessageOut = {
      topic: topic ?? label,
      scene: scene,
      payload: payload,
      universe: universe,
    };
    this.node.send(out);

    this.node.status({
      fill: "green",
      shape: "dot",
      text: label,
    });
  }

  protected standby(): void {
    this.node.status({
      fill: "green",
      shape: "ring",
      text: "Standby",
    });
  }

  protected handlePlay(message: MessageIn): void {
    const data: Scene | undefined = this.scenes[message.scene];
    if (!data) {
      this.node.warn(`Cannot play scene no. ${message.scene} since it has not been recorded yet.`);

      return;
    }

    // "switch" replaces the running look; "add" stacks the new scene on top of it (HTP)
    if (this.playMode === "switch") {
      this.activeScenes = new Set([message.scene]);
    } else {
      this.activeScenes.add(message.scene);
    }

    this.emitActiveLook(message.scene, message.topic);
  }

  protected handleStop(message: MessageIn): void {
    // stopping a scene that is not on the output has no effect
    if (!this.activeScenes.has(message.scene)) {
      return;
    }

    const stopped: Scene | undefined = this.scenes[message.scene];
    this.activeScenes.delete(message.scene);

    if (this.activeScenes.size === 0) {
      this.standby();

      // the scene keeps its stored data; the output only goes dark when configured
      if (this.config.blackoutOnStop && stopped) {
        const { payload, universe } = this.buildBlackout(stopped.data);

        const out: MessageOut = {
          topic: `Scene ${message.scene}`,
          scene: message.scene,
          payload: payload,
          universe: universe,
          stopped: true,
        };
        this.node.send(out);
      }

      return;
    }

    // other scenes remain active: re-emit the combined look without the stopped one
    this.emitActiveLook(message.scene, message.topic);
  }

  protected handleReset(message: MessageIn): void {
    const resetScene = (scene: number) => {
      const data: Scene | undefined = this.scenes[scene];
      const wasActive = this.activeScenes.delete(scene);

      delete this.scenes[scene];

      if (!wasActive) {
        return;
      }

      if (this.activeScenes.size === 0) {
        this.standby();

        if (data) {
          const { payload, universe } = this.buildBlackout(data.data);

          const out: MessageOut = {
            topic: `Scene ${scene}`,
            scene: scene,
            payload: payload,
            universe: universe,
            reset: true,
          };
          this.node.send(out);
        }
      } else {
        // in "add" mode other scenes stay on the output: re-emit the remaining look
        this.emitActiveLook(scene);
      }
    };

    if (message.scene) {
      resetScene(message.scene);
    } else {
      Object.keys(this.scenes).forEach((key) => {
        resetScene(parseInt(key, 10));
      });
    }

    this.store.save(this.scenes);
  }
}

export default (RED: NodeAPI): void => {
  RED.nodes.registerType("scene-controller", function (this: Node<Config>, config: Config) {
    RED.nodes.createNode(this, config);

    const baseDir = RED.settings.userDir ?? process.cwd();
    new NodeHandler(this, config, new SceneStore<Scene>(baseDir, this.id));
  });
};
