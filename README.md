# sACN for Node-RED

Simple Implementation
of [sACN](https://artisticlicenceintegration.com/technology-brief/technology-resource/sacn-and-art-net/) (Streaming ACN)
for [Node-RED](https://nodered.org).

## Requirements

- Node-RED `>= 4.0.0`
- Node.js `>= 24.0.0`

This package requires [`sacn`](https://www.npmjs.com/package/sacn) as library to interact by sACN.

## Installation

See the list below for the
npm package names, or [search npm](https://www.npmjs.org/search?q=node-red-sacn).
To install - either use the manage palette option in the editor, or change to your Node-RED user directory.

    cd ~/.node-red
    npm install @mysterycode/node-red-sacn

Copyright MysteryCode and other contributors under [GNU GENERAL PUBLIC LICENSE Version 3](LICENSE).

## Node Usage

### sACN in

This node can be used to read one or multiple universes sent by sACN.

#### Parameters:

| Parameter  | Description                                                                                                                   | Possible Values                                                | Default Value                | Mandatory |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------- | --------- |
| universe   | The universe that is meant to be observed.                                                                                    | `\d+` (`1` to `63999`)                                         | `1`                          | yes       |
| mode       | Defines whether the node returns the values of every read sACN package (passthrough mode), or merged values using HTP or LTP. | `passthrough`, `htp`, `ltp`                                    | `htp`                        | yes       |
| output     | Defines whether the node sends only changed values or the whole universe.                                                      | `full`, `changes`                                              | `full`                       | yes       |
| trigger    | Controls when a message is emitted: only on change, on every received packet, or on change plus a cyclic keepalive re-emit.    | `changes`, `always`, `interval`                                | `changes`                    | yes       |
| interval   | Keepalive interval in milliseconds for the `interval` trigger; the full universe is re-emitted when no change arrives in time. | `\d+`                                                          | `1000`                       | no        |
| clearOnUniverseChange | When the observed universe is switched at runtime, emit a full universe of zeros until real data for the new universe arrives. | `true`, `false`                                     | `false`                      | no        |
| IP-address | IP-Address of the network-interface that should be used for reading from sACN.                                                | `\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\` (_any valid ip-address_) | _empty_                      | no        |
| port       | The network port which should be used for reading sACN.                                                                       | `\d+`                                                          | _empty_ (defaults to `5568`) | no        |

#### Input:

The observed universe can be switched at runtime by sending a message with a `universe` property (`1` to `63999`). The node stops listening on the previous universe and starts listening on the new one; invalid values are ignored and produce a warning.

#### Output for direct-mode:

| Property   | Description                                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `sequence` | sACN packets are given a packet sequence number so that the receiver can keep the sequence of packets from a given sender. (`1` to `255`) |
| `source`   | IP-Address of the sender.                                                                                                                 |
| `priority` | Priority of the sender. (`1` to `200`)                                                                                                    |
| `universe` | Id of the universe the package is addressed to.                                                                                           |
| `payload`  | array containing the dmx values as **percentage** by dmx channel. DMX-Channel `1` starts at key `1`, not `0`. (`Array<number, number>`)   |

#### Output for merging-modes (HTP or LTP):

| Property   | Description                                                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `universe` | Id of the universe the package is addressed to.                                                                                         |
| `payload`  | array containing the dmx values as **percentage** by dmx channel. DMX-Channel `1` starts at key `1`, not `0`. (`Array<number, number>`) |

### sACN out

This node can be used to send one universe using sACN.

#### Parameters:

| Parameter   | Description                                                               | Possible Values                                                | Default Value                | Mandatory |
| ----------- | ------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------- | --------- |
| universe    | The universe that is meant to be observed.                                | `\d+` (`1` to `63999`)                                         | `1`                          | yes       |
| source-name | The name for the sACN-sender that should be displayed within the network. | _any string below 50 characters_                               | `Node-RED`                   | yes       |
| speed       | Defines the frequency for sending sACN-packages                           | `once (0Hz)`, `24Hz`, `27Hz`, `30Hz`, `40Hz`, `44Hz`           | `0Hz`                        | yes       |
| priority    | The priority that should be used for the sACN-sender.                     | `\d+` (`1` to `200`)                                           | `100`                        | yes       |
| IP-address  | IP-Address of the network-interface that should be used for sending sACN. | `\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\` (_any valid ip-address_) | _empty_                      | no        |
| port        | The network port which should be used for reading sACN.                   | `\d+`                                                          | _empty_ (defaults to `5568`) | no        |

#### Expected input:

| Property  | Description                                                                                                                             |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `payload` | array containing the dmx values as **percentage** by dmx channel. DMX-Channel `1` starts at key `1`, not `0`. (`Array<number, number>`) |

### Scene-Controller

This node can be used to record scenes and play them afterwards.

#### Parameters:

This node has no configuration parameters; its behaviour is controlled entirely through the incoming message.

#### Expected input:

| Property   | Description                                                                                                                                                                                                                                                                          | Mandatory                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| `action`   | the action to be executed - `save` to save a preset, `play` to play a saved preset, `reset` to reset                                                                                                                                                                                 | yes                             |
| `scene`    | for action                                                                                                                                                                                                                                                                           | yes, for actions `save`, `play` |
| `universe` | if only one universe is handled, this parameter is mandatory and contains the used universe                                                                                                                                                                                          | only for a single universe      |
| `payload`  | contains the values to record. it might be an array (key 0-511) containing the values for a single universe,<br/>an object (keys 1-512) containing the values for a single universe or<br/>an object (any numeric keys) containing objects (keys 1-512) containing an universe each. | yes, for action `save`          |

#### Output for single universe:

| Property   | Description                                                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `universe` | ID of the universe the package is addressed to when a single universe is used. (`number`)                                               |
| `payload`  | Array containing the dmx values as **percentage** by dmx channel. DMX-Channel `1` starts at key `1`, not `0`. (`Array<number, number>`) |
| `scene`    | The scene that is played (`number`)                                                                                                     |
| `reset`    | Identifies a reset message for action `reset`, otherwise it does not exist. (`true`)                                                    |

#### Output for multiple universes:

| Property   | Description                                                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `universe` | (`undefined`)                                                                                                                     |
| `payload`  | Object containing one object per universe. DMX-Channel `1` starts at key `1`, not `0`. (`object<number, object<number, number>>`) |
| `scene`    | The scene that is played (`number`)                                                                                               |
| `reset`    | Identifies a reset message for action `reset`, otherwise it does not exist. (`true`)                                              |

## Protocol notes and limitations

This package builds on the [`sacn`](https://www.npmjs.com/package/sacn) library and inherits its scope. Be aware of the following when integrating it:

- **No Universe Discovery.** The sender does not emit E1.31 Universe Discovery packets, so receivers relying on discovery will not see this source listed automatically.
- **No synchronization.** E1.31 universe synchronization (synchronized multi-universe updates) is not implemented.
- **No stream termination.** When a sender node is stopped or redeployed it simply closes its socket; it does not send packets with the `Stream_Terminated` flag. Receivers therefore hold the last received values until their own signal-loss timeout (typically ~2.5 s) elapses.
- **DMX values are percentages.** Channel values are expressed as a percentage (`0`–`100`, with up to two decimals) rather than as raw 8-bit values (`0`–`255`).

## Safety and legal notice

This package is network/protocol software for controlling DMX/sACN lighting. It is **not** a certified safety system, and sACN (E1.31) is an unauthenticated, best-effort protocol with no delivery guarantees. Operate it on a dedicated, segmented lighting network. Please observe the following before deploying it:

- **No safety or emergency lighting.** Do not use this package to control safety, escape-route or emergency lighting. Such installations require certified, monitored systems (e.g. DE: DIN VDE 0108-100, DIN EN 1838; AT: TRVB E 102, ÖVE/ÖNORM E 8002; CH: SN EN 1838 and the VKF fire-protection guidelines).
- **No functional machine safety.** sACN/DMX is not a safety bus. Do not use it for the functional safety of machinery, kinetics, hoists or moving stage equipment (cf. Machinery Directive 2006/42/EC / Regulation (EU) 2023/1230, DIN 56950, EN ISO 13849, DGUV V3).
- **Strobe / photosensitivity.** The software can drive arbitrary strobe and flashing effects. Operators are responsible for protecting audiences and staff from photosensitive-epilepsy and glare hazards (e.g. DE: VStättVO, DGUV Information 215-313).
- **Lasers.** If DMX is used to control laser sources, the applicable laser-safety rules apply (e.g. DIN EN 60825; DE: OStrV / TROS Laserstrahlung, incl. an appointed laser safety officer).

This is not legal advice. Responsibility for compliance, CE conformity of the controlled hardware and safe operation rests with the integrator and operator.
