# Meshtastic Map

Meshtastic Map is a visualization tool that displays Meshtastic nodes communicated via MQTT on the `msh/PL` topic. It provides a real-time map of nodes, allowing users to interact with, search, and view detailed information about each node.

![Meshtastic Map Screenshot](./screenshot.png)

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Installation](#installation)
- [Upgrading](#upgrading)
- [How It Works](#how-it-works)
- [Contributing](#contributing)
- [License](#license)
- [Legal](#legal)
- [References](#references)

## Introduction

The Meshtastic Map is an interactive tool designed for the Meshtastic community. It connects to `mqtt.meshtastic.org` to collect and display nodes on a map based on their reported positions. Users can explore node connections, view historical data, and much more.

## Features

### Current Features

- Connection to `mqtt.meshtastic.org` to gather node data.
- Map display of nodes with valid positions.
- Node information preview on map hover.
- Detailed node information and telemetry history on click.
- Direct link sharing to specific nodes.
- Node search by ID and Hex ID.
- Device list showcasing hardware model popularity.
- Mobile-optimized layout.

### Beta Features

- Neighbours map layer with connection lines between nodes based on `NEIGHBORINFO_APP` packets.

### Planned Features

- User registration for manual node addition and management.
- UI for filtering and viewing all `ServiceEnvelope` packets.
- Real-time messaging interface.
- Map filters for neighbour distance, hardware model, frequency, and last update time.

### Ideas for Future Development

- Node "claiming" with custom messages.
- Uploading custom photos and setting node details.

## Installation

To set up Meshtastic Map on your system, follow these steps:

1. Clone the repository:

   ```
   git clone https://github.com/bbbenji/meshmap-map
   cd meshtastic-map
   ```

2. Install NodeJS dependencies:

   ```
   npm install
   ```

3. Create a `.env` file for environment variables:

   ```
   touch .env
   DATABASE_URL="mysql://root@localhost:3306/meshtastic-map?connection_limit=100"
   ```

4. Migrate the database:

   ```
   npx prisma migrate dev
   ```

5. Start the MQTT listener and Express Server:
   ```
   node src/mqtt.js
   node src/index.js
   # Server running at http://127.0.0.1:8080
   ```

## Upgrading

To upgrade your Meshtastic Map installation, execute the following commands:

```
git fetch && git pull
npx prisma migrate dev
```

Restart the `index.js` and `mqtt.js` scripts to apply the updates.

## How It Works

Meshtastic Map uses an MQTT client to connect to `mqtt.meshtastic.org` and listens for various packet types. Packets are decoded and used to update the database, which then feeds data to the map interface. For more technical details, see the [Implementation Notes](#implementation-notes).

## Contributing

If you have suggestions or encounter bugs, please [open an issue](https://github.com/bbbenji/meshmap-map/issues) on GitHub.

## License

This project is licensed under the MIT License.

## Legal

This project is not affiliated with or endorsed by Meshtastic. Trademarks used here belong to their respective owners.

## References

- Meshtastic MQTT Integration: https://meshtastic.org/docs/software/integrations/mqtt/
- Protobufs Documentation: https://buf.build/meshtastic/protobufs/docs/main:meshtastic
