#include <Arduino.h>
#include <EEPROM.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEClient.h>
#include <BLERemoteCharacteristic.h>
#include <WiFiManager.h>
#include <FirebaseESP32.h>
#include <time.h>
#include <Preferences.h>

// File: firmware.ino
// Description: ESP32 Gateway firmware for connecting Daly BMS via BLE to Firebase.
// This code manages WiFi, connects to Firebase, scans for BMS devices,
// handles commands from the dashboard, and pushes real-time battery data.

// ===== Device & Network Configuration =====
String gatewayLocation = "Not set";
String espUniqueID = "";
String assignedName = "";  // Will be populated from Firebase after linking

// ===== EEPROM & NVS =====
#define EEPROM_ADDR_AUTO_SCAN  60   // Boolean flag for auto-scan state
#define EEPROM_SIZE 64              // For storing the assignedName
Preferences prefs;                  // NVS for storing the linked user ID

// ===== Auto Scan Control =====
bool  autoScanEnabled     = false;
long  autoScanIntervalSec = 600;      // Default: 10 minutes
long  autoScanStartTime   = 0;        // Timestamp from Firebase
unsigned long lastAutoScanMillis = 0; // Tracks time for scheduler
bool  autoScanInitialized = false;    // To sync start time once

// ===== Auto Connect Control =====
long  autoConnectIntervalMs = 10000;  // Default: 10 seconds
unsigned long lastAutoConnectMillis = 0;
int   nextAutoConnectIndex = 0;       // Index in scannedDevices[]
bool  autoConnectActive = false;      // Only true when auto-scan finishes

// ===== User & Firebase Config =====
String linkedUserId = "";
#define FIREBASE_HOST "esp8266-fd435-default-rtdb.asia-southeast1.firebasedatabase.app"
#define FIREBASE_AUTH "bNRiUnXaGdvDQpbxaLWnAJ0hJk6Gu7lr2WeQhOYc"
FirebaseData fbData;
FirebaseConfig config;
FirebaseAuth auth;

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
volatile bool newDataAvailable = false; // Flag set by BLE callback
unsigned long lastSendTime = 0;

// ===== Helper Functions =====

// Converts a byte array to a hexadecimal string
String bytesToHexString(uint8_t* data, size_t len) {
  String hexStr = "";
  for (size_t i = 0; i < len; i++) {
    if (data[i] < 0x10) hexStr += "0";
    hexStr += String(data[i], HEX);
  }
  hexStr.toUpperCase();
  return hexStr;
}

// Gets the current date formatted as YYYY-MM-DD
String getFormattedDate() {
    struct tm timeinfo;
    if (!getLocalTime(&timeinfo)) {
        Serial.println("⚠️ Failed to obtain time for date formatting");
        return "2024-01-01"; // Fallback date
    }
    char dateStr[11];
    strftime(dateStr, sizeof(dateStr), "%Y-%m-%d", &timeinfo);
    return String(dateStr);
}

// ===== BLE Callbacks =====

// This callback is triggered when the BMS sends data
void notifyCallback(BLERemoteCharacteristic* pChar, uint8_t* pData, size_t len, bool isNotify) {
  String hexData = bytesToHexString(pData, len);
  
  // The main data packet from the Daly BMS contains the anchor byte 0x75.
  // We only process this packet to ensure we have the complete data set.
  if (hexData.indexOf("75") != -1) { 
    latestHex = hexData;
    newDataAvailable = true;
    Serial.println("✅ Main BMS data packet received.");
  } else {
    Serial.println("... Received partial BMS data, waiting for main packet.");
  }
}

// This callback is triggered for each BLE device found during a scan
class MyAdvertisedDeviceCallbacks : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice advertisedDevice) {
    String name = advertisedDevice.getName().c_str();
    if (name.startsWith("DL") && deviceCount < 20) {
      scannedDevices[deviceCount] = new BLEAdvertisedDevice(advertisedDevice);
      Serial.printf("[%d] Name: %s | MAC: %s | RSSI: %d\n",
                    deviceCount,
                    advertisedDevice.getName().c_str(),
                    advertisedDevice.getAddress().toString().c_str(),
                    advertisedDevice.getRSSI());
      deviceCount++;
    }
  }
};

// This callback handles BLE connection and disconnection events
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

// Fetches and updates automation settings from Firebase
void updateAutoScanConfigFromFirebase() {
  if (linkedUserId.length() == 0) return; // No user, no config
  String basePath = "/linked_devices/" + espUniqueID + "/bms_control";

  bool prevAutoScanEnabled = autoScanEnabled;
  if (Firebase.getBool(fbData, basePath + "/auto_scan_enabled")) {
    autoScanEnabled = fbData.boolData();
  }

  if (prevAutoScanEnabled != autoScanEnabled) {
    EEPROM.write(EEPROM_ADDR_AUTO_SCAN, autoScanEnabled ? 0x01 : 0x00);
    if (EEPROM.commit()) {
      Serial.printf("💾 Saved auto_scan_enabled to EEPROM: %s\n", autoScanEnabled ? "TRUE" : "FALSE");
    } else {
      Serial.println("❌ EEPROM commit failed for auto_scan_enabled");
    }
    autoScanInitialized = false;
    lastAutoScanMillis  = 0;
  }

  if (Firebase.getInt(fbData, basePath + "/auto_scan_interval")) {
    autoScanIntervalSec = fbData.intData();
  }

  if (Firebase.getInt(fbData, basePath + "/auto_scan_start_time")) {
    autoScanStartTime = fbData.intData();
  }
  
  if (Firebase.getInt(fbData, basePath + "/auto_connect_interval")) {
    int tmpInterval = fbData.intData();
    autoConnectIntervalMs = (tmpInterval > 0) ? (long)tmpInterval * 1000L : 0;
  }
}

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

  String bmsDevicesPath = "/linked_devices/" + espUniqueID + "/bms_devices";
  
  // Mark all previously known devices as unavailable first
  if (Firebase.getJSON(fbData, bmsDevicesPath)) {
    FirebaseJson allDevices = fbData.jsonObject();
    size_t len = allDevices.iteratorBegin();
    for (size_t i = 0; i < len; i++) {
      String macKey = allDevices.valueAt(i).key;
      Firebase.setBool(fbData, bmsDevicesPath + "/" + macKey + "/available", false);
    }
    allDevices.iteratorEnd();
  }

  // Update Firebase with newly found devices
  for (int i = 0; i < deviceCount; i++) {
    String macSafe = scannedDevices[i]->getAddress().toString();
    macSafe.replace(":", "-");
    
    FirebaseJson dev;
    dev.set("device_name", scannedDevices[i]->getName().c_str());
    dev.set("connect", false);
    dev.set("available", true);
    dev.set("hex_data", "");
    Firebase.setJSON(fbData, bmsDevicesPath + "/" + macSafe, dev);
  }
  
  // Reset the scan command flag on the dashboard
  Firebase.setBool(fbData,"/linked_devices/" + espUniqueID + "/bms_control/auto_scan", false);
  
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
        Serial.println("⚠️ UART service FFF0 not found!");
        return false;
      }

      pRemoteRX = uartService->getCharacteristic(BLEUUID("0000FFF1-0000-1000-8000-00805F9B34FB"));
      pRemoteTX = uartService->getCharacteristic(BLEUUID("0000FFF2-0000-1000-8000-00805F9B34FB"));

      if (pRemoteRX && pRemoteRX->canNotify()) {
        pRemoteRX->registerForNotify(notifyCallback);
        Serial.println("📡 Notifications enabled.");
      }

      if (pRemoteTX && pRemoteTX->canWrite()) {
        uint8_t cmdRunInfo[] = {0xD2, 0x03, 0x00, 0x00, 0x00, 0x3E, 0xD7, 0xB9};
        pRemoteTX->writeValue(cmdRunInfo, sizeof(cmdRunInfo), false);
        Serial.println("📤 Sent Run Info Request to BMS.");
      }
      return true;
    }
  }
  Serial.println("⚠️ Device not found in scan list.");
  return false;
}

// ===== Firebase Command Handler (Connect by Flag) =====
void handleFirebaseCommands() {
  if (!wifiConnected) return;

  // Auto scan command
  if (Firebase.getBool(fbData, "/linked_devices/" + espUniqueID + "/bms_control/auto_scan") && fbData.boolData()) {
    Serial.println("🛰 Firebase auto_scan command received.");
    startScan();
  }

  // Connect by flag
  for (int i = 0; i < deviceCount; i++) {
    String macSafe = scannedDevices[i]->getAddress().toString();
    macSafe.replace(":", "-");
    String path = "/linked_devices/" + espUniqueID + "/bms_devices/" + macSafe + "/connect";

    if (Firebase.getBool(fbData, path) && fbData.boolData()) {
      Serial.println("🔗 Firebase command: connect to " + macSafe);
      connectToDeviceByMAC(scannedDevices[i]->getAddress().toString());
      Firebase.setBool(fbData, path, false); // reset flag
      break; 
    }
  }
}

// Pushes the final HEX data to the user's historical log
void pushBmsHistory(const String& deviceId, const String& hexData) {
  if (linkedUserId.length() == 0) {
    Serial.println("⏭️ Skipping history - no linked user ID");
    return;
  }

  String formattedDate = getFormattedDate();
  
  time_t now;
  time(&now);
  long long tsMs = (long long)now * 1000LL;
  String timestamp = String(tsMs);
  
  String historyBasePath = "/users/" + linkedUserId + "/bms_devices/" + deviceId + "/history/" + formattedDate + "/" + timestamp;

  FirebaseJson historyEntry;
  historyEntry.set("hex_data", hexData);
  historyEntry.set("gateway_location", gatewayLocation);

  if(Firebase.setJSON(fbData, historyBasePath, historyEntry)) {
      Serial.println("📝 History saved: " + historyBasePath);
  } else {
      Serial.println("❌ Failed to save history: " + fbData.errorReason());
  }
}

// ===== Setup =====
void setup() {
  Serial.begin(115200);
  Serial.println("\n=== ESP32 Daly BMS Gateway ===");

  EEPROM.begin(EEPROM_SIZE);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  assignedName = "";
  for (int i = 0; i < EEPROM_SIZE; i++) {
    char c = EEPROM.read(i);
    if (c == '\0' || c == 255) break;
    assignedName += c;
  }
  if (assignedName.length() > 0) {
    Serial.println("💾 Loaded name from EEPROM: " + assignedName);
  }

  uint8_t storedAutoScan = EEPROM.read(EEPROM_ADDR_AUTO_SCAN);
  autoScanEnabled = (storedAutoScan == 0x01);
  Serial.printf("🔁 Restored auto_scan_enabled from EEPROM: %s\n", autoScanEnabled ? "TRUE" : "FALSE");

  WiFiManager wm;
  wm.setTimeout(180);
  if (!wm.autoConnect("BMS_Gateway_Config")) {
    Serial.println("⚠️ WiFi connection failed, restarting...");
    ESP.restart();
  }
  wifiConnected = true;
  digitalWrite(LED_PIN, HIGH);
  Serial.println("✅ WiFi connected: " + WiFi.localIP().toString());

  configTime(19800, 0, "pool.ntp.org"); // IST = UTC+5:30 = 19800 seconds
  espUniqueID = String((uint32_t)ESP.getEfuseMac(), HEX);
  espUniqueID.toUpperCase();
  Serial.println("🔐 ESP Unique ID: " + espUniqueID);

  prefs.begin("bms_cfg", false);
  
  // Load saved location from NVS (default to "Not set" if it doesn't exist)
  gatewayLocation = prefs.getString("location", "Not set");
  Serial.println("📂 Loaded location from local storage: " + gatewayLocation);

  linkedUserId = prefs.getString("user_id", "");
  if (linkedUserId.length() > 0) {
    Serial.println("📁 Loaded user_id from NVS: " + linkedUserId);
  }
  
  config.host = FIREBASE_HOST;
  config.signer.tokens.legacy_token = FIREBASE_AUTH;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  BLEDevice::init("");
  pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new MyAdvertisedDeviceCallbacks());
  pBLEScan->setActiveScan(true);
  
  String espPath  = "/linked_devices/" + espUniqueID;

  // Load gateway location from Firebase
  if (Firebase.getString(fbData, espPath + "/location")) {
    String newLocation = fbData.stringData();
    if (newLocation.length() > 0 && newLocation != gatewayLocation) {
      gatewayLocation = newLocation;
      prefs.putString("location", gatewayLocation); // Save to NVS
      Serial.println("💾 Saved new location from Firebase to local storage");
    }
  }
  Serial.println("📍 Gateway location: " + gatewayLocation);

  // Load owner UID and save to NVS if found
  if (Firebase.getString(fbData, espPath + "/owner_uid")) {
    String uidFromFirebase = fbData.stringData();
    if (uidFromFirebase.length() > 0 && uidFromFirebase != linkedUserId) {
        linkedUserId = uidFromFirebase;
        prefs.putString("user_id", linkedUserId);
        Serial.println("👤 New User ID loaded from Firebase: " + linkedUserId);
    }
  }

  // Set initial status in Firebase
  FirebaseJson espJson;
  espJson.set("unique_id", espUniqueID);
  espJson.set("wifi_ip", WiFi.localIP().toString());
  espJson.set("status", "active");
  Firebase.updateNode(fbData, espPath, espJson);

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

  // ---- Periodically refresh settings from Firebase ----
  static unsigned long lastConfigPoll = 0;
  if (millis() - lastConfigPoll >= 5000) {
    lastConfigPoll = millis();

    // Refresh dynamic gateway location
    String locPath = "/linked_devices/" + espUniqueID + "/location";
    if (Firebase.getString(fbData, locPath)) {
      String newLocation = fbData.stringData();
      if (newLocation.length() > 0 && newLocation != gatewayLocation) {
        gatewayLocation = newLocation;
        prefs.putString("location", gatewayLocation);
        Serial.println("📍 Gateway location updated from Dashboard: " + gatewayLocation);
      }
    }

    // Refresh auto-scan config
    updateAutoScanConfigFromFirebase();
  }

  // ---- Auto-scan scheduler ----
  if (autoScanEnabled && autoScanIntervalSec > 0) {
    unsigned long now = millis();
    if (!autoScanInitialized) {
        Serial.println("🚀 First auto-scan after boot/enable");
        startScan();
        lastAutoScanMillis = now;
        autoScanInitialized = true;
    } else if (now - lastAutoScanMillis >= (unsigned long)autoScanIntervalSec * 1000UL) {
        lastAutoScanMillis = now;
        Serial.println("🛰 Auto-scan timer fired, starting scan()");
        startScan();
    }
  }

  // Check for dashboard commands (scan or connect)
  handleFirebaseCommands();

  // ---- Auto-connect to devices sequentially after a scan ----
  if (autoConnectActive && autoConnectIntervalMs > 0 && !connected) {
    if (millis() - lastAutoConnectMillis >= (unsigned long)autoConnectIntervalMs) {
      if (nextAutoConnectIndex < deviceCount) {
        BLEAdvertisedDevice* dev = scannedDevices[nextAutoConnectIndex];
        if (dev != nullptr) {
          String mac = dev->getAddress().toString().c_str();
          Serial.println("🔗 Auto-connect to index " + String(nextAutoConnectIndex) + ", MAC: " + mac);
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
    lastSendTime = millis();

    Serial.println("📡 Received HEX Data: " + latestHex);
    String macSafe = connectedMAC;
    macSafe.replace(":", "-");
    String path = "/linked_devices/" + espUniqueID + "/bms_devices/" + macSafe;

    FirebaseJson json;
    json.set("hex_data", latestHex);
    
    time_t now;
    time(&now);
    long long tsMs = (long long)now * 1000LL;
    json.set("last_seen", tsMs);
    json.set("available", true);
  
    if (Firebase.updateNode(fbData, path, json)) {
      Serial.println("✅ HEX data sent to Firebase!");
      pushBmsHistory(macSafe, latestHex);

      if (pClient) {
        Serial.println("⚡ Auto-disconnecting after successful push...");
        pClient->disconnect();
      }
    } else {
      Serial.printf("❌ Failed to push HEX data: %s\n", fbData.errorReason().c_str());
    }
  }
  delay(10);
}
