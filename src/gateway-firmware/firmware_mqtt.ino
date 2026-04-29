#include <Arduino.h>
#include <EEPROM.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEClient.h>
#include <BLERemoteCharacteristic.h>
#include <WiFiManager.h>
#include <PubSubClient.h>
#include <time.h>
#include <Preferences.h>
#include <ArduinoJson.h> // Make sure to add ArduinoJson library to your PIO/Arduino IDE

// File: firmware_mqtt.ino
// Description: ESP32 Gateway firmware for connecting Daly BMS via BLE.
// Pushes real-time battery data to Cloud via MQTT.

// ===== Device & Network Configuration =====
String gatewayLocation = "Not set";
String espUniqueID = "";
String assignedName = "";

// ===== EEPROM & NVS =====
#define EEPROM_ADDR_AUTO_SCAN  60
#define EEPROM_SIZE 64
Preferences prefs;

// ===== Auto Scan Control =====
bool  autoScanEnabled     = false;
long  autoScanIntervalSec = 600;      // Default: 10 minutes
unsigned long lastAutoScanMillis = 0; 
bool  autoScanInitialized = false;    

// ===== Auto Connect Control =====
long  autoConnectIntervalMs = 10000;  // Default: 10 seconds
unsigned long lastAutoConnectMillis = 0;
int   nextAutoConnectIndex = 0;       
bool  autoConnectActive = false;      

// ===== MQTT Configuration =====
// Change these to your actual MQTT Broker credentials later
const char* mqtt_server = "broker.hivemq.com"; // Example public broker for now
const int   mqtt_port = 1883;
const char* mqtt_user = ""; 
const char* mqtt_pass = "";

WiFiClient espClient;
PubSubClient client(espClient);

// ===== BLE Globals =====
BLEScan* pBLEScan;
BLEAdvertisedDevice* scannedDevices[20];
int deviceCount = 0;
BLEClient* pClient = nullptr;
BLERemoteCharacteristic* pRemoteRX = nullptr;
BLERemoteCharacteristic* pRemoteTX = nullptr;
bool connected = false;
String connectedMAC = "";
int selectedIndex = -1;

// ===== Status & Data Flags =====
#define LED_PIN 2  // Built-in LED
bool wifiConnected = false;
unsigned long ledBlinkTime = 0;
bool ledState = false;
String latestHex = "";
volatile bool newDataAvailable = false; 

// MQTT Topics (populated in setup)
String topic_gateways_status = "";
String topic_commands = "";

// ===== Helper Functions =====
String bytesToHexString(uint8_t* data, size_t len) {
  String hexStr = "";
  for (size_t i = 0; i < len; i++) {
    if (data[i] < 0x10) hexStr += "0";
    hexStr += String(data[i], HEX);
  }
  hexStr.toUpperCase();
  return hexStr;
}

// ===== MQTT Callback (Dashboard Commands) =====
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println("📥 MQTT Msg received [" + String(topic) + "]: " + message);

  // Parse JSON command
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, message);

  if (error) {
    Serial.print(F("deserializeJson() failed: "));
    Serial.println(error.f_str());
    return;
  }

  const char* cmd = doc["cmd"];
  if (cmd == nullptr) return;

  if (strcmp(cmd, "auto_scan") == 0) {
    Serial.println("🛰 MQTT Command: auto_scan");
    startScan();
  } 
  else if (strcmp(cmd, "connect") == 0) {
    const char* mac = doc["mac"];
    if (mac != nullptr) {
      Serial.println("🔗 MQTT Command: connect to " + String(mac));
      connectToDeviceByMAC(String(mac));
    }
  }
  else if (strcmp(cmd, "set_location") == 0) {
    if (doc.containsKey("location")) {
        gatewayLocation = doc["location"].as<String>();
        prefs.putString("location", gatewayLocation);
        Serial.println("📍 Location updated via MQTT: " + gatewayLocation);
    }
  }
  else if (strcmp(cmd, "set_config") == 0) {
    if (doc.containsKey("auto_scan_enabled")) {
        autoScanEnabled = doc["auto_scan_enabled"];
        EEPROM.write(EEPROM_ADDR_AUTO_SCAN, autoScanEnabled ? 0x01 : 0x00);
        EEPROM.commit();
        autoScanInitialized = false;
    }
    if (doc.containsKey("auto_scan_interval")) {
        autoScanIntervalSec = doc["auto_scan_interval"];
    }
    if (doc.containsKey("auto_connect_interval")) {
        autoConnectIntervalMs = doc["auto_connect_interval"];
    }
    Serial.println("⚙️ Config updated via MQTT");
  }
}

// ===== MQTT Reconnection Handler =====
void reconnectMqtt() {
  // Loop until we're reconnected
  while (!client.connected()) {
    Serial.print("Connecting to MQTT Broker...");
    // Attempt to connect
    String clientId = "BMSGateway-";
    clientId += espUniqueID;
    
    // Set Last Will and Testament (LWT)
    // If gateway loses connection, broker will publish "offline" automatically after timeout
    String willPayload = "{\"unique_id\":\"" + espUniqueID + "\",\"status\":\"offline\"}";
    
    if (client.connect(clientId.c_str(), mqtt_user, mqtt_pass, topic_gateways_status.c_str(), 1, true, willPayload.c_str())) {
      Serial.println("✅ connected!");
      client.subscribe(topic_commands.c_str());
      
      // Publish live status
      StaticJsonDocument<256> doc;
      doc["unique_id"] = espUniqueID;
      doc["wifi_ip"] = WiFi.localIP().toString();
      doc["status"] = "active";
      doc["location"] = gatewayLocation;
      
      String statusPayload;
      serializeJson(doc, statusPayload);
      client.publish(topic_gateways_status.c_str(), statusPayload.c_str(), true); // Retained message
      
    } else {
      Serial.print("❌ failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

// ===== BLE Callbacks =====
void notifyCallback(BLERemoteCharacteristic* pChar, uint8_t* pData, size_t len, bool isNotify) {
  String hexData = bytesToHexString(pData, len);
  if (hexData.indexOf("75") != -1) { 
    latestHex = hexData;
    newDataAvailable = true;
    Serial.println("✅ Main BMS data packet received.");
  }
}

class MyAdvertisedDeviceCallbacks : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice advertisedDevice) {
    String name = advertisedDevice.getName().c_str();
    if (name.startsWith("DL") && deviceCount < 20) {
      scannedDevices[deviceCount] = new BLEAdvertisedDevice(advertisedDevice);
      deviceCount++;
    }
  }
};

class MyClientCallback : public BLEClientCallbacks {
  void onConnect(BLEClient* pclient) { 
    Serial.println("✅ Connected to Daly BMS!"); 
  }
  void onDisconnect(BLEClient* pclient) {
    Serial.println("❌ Disconnected from BMS.");
    connected = false;
    selectedIndex = -1;
    connectedMAC = "";
  }
};


// ===== BLE Functions =====
void startScan() {
  for (int i = 0; i < deviceCount; i++) {
    delete scannedDevices[i];
    scannedDevices[i] = nullptr;
  }
  deviceCount = 0;

  Serial.println("🔍 Scanning BLE for 3s...");
  pBLEScan->start(3, false);
  pBLEScan->clearResults(); 
  Serial.printf("Scan finished. %d Daly devices found.\n", deviceCount);

  // Publish scanned devices to MQTT
  if (client.connected() && deviceCount > 0) {
    StaticJsonDocument<1024> doc;
    JsonArray devicesArray = doc.createNestedArray("devices");
    
    for (int i = 0; i < deviceCount; i++) {
      String macSafe = scannedDevices[i]->getAddress().toString();
      macSafe.replace(":", "-");
      
      JsonObject dev = devicesArray.createNestedObject();
      dev["mac"] = macSafe;
      dev["device_name"] = scannedDevices[i]->getName().c_str();
      dev["rssi"] = scannedDevices[i]->getRSSI();
    }
    
    String scanTopic = "telemetry/gateways/" + espUniqueID + "/scan_results";
    String payload;
    serializeJson(doc, payload);
    client.publish(scanTopic.c_str(), payload.c_str());
  }

  if (autoScanEnabled && autoConnectIntervalMs > 0 && deviceCount > 0) {
    nextAutoConnectIndex   = 0;
    lastAutoConnectMillis  = millis();
    autoConnectActive      = true;
    Serial.println("⚙️ Auto-connect sequence armed after scan.");
  } else {
    autoConnectActive = false;
  }
}

bool connectToDeviceByMAC(String mac) {
  for (int i = 0; i < deviceCount; i++) {
    if (scannedDevices[i]->getAddress().toString() == mac) {
      selectedIndex = i;
      connectedMAC = mac;

      if (pClient) {
        pClient->disconnect();
        delete pClient;
      }
      pClient = BLEDevice::createClient();
      pClient->setClientCallbacks(new MyClientCallback());

      Serial.println("🔗 Connecting to device...");
      if (!pClient->connect(scannedDevices[i])) {
        Serial.println("❌ Connection failed");
        return false;
      }

      connected = true;

      Serial.println("✅ Connected! Discovering services...");
      BLERemoteService* uartService = pClient->getService(BLEUUID("0000FFF0-0000-1000-8000-00805F9B34FB"));
      if (!uartService) {
        return false;
      }

      pRemoteRX = uartService->getCharacteristic(BLEUUID("0000FFF1-0000-1000-8000-00805F9B34FB"));
      pRemoteTX = uartService->getCharacteristic(BLEUUID("0000FFF2-0000-1000-8000-00805F9B34FB"));

      if (pRemoteRX && pRemoteRX->canNotify()) {
        pRemoteRX->registerForNotify(notifyCallback);
      }
      if (pRemoteTX && pRemoteTX->canWrite()) {
        uint8_t cmdRunInfo[] = {0xD2, 0x03, 0x00, 0x00, 0x00, 0x3E, 0xD7, 0xB9};
        pRemoteTX->writeValue(cmdRunInfo, sizeof(cmdRunInfo), false);
      }
      return true;
    }
  }
  Serial.println("⚠️ Device not found in scan list.");
  return false;
}

// ===== Pushing battery data via MQTT =====
void publishBatteryData(const String& macSafe, const String& hexData) {
  if (!client.connected()) return;
  
  String topic = "telemetry/batteries/" + macSafe;
  
  StaticJsonDocument<256> doc;
  doc["hex_data"] = hexData;
  doc["gateway"] = espUniqueID;
  doc["gateway_location"] = gatewayLocation;
  // Note: we let the backend worker stamp the real UTC time
  
  String payload;
  serializeJson(doc, payload);
  
  if (client.publish(topic.c_str(), payload.c_str())) {
      Serial.println("📝 BMS data published via MQTT to " + topic);
  } else {
      Serial.println("❌ Failed to publish via MQTT");
  }
}

// ===== Setup =====
void setup() {
  Serial.begin(115200);
  Serial.println("\n=== ESP32 Daly BMS Gateway (MQTT) ===");

  EEPROM.begin(EEPROM_SIZE);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  assignedName = "";
  for (int i = 0; i < EEPROM_SIZE; i++) {
    char c = EEPROM.read(i);
    if (c == '\0' || c == 255) break;
    assignedName += c;
  }

  uint8_t storedAutoScan = EEPROM.read(EEPROM_ADDR_AUTO_SCAN);
  autoScanEnabled = (storedAutoScan == 0x01);

  WiFiManager wm;
  wm.setTimeout(180);
  if (!wm.autoConnect("BMS_Gateway_Config")) {
    Serial.println("⚠️ WiFi connection failed, restarting...");
    ESP.restart();
  }
  wifiConnected = true;
  digitalWrite(LED_PIN, HIGH);
  Serial.println("✅ WiFi connected: " + WiFi.localIP().toString());

  configTime(19800, 0, "pool.ntp.org");

  espUniqueID = String((uint32_t)ESP.getEfuseMac(), HEX);
  espUniqueID.toUpperCase();
  Serial.println("🔐 ESP Unique ID: " + espUniqueID);
  
  topic_gateways_status = "telemetry/gateways/" + espUniqueID + "/status";
  topic_commands        = "commands/gateways/" + espUniqueID;

  prefs.begin("bms_cfg", false);
  gatewayLocation = prefs.getString("location", "Not set");
  
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(mqttCallback);
  client.setBufferSize(1024); // Increase buffer for large JSON (scan results)


  BLEDevice::init("");
  pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new MyAdvertisedDeviceCallbacks());
  pBLEScan->setActiveScan(true);

  Serial.println("🚀 Boot scan: starting initial BLE scan");
  startScan();
}

// ===== Loop =====
void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    wifiConnected = false;
    if (millis() - ledBlinkTime > 500) {
        ledBlinkTime = millis();
        ledState = !ledState;
        digitalWrite(LED_PIN, ledState ? HIGH : LOW);
    }
    return;
  }
  if (!wifiConnected) {
    wifiConnected = true;
    digitalWrite(LED_PIN, HIGH);
  }

  if (!client.connected()) {
    reconnectMqtt();
  }
  client.loop(); // Keeps MQTT connection alive and polls incoming messages

  // ---- Auto-scan scheduler ----
  if (autoScanEnabled && autoScanIntervalSec > 0) {
    unsigned long now = millis();
    if (!autoScanInitialized) {
        startScan();
        lastAutoScanMillis = now;
        autoScanInitialized = true;
    } else if (now - lastAutoScanMillis >= (unsigned long)autoScanIntervalSec * 1000UL) {
        lastAutoScanMillis = now;
        startScan();
    }
  }

  // ---- Auto-connect to devices sequentially after a scan ----
  if (autoConnectActive && autoConnectIntervalMs > 0 && !connected) {
    if (millis() - lastAutoConnectMillis >= (unsigned long)autoConnectIntervalMs) {
      if (nextAutoConnectIndex < deviceCount) {
        BLEAdvertisedDevice* dev = scannedDevices[nextAutoConnectIndex];
        if (dev != nullptr) {
          String mac = dev->getAddress().toString().c_str();
          connectToDeviceByMAC(mac);
        }
        nextAutoConnectIndex++;
        lastAutoConnectMillis = millis();
      } else {
        autoConnectActive = false;
        Serial.println("✅ Auto-connect sequence finished.");
      }
    }
  }

  // ---- Handle New Data Upload ----
  if (newDataAvailable && connected) {
    newDataAvailable = false;

    String macSafe = connectedMAC;
    macSafe.replace(":", "-");
    
    // Publish via MQTT instead of Firebase
    publishBatteryData(macSafe, latestHex);

    if (pClient) {
      Serial.println("⚡ Auto-disconnecting after successful push...");
      pClient->disconnect();
    }
  }
  delay(10);
}
