import { Node, NodeDef, NodeInitializer, NodeMessageInFlow } from "node-red";
import { NodeMessage } from "@node-red/registry";

type SceneControllerOptions = NodeDef;

type SceneControllerAction = "save" | "play" | "reset";

type NodeMessageInPayload =
  | {
      [key: number | string]: number[] | DMXValues;
    }
  | number[]
  | Universes;

interface NodeMessageIn extends NodeMessageInFlow {
  payload: NodeMessageInPayload;
  action: SceneControllerAction;
  universe?: number;
  scene: number;
  isSingleUniverse?: boolean;
}

interface NodeMessageOut extends NodeMessage {
  scene: number;
}

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

type Validator = (message: NodeMessageIn) => boolean;

type Executor = (message: NodeMessageIn) => void;

const nodeInit: NodeInitializer = (RED): void => {
  function SceneControllerNodeConstructor(this: Node, config: SceneControllerOptions): void {
    RED.nodes.createNode(this, config);

    const validateUniverse = (universe: number | undefined): void => {
      if (universe === undefined || isNaN(universe) || universe < 1 || universe > 65279) {
        throw new Error(
          `The universe number '${universe}' (${typeof universe}) is invalid or not between 1 and 65279.`,
        );
      }
    };

    const validateChannel = (
      channel: number,
      universe: number,
      firstChannel: number = 1,
      lastChannel: number = 512,
    ): void => {
      if (isNaN(channel) || channel < firstChannel || channel > lastChannel) {
        throw new Error(
          `Channel number '${channel}' (${typeof channel}) of universe '${universe}' is invalid or not between ${firstChannel} and ${lastChannel}.`,
        );
      }
    };

    const validateValue = (value: number, channel: number, universe: number): void => {
      if (isNaN(value) || value < 0 || value > 255) {
        throw new Error(
          `Value '${value}' (${typeof value}) for channel '${channel}' of universe '${universe}' is invalid or not between 0 and 255.`,
        );
      }
    };

    const parseUniverseObject = (input: object, universe: number): DMXValues => {
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

        validateChannel(channel as number, universe, startIndex, endIndex);

        if (typeof value === "string") {
          value = parseInt(value);
        }

        validateValue(value as number, channel as number, universe);

        output[channel as number] = value as number;
      }

      return output;
    };

    const parseUniverseArray = (input: unknown[], universe: number): DMXValues => {
      const output: DMXValues = {};

      if (input.length !== 512) {
        throw new Error(`Universe ${universe} contains ${input.length} values, but not 512 values.`);
      }

      input.forEach((value, channel) => {
        validateChannel(channel, universe, 0, 511);

        if (typeof value === "string") {
          value = parseInt(value, 10);
        }

        validateValue(value as number, channel, universe);

        output[channel] = value as number;
      });

      return output;
    };

    const parseUniverseData = (input: unknown, universe: number | undefined): Universes => {
      const output: Universes = {};

      if (input === undefined || input === null || (typeof input !== "object" && !Array.isArray(input))) {
        throw new Error(`Payload must be an object or an array. Type "${typeof input}" is not supported.`);
      }

      if (Array.isArray(input)) {
        if (typeof universe === "string") {
          universe = parseInt(universe, 10);
        }

        validateUniverse(universe);

        output[universe!] = parseUniverseArray(input, universe!);
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

          validateUniverse(universe);

          output[universe!] = parseUniverseObject(input, universe!);
        } else if (containsPossibleUniverses) {
          let key: unknown;
          for (key in input) {
            if (typeof key === "string") {
              key = parseInt(key, 10);
            }

            validateUniverse(key as number);

            const item = input[key as keyof object];

            if (Array.isArray(item)) {
              output[key as number] = parseUniverseArray(item, key as number);
            } else if (typeof item === "object") {
              output[key as number] = parseUniverseObject(item, key as number);
            } else {
              throw new Error(`Data for universe ${key as number} is invalid.`);
            }
          }
        }
      }

      return output;
    };

    const validateScene: Validator = (message: NodeMessageIn) => {
      // validate scene
      if (message.scene === undefined) {
        this.warn('Message-Object is missing the "scene"-property.');

        return false;
      }

      if (isNaN(message.scene)) {
        this.warn(`The given "scene"-property "${message.scene}" (${typeof message.scene}) is not a positive number.`);

        return false;
      }

      return true;
    };

    const validateSave: Validator = (message: NodeMessageIn) => {
      if (!validateScene(message)) {
        return false;
      }

      if (typeof message.payload !== "object" && !Array.isArray(message.payload)) {
        this.warn("The given payload has to be an object or array.");

        return false;
      }

      try {
        message.payload = parseUniverseData(message.payload, message.universe);
      } catch (e) {
        if (e instanceof Error) {
          this.warn(e.message);
        }

        return false;
      }

      return true;
    };

    const validatePlay: Validator = (message: NodeMessageIn) => {
      if (!validateScene(message)) {
        return false;
      }

      return true;
    };

    const validateReset: Validator = (_: NodeMessageIn) => {
      // nothing required yet.
      return true;
    };

    const handleSave: Executor = (message: NodeMessageIn) => {
      const scene: Scene = {
        scene: message.scene,
        data: message.payload as Universes,
      };
      this.context().set(`scene-${message.scene}`, scene);
    };

    const handlePlay: Executor = (message: NodeMessageIn) => {
      const data: Scene | null = this.context().get(`scene-${message.scene}`) as Scene | null;
      if (!data) {
        this.warn(`Cannot play scene no. ${message.scene} since it has not been recorded yet.`);

        return;
      }

      this.context().set("playingScene", message.scene);

      let payload: Universes | DMXValues;
      let universe: number | undefined = undefined;
      const universes = Object.keys(data.data);
      if (universes.length === 1) {
        universe = parseInt(universes[0], 10);
        payload = data.data[universe];
      } else {
        payload = data.data;
      }

      this.send({
        topic: message.topic ?? `Scene ${message.scene}`,
        scene: message.scene,
        payload: payload,
        universe: universe,
      } as NodeMessageOut);
    };

    const handleReset: Executor = (message: NodeMessageIn) => {
      // TODO
      const resetScene = (scene: number) => {
        this.context().set(`scene-${scene}`, undefined);

        if (this.context().get("playingScene") === scene) {
          this.context().set("playingScene", null);
        }
      };

      if (message.scene) {
        resetScene(message.scene);
      } else {
        this.context()
          .keys()
          .forEach((key) => {
            const matches = key.match(/^scene-(\d+)/);
            if (matches !== null) {
              resetScene(parseInt(matches[1], 10));
            }
          });
      }
    };

    this.on("input", (msg) => {
      const message: NodeMessageIn = msg as NodeMessageIn;

      switch (message.action || "undefined") {
        case "save":
          if (validateSave(message)) {
            handleSave(message);
          }
          break;
        case "play":
          if (validatePlay(message)) {
            handlePlay(message);
          }
          break;
        case "reset":
          if (validateReset(message)) {
            handleReset(message);
          }
          break;
        default:
          // validate action
          if (message.action === undefined) {
            this.warn('Message-Object is missing the "action"-property.');
            break;
          }

          this.warn(
            `The given "action"-property "${message.action as string}" (${typeof message.action}) is not supported.`,
          );
          break;
      }
    });
  }

  RED.nodes.registerType("scene_controller", SceneControllerNodeConstructor);
};

export default nodeInit;
