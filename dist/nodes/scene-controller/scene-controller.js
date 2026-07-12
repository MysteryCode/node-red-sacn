"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dmx_1 = require("../../lib/dmx");
const scene_store_1 = require("../../lib/scene-store");
class NodeHandler {
    node;
    config;
    scale;
    store;
    scenes;
    playingScene = null;
    constructor(node, config, store) {
        this.node = node;
        this.config = config;
        this.scale = config.values ?? "percent";
        this.store = store;
        this.scenes = store.load();
        this.node.on("input", (msg) => {
            const message = msg;
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
                    if (message.action === undefined) {
                        this.node.warn('Message-Object is missing the "action"-property.');
                        break;
                    }
                    this.node.warn(`The given "action"-property "${message.action}" (${typeof message.action}) is not supported.`);
                    break;
            }
        });
    }
    validateUniverse(universe) {
        if (universe === undefined || isNaN(universe) || universe < 1 || universe > 63999) {
            throw new Error(`The universe number '${universe}' (${typeof universe}) is invalid or not between 1 and 63999.`);
        }
    }
    validateChannel(channel, universe, firstChannel = 1, lastChannel = 512) {
        if (isNaN(channel) || channel < firstChannel || channel > lastChannel) {
            throw new Error(`Channel number '${channel}' (${typeof channel}) of universe '${universe}' is invalid or not between ${firstChannel} and ${lastChannel}.`);
        }
    }
    validateValue(value, channel, universe) {
        const max = (0, dmx_1.maxValue)(this.scale);
        if (isNaN(value) || value < 0 || value > max) {
            throw new Error(`Value '${value}' (${typeof value}) for channel '${channel}' of universe '${universe}' is invalid or not between 0 and ${max}.`);
        }
    }
    parseUniverseObject(input, universe) {
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
            this.validateChannel(channel, universe, startIndex, endIndex);
            if (typeof value === "string") {
                value = parseFloat(value);
            }
            this.validateValue(value, channel, universe);
            output[channel] = value;
        }
        return output;
    }
    parseUniverseArray(input, universe) {
        const output = {};
        if (input.length !== 512) {
            throw new Error(`Universe ${universe} contains ${input.length} values, but not 512 values.`);
        }
        input.forEach((value, channel) => {
            this.validateChannel(channel, universe, 0, 511);
            if (typeof value === "string") {
                value = parseFloat(value);
            }
            this.validateValue(value, channel, universe);
            output[channel] = value;
        });
        return output;
    }
    parseUniverseData(input, universe) {
        const output = {};
        if (input === undefined || input === null || (typeof input !== "object" && !Array.isArray(input))) {
            throw new Error(`Payload must be an object or an array. Type "${typeof input}" is not supported.`);
        }
        if (Array.isArray(input)) {
            if (typeof universe === "string") {
                universe = parseInt(universe, 10);
            }
            this.validateUniverse(universe);
            output[universe] = this.parseUniverseArray(input, universe);
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
                this.validateUniverse(universe);
                output[universe] = this.parseUniverseObject(input, universe);
            }
            else if (containsPossibleUniverses) {
                let key;
                for (key in input) {
                    if (typeof key === "string") {
                        key = parseInt(key, 10);
                    }
                    this.validateUniverse(key);
                    const item = input[key];
                    if (Array.isArray(item)) {
                        output[key] = this.parseUniverseArray(item, key);
                    }
                    else if (typeof item === "object") {
                        output[key] = this.parseUniverseObject(item, key);
                    }
                    else {
                        throw new Error(`Data for universe ${key} is invalid.`);
                    }
                }
            }
        }
        return output;
    }
    validateScene(message) {
        if (message.scene === undefined) {
            this.node.warn('Message-Object is missing the "scene"-property.');
            return false;
        }
        if (isNaN(message.scene)) {
            this.node.warn(`The given "scene"-property "${message.scene}" (${typeof message.scene}) is not a positive number.`);
            return false;
        }
        return true;
    }
    validateSave(message) {
        if (!this.validateScene(message)) {
            return false;
        }
        if (typeof message.payload !== "object" && !Array.isArray(message.payload)) {
            this.node.warn("The given payload has to be an object or array.");
            return false;
        }
        try {
            message.payload = this.parseUniverseData(message.payload, message.universe);
        }
        catch (e) {
            if (e instanceof Error) {
                this.node.warn(e.message);
            }
            return false;
        }
        return true;
    }
    validatePlay(message) {
        if (!this.validateScene(message)) {
            return false;
        }
        return true;
    }
    validateReset(_) {
        return true;
    }
    handleSave(message) {
        this.scenes[message.scene] = {
            scene: message.scene,
            data: message.payload,
        };
        this.store.save(this.scenes);
    }
    handlePlay(message) {
        const data = this.scenes[message.scene];
        if (!data) {
            this.node.warn(`Cannot play scene no. ${message.scene} since it has not been recorded yet.`);
            return;
        }
        this.playingScene = message.scene;
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
        const out = {
            topic: message.topic ?? `Scene ${message.scene}`,
            scene: message.scene,
            payload: payload,
            universe: universe,
        };
        this.node.send(out);
        this.node.status({
            fill: "green",
            shape: "dot",
            text: message.topic ?? `Scene ${message.scene}`,
        });
    }
    handleReset(message) {
        const resetScene = (scene) => {
            const data = this.scenes[scene];
            if (this.playingScene === scene) {
                this.playingScene = null;
                this.node.status({
                    fill: "green",
                    shape: "ring",
                    text: "Standby",
                });
                if (data) {
                    const universes = Object.keys(data.data);
                    let universe = undefined;
                    let payload;
                    if (universes.length === 1) {
                        universe = parseInt(universes[0], 10);
                        payload = (0, dmx_1.nulledUniverse)();
                    }
                    else {
                        payload = {};
                        universes.forEach((universe) => {
                            payload[parseInt(universe, 10)] = (0, dmx_1.nulledUniverse)();
                        });
                    }
                    const out = {
                        topic: `Scene ${scene}`,
                        scene: scene,
                        payload: payload,
                        universe: universe,
                        reset: true,
                    };
                    this.node.send(out);
                }
            }
            delete this.scenes[scene];
        };
        if (message.scene) {
            resetScene(message.scene);
        }
        else {
            Object.keys(this.scenes).forEach((key) => {
                resetScene(parseInt(key, 10));
            });
        }
        this.store.save(this.scenes);
    }
}
exports.default = (RED) => {
    RED.nodes.registerType("scene-controller", function (config) {
        RED.nodes.createNode(this, config);
        const baseDir = RED.settings.userDir ?? process.cwd();
        new NodeHandler(this, config, new scene_store_1.SceneStore(baseDir, this.id));
    });
};
