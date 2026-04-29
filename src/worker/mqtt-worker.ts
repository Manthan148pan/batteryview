
import * as mqtt from 'mqtt';
import * as dotenv from 'dotenv';
import path from 'path';
import { prisma } from '../lib/prisma';
import { decodeBMSHex } from '../lib/bms-decoder';
import { detectFaults } from '../lib/fault-detector';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://broker.hivemq.com';
const TOPIC_FILTER = 'telemetry/batteries/#';

console.log('🚀 Starting MQTT Ingestion Worker...');
console.log(`📡 Connecting to Broker: ${MQTT_BROKER}`);

const client = mqtt.connect(MQTT_BROKER);

client.on('connect', () => {
  console.log('✅ Connected to MQTT Broker');
  client.subscribe(TOPIC_FILTER, (err) => {
    if (!err) {
      console.log(`📝 Subscribed to ${TOPIC_FILTER}`);
    } else {
      console.error('❌ Failed to subscribe:', err);
    }
  });
});

client.on('message', async (topic, message) => {
  try {
    const rawPayload = message.toString();
    console.log(`\n📥 Received on [${topic}]:`, rawPayload);

    const data = JSON.parse(rawPayload);
    const { hex_data, gateway, gateway_location } = data;

    // Extract Battery MAC from topic (telemetry/batteries/MAC-AD-DR-SS)
    const topicParts = topic.split('/');
    const batteryMac = topicParts[topicParts.length - 1].replace(/-/g, ':'); // Convert back to standard MAC

    if (!hex_data || !batteryMac) {
      console.warn('⚠️ Missing hex_data or battery MAC. Skipping...');
      return;
    }

    // 1. Decode BMS Hex
    const decoded = decodeBMSHex(hex_data);
    if (!decoded) {
      console.warn('❌ Failed to decode BMS hex data.');
      return;
    }

    // 2. Detect Faults
    const faults = detectFaults(decoded);
    const faultAlerts = faults.length > 0 ? JSON.stringify(faults) : null;

    // 3. Ensure Battery exists in DB
    const battery = await prisma.battery.upsert({
      where: { id: batteryMac },
      update: {}, 
      create: {
        id: batteryMac,
        status: 'active',
      },
    });

    // 4. Ensure Gateway exists in DB (if provided)
    let dbGateway = null;
    if (gateway) {
      dbGateway = await prisma.gateway.upsert({
        where: { id: gateway },
        update: { 
          lastSeen: new Date(),
          location: gateway_location || undefined 
        },
        create: {
          id: gateway,
          location: gateway_location || 'Unknown',
        },
      });
    }

    // 5. Calculate Max Temp for History
    const maxTemp = Math.max(...decoded.temps, decoded.mosT1, decoded.mosT2);

    // 6. Save Telemetry to PostgreSQL (Supabase)
    const telemetry = await prisma.telemetry.create({
      data: {
        batteryId: battery.id,
        gatewayId: dbGateway?.id || null,
        hexData: hex_data,
        soc: decoded.soc,
        totalVoltage: decoded.totalVoltage,
        current: decoded.current,
        cycles: decoded.cycles,
        maxTemp: maxTemp,
        location: gateway_location || 'Mobile',
        faultAlerts: faultAlerts,
        capturedAt: new Date(),
      },
    });

    console.log(`✅ Saved history for Battery [${batteryMac}] at [${gateway_location || 'Mobile'}] (ID: ${telemetry.id})`);
    
  } catch (err) {
    console.error('🔥 Worker Error processing message:', err);
  }
});

client.on('error', (err) => {
  console.error('❌ MQTT Client Error:', err);
});
