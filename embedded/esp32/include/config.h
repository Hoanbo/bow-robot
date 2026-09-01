#pragma once

#include <Arduino.h>

// ============================================================================
// WIFI & GATEWAY NETWORK CONFIGURATION
// ============================================================================
#define WIFI_SSID           "BOW_ROBOT_WIFI"
#define WIFI_PASSWORD       "YourWiFiPassword"

#define BOW_GATEWAY_HOST    "192.168.1.100"  // IP address of Xeon PC / BOW Server
#define BOW_GATEWAY_PORT    3000
#define BOW_GATEWAY_PATH    "/ws"

// ============================================================================
// PIN DEFINITIONS (ESP32-WROOM-32)
// ============================================================================

// 1. OLED Display (I2C SSD1306 128x64)
#define OLED_SDA_PIN        21
#define OLED_SCL_PIN        22
#define OLED_SCREEN_WIDTH   128
#define OLED_SCREEN_HEIGHT  64
#define OLED_I2C_ADDRESS    0x3C

// 2. Servo 2-Axis Head Movement (Pan/Tilt)
#define SERVO_PAN_PIN       18  // Horizontal Pan (-90° to +90°)
#define SERVO_TILT_PIN      19  // Vertical Tilt (-45° to +45°)

// 3. I2S Microphone (INMP441)
#define I2S_MIC_SCK_PIN     14  // BCLK (Bit Clock)
#define I2S_MIC_WS_PIN      15  // LRCL (Left/Right Word Select)
#define I2S_MIC_SD_PIN      32  // DIN (Data In)
#define I2S_MIC_PORT        I2S_NUM_0
#define I2S_SAMPLE_RATE     16000

// 4. I2S Speaker Amplifier (MAX98357A)
#define I2S_SPK_BCLK_PIN    26  // Bit Clock
#define I2S_SPK_LRC_PIN     25  // Word Select
#define I2S_SPK_DIN_PIN     33  // Data In
#define I2S_SPK_PORT        I2S_NUM_1

// ============================================================================
// ROBOT BEHAVIOR CONSTANTS
// ============================================================================
#define HEARTBEAT_INTERVAL_MS 5000
#define BLINK_MIN_DELAY_MS    2500
#define BLINK_MAX_DELAY_MS    6000
#define BLINK_DURATION_MS     120
