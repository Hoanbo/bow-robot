#pragma once

#include <Arduino.h>

// ============================================================================
// BOW ROBOT V3.3 — ESP32-S3 N16R8 DIY MINI ROBOT HARDWARE CONFIG
// Specially tailored for:
// - ESP32-S3 (16MB Flash, 8MB PSRAM)
// - OLED 0.96" SSD1306 (128x64 I2C)
// - INMP441 Digital Microphone (I2S)
// - MAX98357A Audio DAC Amplifier (I2S)
// - Dual N20 Gear Motors (Mini H-Bridge MX1508 / L9110S)
// ============================================================================

// 1. WIFI & BOW-AGENT CENTRAL BRAIN CONFIGURATION
#define WIFI_SSID           "YOUR_WIFI_NAME"        // Tên Wi-Fi 2.4GHz nhà bạn
#define WIFI_PASSWORD       "YOUR_WIFI_PASSWORD"    // Mật khẩu Wi-Fi

#define BOW_GATEWAY_HOST    "192.168.1.100"         // IP máy tính chạy bow-agent (xem bằng ipconfig)
#define BOW_GATEWAY_PORT    4000                    // Cổng WebSocket của bow-agent
#define BOW_GATEWAY_PATH    "/ws"

// 2. OLED DISPLAY (0.96 inch I2C SSD1306 128x64)
#define OLED_SDA_PIN        4                       // Chân SDA của màn OLED
#define OLED_SCL_PIN        5                       // Chân SCL của màn OLED
#define OLED_SCREEN_WIDTH   128
#define OLED_SCREEN_HEIGHT  64
#define OLED_I2C_ADDRESS    0x3C

// 3. I2S DIGITAL MICROPHONE (INMP441)
#define I2S_MIC_SCK_PIN     12                      // BCLK / SCK (Bit Clock)
#define I2S_MIC_WS_PIN      11                      // LRCL / WS (Word Select)
#define I2S_MIC_SD_PIN      10                      // SD / DOUT (Data In)
#define I2S_MIC_PORT        I2S_NUM_0
#define I2S_SAMPLE_RATE     16000

// 4. I2S DAC AUDIO AMPLIFIER & SPEAKER (MAX98357A)
#define I2S_SPK_BCLK_PIN    15                      // BCLK (Bit Clock)
#define I2S_SPK_LRC_PIN     16                      // LRC / WS (Left-Right Clock)
#define I2S_SPK_DIN_PIN     17                      // DIN (Data In)
#define I2S_SPK_PORT        I2S_NUM_1

// 5. DUAL N20 MOTORS & MINI H-BRIDGE DRIVER (MX1508 / L9110S)
#define MOTOR_LEFT_IN1      1                       // Bánh trái chiều tiến
#define MOTOR_LEFT_IN2      2                       // Bánh trái chiều lùi
#define MOTOR_RIGHT_IN1     41                      // Bánh phải chiều tiến
#define MOTOR_RIGHT_IN2     42                      // Bánh phải chiều lùi
#define MOTOR_DEFAULT_SPEED 200                     // Tốc độ PWM (0 - 255)

// 6. ROBOT TIMINGS & EMOTION CONSTANTS
#define HEARTBEAT_INTERVAL_MS 5000
#define BLINK_MIN_DELAY_MS    2500
#define BLINK_MAX_DELAY_MS    6000
#define BLINK_DURATION_MS     120
