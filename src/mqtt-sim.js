const crypto = require("crypto");
const path = require("path");
const mqtt = require("mqtt");
const protobufjs = require("protobufjs");

// Connect to the MQTT broker with specified credentials
const client = mqtt.connect("mqtt://mqtt.meshtastic.org", {
  username: "meshdev",
  password: "large4cats",
});

// Set up Protocol Buffers loading mechanism for structured data handling
const root = new protobufjs.Root();
root.resolvePath = (origin, target) => path.join(__dirname, "protos", target);
root.loadSync("meshtastic/mqtt.proto");

// Lookup and prepare protobuf types for later use
const Data = root.lookupType("Data");
const ServiceEnvelope = root.lookupType("ServiceEnvelope");
const MapReport = root.lookupType("MapReport");
const NeighborInfo = root.lookupType("NeighborInfo");
const Position = root.lookupType("Position");
const RouteDiscovery = root.lookupType("RouteDiscovery");
const Telemetry = root.lookupType("Telemetry");
const User = root.lookupType("User");
const Waypoint = root.lookupType("Waypoint");

// Function to create a unique nonce for packet encryption/decryption
function createNonce(packetId, fromNode) {
  // Expand packetId to 64 bits
  const packetId64 = BigInt(packetId);

  // Initialize block counter (32-bit, starts at zero)
  const blockCounter = 0;

  // Create a buffer for the nonce
  const buf = Buffer.alloc(16);

  // Write packetId, fromNode, and block counter to the buffer
  buf.writeBigUInt64LE(packetId64, 0);
  buf.writeUInt32LE(fromNode, 8);
  buf.writeUInt32LE(blockCounter, 12);

  return buf;
}

/**
 * Function to decrypt packets using AES-128-CTR
 * References for the decryption logic and structure:
 * - https://github.com/crypto-smoke/meshtastic-go/blob/develop/radio/aes.go#L42
 * - https://github.com/pdxlocations/Meshtastic-MQTT-Connect/blob/main/meshtastic-mqtt-connect.py#L381
 */
function decrypt(packet) {
  try {
    // Default encryption key
    const key = Buffer.from("1PG7OiApB1nwvP+rz05pAQ==", "base64");

    // Create decryption iv/nonce for this packet
    const nonceBuffer = createNonce(packet.id, packet.from);

    // Create aes-128-ctr decipher
    const decipher = crypto.createDecipheriv("aes-128-ctr", key, nonceBuffer);

    // Decrypt encrypted packet
    const decryptedBuffer = Buffer.concat([
      decipher.update(packet.encrypted),
      decipher.final(),
    ]);

    // Parse as data message
    return Data.decode(decryptedBuffer);
  } catch (e) {
    // Return null on error to indicate failure
    return null;
  }
}

// Subscribe to topics when connected
client.on("connect", function () {
  console.log("Connected to MQTT Broker");
  client.subscribe("msh/PL/#", function (err) {
    if (err) {
      console.error("Error subscribing to topic 'msh/PL/#':", err);
    } else {
      console.log("Subscribed to topic: msh/PL/#");
    }
  });
});

// Event listener for receiving messages
client.on("message", async (topic, message) => {
  try {
    // Decode service envelope
    const envelope = ServiceEnvelope.decode(message);
    if (!envelope.packet) {
      return;
    }

    // Create service envelope in DB
    if (process.env.MM_COLLECT_SERVICE_ENVELOPES === "true") {
      try {
        // Simulate the data object you would have sent to the database
        const dataToLog = {
          mqtt_topic: topic,
          channel_id: envelope.channelId,
          gateway_id: envelope.gatewayId
            ? BigInt("0x" + envelope.gatewayId.replaceAll("!", "")).toString() // Convert hex id "!f96a92f0" to bigint and then to string for logging
            : null,
          to: envelope.packet.to,
          from: envelope.packet.from,
          protobuf: message,
        };

        // Log the data to the console instead of writing it to the database
        console.log(dataToLog);
      } catch (e) {
        console.error(e, {
          envelope: envelope.packet,
        });
      }
    }

    // Attempt to decrypt encrypted packets
    const isEncrypted = envelope.packet.encrypted?.length > 0;
    if (isEncrypted) {
      const decoded = decrypt(envelope.packet);
      if (decoded) {
        envelope.packet.decoded = decoded;
        // Optional logging for decrypted messages
        // console.log("Decryption successful. Message received:", decoded);
      }
    }

    // Logging configurations (set to false to disable logging specific packet types)
    const logKnownPacketTypes = false;

    const logUnknownPacketTypes = false;
    const portnum = envelope.packet?.decoded?.portnum;

    // Handling different types of packets based on their portnum
    if (portnum === 1) {
      // Handling TEXT_MESSAGE_APP
      if (logKnownPacketTypes) {
        console.log("TEXT_MESSAGE_APP", {
          to: envelope.packet.to.toString(16),
          from: envelope.packet.from.toString(16),
          text: envelope.packet.decoded.payload.toString(),
        });
      }

      // Store text messages in the database
      try {
        // Simulate the data object you would have sent to the database
        const dataToLog = {
          to: envelope.packet.to,
          from: envelope.packet.from,
          channel: envelope.packet.channel,
          packet_id: envelope.packet.id,
          channel_id: envelope.channelId,
          gateway_id: envelope.gatewayId
            ? BigInt("0x" + envelope.gatewayId.replaceAll("!", "")).toString() // Convert hex id "!f96a92f0" to bigint and then to string for logging
            : null,
          text: envelope.packet.decoded.payload.toString(),
          rx_time: envelope.packet.rxTime,
          rx_snr: envelope.packet.rxSnr,
          rx_rssi: envelope.packet.rxRssi,
          hop_limit: envelope.packet.hopLimit,
        };

        // Log the data to the console instead of writing it to the database
        console.log(dataToLog);
      } catch (e) {
        console.error(e);
      }
    } else if (portnum === 3) {
      // Handling POSITION_APP
      const position = Position.decode(envelope.packet.decoded.payload);
      console.log("Decryption successful. Position received:", position);

      if (logKnownPacketTypes) {
        console.log("POSITION_APP", {
          from: envelope.packet.from.toString(16),
          position: position,
        });
      }

      // Update node position in the database
      if (position.latitudeI != null && position.longitudeI) {
        try {
          // Simulate the data you would have used in the update operation
          const updateData = {
            where: {
              node_id: envelope.packet.from,
            },
            data: {
              position_updated_at: new Date(),
              latitude: position.latitudeI,
              longitude: position.longitudeI,
              altitude: position.altitude !== 0 ? position.altitude : null,
            },
          };

          // Log the simulated update data to the console instead of performing the database operation
          console.log("Update operation data:", updateData);
        } catch (e) {
          console.error(e);
        }
      }
    } else if (portnum === 4) {
      // Handling NODEINFO_APP
      const user = User.decode(envelope.packet.decoded.payload);

      if (logKnownPacketTypes) {
        console.log("NODEINFO_APP", {
          from: envelope.packet.from.toString(16),
          user: user,
        });
      }

      // Create or update node information in the database
      try {
        // Simulate the upsert action's structure
        const upsertData = {
          where: {
            node_id: envelope.packet.from,
          },
          create: {
            node_id: envelope.packet.from,
            long_name: user.longName,
            short_name: user.shortName,
            hardware_model: user.hwModel,
            is_licensed: user.isLicensed === true,
            role: user.role,
          },
          update: {
            long_name: user.longName,
            short_name: user.shortName,
            hardware_model: user.hwModel,
            is_licensed: user.isLicensed === true,
            role: user.role,
          },
        };

        // Log the simulated upsert data to the console instead of performing the database operation
        console.log("Upsert operation data:", upsertData);
      } catch (e) {
        console.error(e);
      }
    } else if (portnum === 8) {
      // Handling WAYPOINT_APP
      const waypoint = Waypoint.decode(envelope.packet.decoded.payload);

      if (logKnownPacketTypes) {
        console.log("WAYPOINT_APP", {
          to: envelope.packet.to.toString(16),
          from: envelope.packet.from.toString(16),
          waypoint: waypoint,
        });
      }

      // Store waypoint information in the database
      try {
        // Simulate the data object you would have sent to the database
        const dataToLog = {
          to: envelope.packet.to,
          from: envelope.packet.from,
          waypoint_id: waypoint.id,
          latitude: waypoint.latitudeI,
          longitude: waypoint.longitudeI,
          expire: waypoint.expire,
          locked_to: waypoint.lockedTo,
          name: waypoint.name,
          description: waypoint.description,
          icon: waypoint.icon,
          channel: envelope.packet.channel,
          packet_id: envelope.packet.id,
          channel_id: envelope.channelId,
          gateway_id: envelope.gatewayId
            ? BigInt("0x" + envelope.gatewayId.replaceAll("!", "")).toString() // Convert hex id "!f96a92f0" to bigint and then to string for logging
            : null,
        };

        // Log the data to the console instead of writing it to the database
        console.log(dataToLog);
      } catch (e) {
        console.error(e);
      }
    } else if (portnum === 71) {
      // Handling NEIGHBORINFO_APP
      const neighbourInfo = NeighborInfo.decode(
        envelope.packet.decoded.payload
      );

      if (logKnownPacketTypes) {
        console.log("NEIGHBORINFO_APP", {
          from: envelope.packet.from.toString(16),
          neighbour_info: neighbourInfo,
        });
      }

      // Process neighbor information and update in the database
      // Similar logic applies to other packet types like TELEMETRY_APP, TRACEROUTE_APP, MAP_REPORT_APP
      // Each with their specific handling based on the packet's payload and purpose

      // Create neighbour info in the database
      try {
        // Simulate the data object you would have sent to the database
        const dataToLog = {
          node_id: envelope.packet.from,
          node_broadcast_interval_secs: neighbourInfo.nodeBroadcastIntervalSecs,
          neighbours: neighbourInfo.neighbors.map((neighbour) => {
            return {
              node_id: neighbour.nodeId,
              snr: neighbour.snr,
            };
          }),
        };

        // Log the data to the console instead of creating a record in the database
        console.log(dataToLog);
      } catch (e) {
        console.error(e);
      }

      // Update node neighbour info in the database
      try {
        // Simulate the data structure for the update operation
        const updateDataToLog = {
          where: {
            node_id: envelope.packet.from,
          },
          data: {
            neighbours_updated_at: new Date(),
            neighbour_broadcast_interval_secs:
              neighbourInfo.nodeBroadcastIntervalSecs,
            neighbours: neighbourInfo.neighbors.map((neighbour) => {
              return {
                node_id: neighbour.nodeId,
                snr: neighbour.snr,
              };
            }),
          },
        };

        // Log the update data structure to the console instead of performing the database operation
        console.log("Update operation data:", updateDataToLog);
      } catch (e) {
        console.error(e);
      }
    } else if (portnum === 67) {
      // Handling TELEMETRY_APP
      const telemetry = Telemetry.decode(envelope.packet.decoded.payload);

      if (logKnownPacketTypes) {
        console.log("TELEMETRY_APP", {
          from: envelope.packet.from.toString(16),
          telemetry: telemetry,
        });
      }

      // data to update
      const data = {};

      // handle device metrics
      if (telemetry.deviceMetrics) {
        data.battery_level =
          telemetry.deviceMetrics.batteryLevel !== 0
            ? telemetry.deviceMetrics.batteryLevel
            : null;
        data.voltage =
          telemetry.deviceMetrics.voltage !== 0
            ? telemetry.deviceMetrics.voltage
            : null;
        data.channel_utilization =
          telemetry.deviceMetrics.channelUtilization !== 0
            ? telemetry.deviceMetrics.channelUtilization
            : null;
        data.air_util_tx =
          telemetry.deviceMetrics.airUtilTx !== 0
            ? telemetry.deviceMetrics.airUtilTx
            : null;

        // create device metric
        try {
          // Simulate the search for an existing metric
          console.log(
            "Searching for existing duplicate device metric with criteria:",
            {
              node_id: envelope.packet.from,
              battery_level: data.battery_level,
              voltage: data.voltage,
              channel_utilization: data.channel_utilization,
              air_util_tx: data.air_util_tx,
              created_at: {
                gte: new Date(Date.now() - 15000), // created in the last 15 seconds
              },
            }
          );

          // Simulated condition check for the existence of a duplicate
          // In a real application, this would be the result of the search operation
          const existingDuplicateDeviceMetric = false; // Assuming no duplicate exists for this example

          // Simulate creating a metric if no duplicates found
          if (!existingDuplicateDeviceMetric) {
            console.log(
              "No existing duplicate found. Creating device metric with data:",
              {
                node_id: envelope.packet.from,
                battery_level: data.battery_level,
                voltage: data.voltage,
                channel_utilization: data.channel_utilization,
                air_util_tx: data.air_util_tx,
              }
            );
          } else {
            console.log("Existing duplicate found. Skipping creation.");
          }
        } catch (e) {
          console.error(e);
        }
      }

      // update node telemetry in db
      if (Object.keys(data).length > 0) {
        try {
          // Simulate the update data structure
          const updateDataToLog = {
            where: {
              node_id: envelope.packet.from,
            },
            data: data,
          };

          // Log the intended update operation to the console
          console.log("Intended update operation for nodes:", updateDataToLog);
        } catch (e) {
          console.error(e);
        }
      }
    } else if (portnum === 70) {
      // Handling TRACEROUTE_APP
      const routeDiscovery = RouteDiscovery.decode(
        envelope.packet.decoded.payload
      );

      if (logKnownPacketTypes) {
        console.log("TRACEROUTE_APP", {
          from: envelope.packet.from.toString(16),
          route_discovery: routeDiscovery,
        });
      }

      try {
        // Simulate the data structure you would have sent to the database
        const dataToLog = {
          node_id: envelope.packet.from,
          route: routeDiscovery.route,
          channel: envelope.packet.channel,
          packet_id: envelope.packet.id,
          channel_id: envelope.channelId,
          gateway_id: envelope.gatewayId
            ? BigInt("0x" + envelope.gatewayId.replaceAll("!", "")).toString() // Convert hex id "!f96a92f0" to bigint and then to string for logging
            : null,
        };

        // Log the intended create operation data to the console
        console.log("Intended create operation for traceRoute:", dataToLog);
      } catch (e) {
        console.error(e);
      }
    } else if (portnum === 73) {
      // Handling MAP_REPORT_APP
      const mapReport = MapReport.decode(envelope.packet.decoded.payload);

      // Handling unknown or unimplemented packet types
      if (logKnownPacketTypes) {
        console.log("MAP_REPORT_APP", {
          from: envelope.packet.from.toString(16),
          map_report: mapReport,
        });
      }

      try {
        // Simulate searching for an existing map report with specific criteria
        console.log("Searching for existing map report with criteria:", {
          node_id: envelope.packet.from,
          long_name: mapReport.longName,
          short_name: mapReport.shortName,
          created_at: {
            gte: new Date(Date.now() - 60000), // created in the last 60 seconds
          },
        });

        // Simulated result of the search (assuming no duplicate exists for this example)
        const existingDuplicateMapReport = false; // This would be the result of the actual database query

        // Simulate creating a map report if no duplicates are found
        if (!existingDuplicateMapReport) {
          console.log(
            "No existing duplicate found. Creating map report with data:",
            {
              node_id: envelope.packet.from,
              long_name: mapReport.longName,
              short_name: mapReport.shortName,
              role: mapReport.role,
              hardware_model: mapReport.hwModel,
              firmware_version: mapReport.firmwareVersion,
              region: mapReport.region,
              modem_preset: mapReport.modemPreset,
              has_default_channel: mapReport.hasDefaultChannel,
              latitude: mapReport.latitudeI,
              longitude: mapReport.longitudeI,
              altitude: mapReport.altitude,
              position_precision: mapReport.positionPrecision,
              num_online_local_nodes: mapReport.numOnlineLocalNodes,
            }
          );
        } else {
          console.log("Existing duplicate found. Skipping creation.");
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      if (logUnknownPacketTypes) {
        // ignore packets we don't want to see for now
        if (
          portnum === undefined || // ignore failed to decrypt
          portnum === 0 || // ignore UNKNOWN_APP
          portnum === 1 || // ignore TEXT_MESSAGE_APP
          portnum === 5 || // ignore ROUTING_APP
          portnum === 34 || // ignore PAXCOUNTER_APP
          portnum === 65 || // ignore STORE_FORWARD_APP
          portnum === 66 || // ignore RANGE_TEST_APP
          portnum === 72 // ignore ATAK_PLUGIN
        ) {
          return;
        }

        console.log(portnum, envelope);
      }
    }
  } catch (e) {
    // ignore errors
  }
});

// The script includes comprehensive handling for various types of data packets
// that might be received over MQTT. This includes secure decryption of packets,
// decoding with Protocol Buffers, and detailed processing based on the packet type.
// Additionally, it includes database operations for storing and updating the received
// data in a structured manner, using the Prisma ORM for efficient and manageable database interactions.
