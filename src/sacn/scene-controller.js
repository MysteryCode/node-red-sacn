"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const nodeInit = (RED) => {
    function SceneControllerNodeConstructor(config) {
        RED.nodes.createNode(this, config);
        const validateUniverse = (universe) => {
            if (universe === undefined || isNaN(universe) || universe < 1 || universe > 65279) {
                throw new Error(`The universe number '${universe}' (${typeof universe}) is invalid or not between 1 and 65279.`);
            }
        };
        const validateChannel = (channel, universe, firstChannel = 1, lastChannel = 512) => {
            if (isNaN(channel) || channel < firstChannel || channel > lastChannel) {
                throw new Error(`Channel number '${channel}' (${typeof channel}) of universe '${universe}' is invalid or not between ${firstChannel} and ${lastChannel}.`);
            }
        };
        const validateValue = (value, channel, universe) => {
            if (isNaN(value) || value < 0 || value > 255) {
                throw new Error(`Value '${value}' (${typeof value}) for channel '${channel}' of universe '${universe}' is invalid or not between 0 and 255.`);
            }
        };
        const parseUniverseObject = (input, universe) => {
            const keys = Object.keys(input);
            const output = {};
            const startIndex = keys.includes("0") || keys.includes(0) ? 0 : 1;
            const endIndex = startIndex === 0 ? 511 : 512;
            if (keys.length !== 512) {
                throw new Error(`Universe ${universe} contains ${keys.length} values, but not 512 values.`);
            }
            let channel;
            for (channel in input) {
                let value = input[channel];
                if (typeof channel === "string") {
                    channel = parseInt(channel, 10);
                }
                validateChannel(channel, universe, startIndex, endIndex);
                if (typeof value === "string") {
                    value = parseInt(value);
                }
                validateValue(value, channel, universe);
                output[channel] = value;
            }
            return output;
        };
        const parseUniverseArray = (input, universe) => {
            const output = {};
            if (input.length !== 512) {
                throw new Error(`Universe ${universe} contains ${input.length} values, but not 512 values.`);
            }
            input.forEach((value, channel) => {
                validateChannel(channel, universe, 0, 511);
                if (typeof value === "string") {
                    value = parseInt(value, 10);
                }
                validateValue(value, channel, universe);
                output[channel] = value;
            });
            return output;
        };
        const parseUniverseData = (input, universe) => {
            const output = {};
            if (input === undefined || input === null || (typeof input !== "object" && !Array.isArray(input))) {
                throw new Error(`Payload must be an object or an array. Type "${typeof input}" is not supported.`);
            }
            if (Array.isArray(input)) {
                if (typeof universe === "string") {
                    universe = parseInt(universe, 10);
                }
                validateUniverse(universe);
                output[universe] = parseUniverseArray(input, universe);
            }
            else if (typeof input === "object") {
                let containsPossibleNumericValues = false;
                let containsPossibleUniverses = false;
                let containsDifferent = false;
                for (const key in input) {
                    const item = input[key];
                    if (typeof item === "string" || !isNaN(item)) {
                        containsPossibleNumericValues = true;
                    }
                    else if (Array.isArray(item) || typeof item === "object") {
                        containsPossibleUniverses = true;
                    }
                    else {
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
                    output[universe] = parseUniverseObject(input, universe);
                }
                else if (containsPossibleUniverses) {
                    let key;
                    for (key in input) {
                        if (typeof key === "string") {
                            key = parseInt(key, 10);
                        }
                        validateUniverse(key);
                        const item = input[key];
                        if (Array.isArray(item)) {
                            output[key] = parseUniverseArray(item, key);
                        }
                        else if (typeof item === "object") {
                            output[key] = parseUniverseObject(item, key);
                        }
                        else {
                            throw new Error(`Data for universe ${key} is invalid.`);
                        }
                    }
                }
            }
            return output;
        };
        const validateScene = (message) => {
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
        const validateSave = (message) => {
            if (!validateScene(message)) {
                return false;
            }
            if (typeof message.payload !== "object" && !Array.isArray(message.payload)) {
                this.warn("The given payload has to be an object or array.");
                return false;
            }
            try {
                message.payload = parseUniverseData(message.payload, message.universe);
            }
            catch (e) {
                if (e instanceof Error) {
                    this.warn(e.message);
                }
                return false;
            }
            return true;
        };
        const validatePlay = (message) => {
            if (!validateScene(message)) {
                return false;
            }
            return true;
        };
        const validateReset = (_) => {
            // nothing required yet.
            return true;
        };
        const handleSave = (message) => {
            const scene = {
                scene: message.scene,
                data: message.payload,
            };
            this.context().set(`scene-${message.scene}`, scene);
        };
        const handlePlay = (message) => {
            const data = this.context().get(`scene-${message.scene}`);
            if (!data) {
                this.warn(`Cannot play scene no. ${message.scene} since it has not been recorded yet.`);
                return;
            }
            this.context().set("playingScene", message.scene);
            let payload;
            let universe = undefined;
            const universes = Object.keys(data.data);
            if (universes.length === 1) {
                universe = parseInt(universes[0], 10);
                payload = data.data[universe];
            }
            else {
                payload = data.data;
            }
            this.send({
                topic: message.topic ?? `Scene ${message.scene}`,
                scene: message.scene,
                payload: payload,
                universe: universe,
            });
            this.status({
                fill: "green",
                shape: "dot",
                text: message.topic ?? `Scene ${message.scene}`,
            });
        };
        const handleReset = (message) => {
            // TODO
            const resetScene = (scene) => {
                this.context().set(`scene-${scene}`, undefined);
                if (this.context().get("playingScene") === scene) {
                    this.context().set("playingScene", null);
                    this.status({
                        fill: "green",
                        shape: "ring",
                        text: "Standby",
                    });
                }
            };
            if (message.scene) {
                resetScene(message.scene);
            }
            else {
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
            const message = msg;
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
                    this.warn(`The given "action"-property "${message.action}" (${typeof message.action}) is not supported.`);
                    break;
            }
        });
    }
    RED.nodes.registerType("scene_controller", SceneControllerNodeConstructor);
};
exports.default = nodeInit;
//# sourceMappingURL=scene-controller.js.map