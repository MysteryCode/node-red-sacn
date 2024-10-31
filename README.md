# sACN for Node-RED

Simple Implementation of [sACN](https://artisticlicenceintegration.com/technology-brief/technology-resource/sacn-and-art-net/) (Streaming ACN) for [Node-RED](https://nodered.org).

## Requirements

Required version of Node-RED: v3.1.6

This package uses [`sacn`](https://www.npmjs.com/package/sacn) as library to interact by sACN.

## Installation

See the list below for the
npm package names, or [search npm](https://www.npmjs.org/search?q=node-red-sacn).
To install - either use the manage palette option in the editor, or change to your Node-RED user directory.

    cd ~/.node-red
    npm install @mysterycode/node-red-sacn

Copyright MysteryCode and other contributors under [GNU GENERAL PUBLIC LICENSE Version 3](LICENSE).

## Node Usage

### sACN in

This node can be used to read one or multiple universes send by sACN.

#### Parameters:

| Paremeter  | Description                                                                                                              | Possible Values                                                | Default Value |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | ------------- |
| ip-address | IP-Address of the network-interface that should be used for reading from sACN.                                           | `\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\` (_any valid ip-address_) | _empty_       |
| mode       | Defines whether the node returns the values of every read sACN package (direct mode), or merged values using HTP or LTP. | `direct`, `htp`, `ltp`                                         | `htp`         |
| universe   | The universe that is meant to be observed.                                                                               | `\d+` (`1` to `63999`)                                         | `1`           |
| port       | The network port which should be used for reading sACN.                                                                  | `\d+`                                                          | `5568`        |

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

| Paremeter  | Description                                                               | Possible Values                                                | Default Value |
| ---------- | ------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------- |
| ip-address | IP-Address of the network-interface that should be used for sending sACN. | `\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\` (_any valid ip-address_) | _empty_       |
| speed      | Defines the frequency for sending sACN-packages                           | `once (0Hz)`, `24Hz`, `27Hz`, `30Hz`, `40Hz`, `44Hz`           | `0Hz`         |
| universe   | The universe that is meant to be observed.                                | `\d+` (`1` to `63999`)                                         | `1`           |
| port       | The network port which should be used for reading sACN.                   | `\d+`                                                          | `5568`        |
| priority   | The priority that should be used for the sACN-sender.                     | `\d+` (`1` to `200`)                                           | `100`         |
| priority   | The name for the sACN-sender that should be displayed within the network. | _any string below 50 characters_                               | `Node-RED`    |

#### Expected input:

| Property  | Description                                                                                                                             |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `payload` | array containing the dmx values as **percentage** by dmx channel. DMX-Channel `1` starts at key `1`, not `0`. (`Array<number, number>`) |
