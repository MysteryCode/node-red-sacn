import { Node, NodeAPI, NodeDef } from "node-red";
import { NodeMessage } from "@node-red/registry";

type SceneControllerAction = "save" | "play" | "reset";

interface DMXValues {
  [key: number]: number | undefined;
}

interface Universes {
  [key: number]: DMXValues;
}

interface Scene {
  scene: number;
  data: Universes;
}

export type Config = NodeDef;

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
  universe?: number | undefined;
  payload: DMXValues | Universes;
}

class NodeHandler {
  protected node: Node<Config>;

  protected config: Config;

  constructor(node: Node<Config>, config: Config) {
    this.node = node;
    this.config = config;

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
    if (universe === undefined || isNaN(universe) || universe < 1 || universe > 65279) {
      throw new Error(`The universe number '${universe}' (${typeof universe}) is invalid or not between 1 and 65279.`);
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
    if (isNaN(value) || value < 0 || value > 255) {
      throw new Error(
        `Value '${value}' (${typeof value}) for channel '${channel}' of universe '${universe}' is invalid or not between 0 and 255.`,
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
        value = parseInt(value);
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
        value = parseInt(value, 10);
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

        if (typeof item === "string" || !isNaN(item as number)) {
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

  protected validateReset(_: MessageIn) {
    // nothing required yet.
    return true;
  }

  protected handleSave(message: MessageIn) {
    const scene: Scene = {
      scene: message.scene,
      data: message.payload as Universes,
    };
    this.node.context().set(`scene-${message.scene}`, scene);
  }

  protected handlePlay(message: MessageIn): void {
    const data: Scene | null = this.node.context().get(`scene-${message.scene}`) as Scene | null;
    if (!data) {
      this.node.warn(`Cannot play scene no. ${message.scene} since it has not been recorded yet.`);

      return;
    }

    this.node.context().set("playingScene", message.scene);

    let payload: Universes | DMXValues;
    let universe: number | undefined = undefined;
    const universes = Object.keys(data.data);
    if (universes.length === 1) {
      universe = parseInt(universes[0], 10);
      payload = data.data[universe];
    } else {
      payload = data.data;
    }

    this.node.send({
      topic: message.topic ?? `Scene ${message.scene}`,
      scene: message.scene,
      payload: payload,
      universe: universe,
    } as MessageOut);

    this.node.status({
      fill: "green",
      shape: "dot",
      text: message.topic ?? `Scene ${message.scene}`,
    });
  }

  protected getNulledUniverse(): DMXValues {
    const universe: DMXValues = {};

    for (let ch = 1; ch <= 512; ch++) {
      universe[ch] = 0;
    }

    return universe;
  }

  protected handleReset(message: MessageIn): void {
    // TODO
    const resetScene = (scene: number) => {
      const data: Scene | null = this.node.context().get(`scene-${scene}`) as Scene | null;

      if (this.node.context().get("playingScene") === scene) {
        this.node.context().set("playingScene", null);

        this.node.status({
          fill: "green",
          shape: "ring",
          text: "Standby",
        });

        if (data) {
          const universes = Object.keys(data.data);
          let universe: number | undefined = undefined;
          let payload: DMXValues | Universes;
          if (universes.length === 1) {
            universe = parseInt(universes[0], 10);
            payload = this.getNulledUniverse();
          } else {
            payload = {};
            universes.forEach((universe) => {
              payload[parseInt(universe, 10)] = this.getNulledUniverse();
            });
          }

          this.node.send({
            topic: `Scene ${scene}`,
            scene: scene,
            payload: payload,
            universe: universe,
            reset: true,
          } as MessageOut);
        }
      }

      this.node.context().set(`scene-${scene}`, undefined);
    };

    if (message.scene) {
      resetScene(message.scene);
    } else {
      this.node
        .context()
        .keys()
        .forEach((key) => {
          const matches = key.match(/^scene-(\d+)/);
          if (matches !== null) {
            resetScene(parseInt(matches[1], 10));
          }
        });
    }
  }
}

export default (RED: NodeAPI): void => {
  RED.nodes.registerType("scene-controller", function (this: Node<Config>, config: Config) {
    RED.nodes.createNode(this, config);

    new NodeHandler(this, config);
  });
};
