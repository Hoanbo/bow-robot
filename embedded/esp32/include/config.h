#pragma once

#include <Arduino.h>

// ============================================================================
// BOW ROBOT V4.0 — ESP32-S3 N16R8 HARDWARE & TELEMETRY CONFIGURATION
// Bản cấu hình phần cứng chuẩn dành cho Robot Mini để bàn:
// - Vi điều khiển: ESP32-S3 (16MB Flash, 8MB Octal PSRAM, 2 nhân 240MHz)
// - Màn hình: OLED 0.96 inch SSD1306 (128x64 I2C) bộ 10 biểu cảm sống động
// - Thu âm: INMP441 Digital Microphone (I2S DMA Double Buffering, 16kHz PCM)
// - Phát âm: MAX98357A Audio DAC Amplifier (I2S Fast Barge-In < 10ms Flush)
// - Bánh xe: Động cơ kép N20 qua mạch cầu H MX1508 (Thuật toán Smooth PWM Easing)
// - Đầu cử động: Servo Pan (quay ngang) & Servo Tilt (ngước lên nhìn Sếp)
// - Cảm biến Pin: Đọc ADC qua cầu phân áp Li-Po 1S (3.2V - 4.2V Telemetry)
// ============================================================================

// ----------------------------------------------------------------------------
// 1. CẤU HÌNH KẾT NỐI WI-FI & BOW-AGENT CENTRAL BRAIN
// ----------------------------------------------------------------------------
#define WIFI_SSID               "YOUR_WIFI_NAME"        // Tên Wi-Fi 2.4GHz nhà bạn
#define WIFI_PASSWORD           "YOUR_WIFI_PASSWORD"    // Mật khẩu Wi-Fi

#define BOW_GATEWAY_HOST        "192.168.1.100"         // IP máy tính chạy bow-agent (xem bằng ipconfig)
#define BOW_GATEWAY_PORT        4078                    // Cổng WebSocket kết nối trực tiếp với bow-agent V4.0
#define BOW_GATEWAY_PATH        "/ws/audio-stream"      // Endpoint WebSocket Audio Stream V4.0
#define BOW_ROBOT_VERSION       "4.0.0"                 // Phiên bản firmware đồng bộ hệ sinh thái V4.0

// ----------------------------------------------------------------------------
// 2. MÀN HÌNH OLED 0.96" SSD1306 (128x64 I2C)
// ----------------------------------------------------------------------------
#define OLED_SDA_PIN            4                       // Chân SDA dữ liệu I2C của OLED (GPIO 4)
#define OLED_SCL_PIN            5                       // Chân SCL xung nhịp I2C của OLED (GPIO 5)
#define OLED_SCREEN_WIDTH       128                     // Chiều rộng màn hình (Pixel)
#define OLED_SCREEN_HEIGHT      64                      // Chiều cao màn hình (Pixel)
#define OLED_I2C_ADDRESS        0x3C                    // Địa chỉ I2C mặc định của SSD1306

// ----------------------------------------------------------------------------
// 3. MICROPHONE KỸ THUẬT SỐ INMP441 (I2S DMA BUFFER KÉP)
// ----------------------------------------------------------------------------
#define I2S_MIC_SCK_PIN         12                      // Chân BCLK / SCK (Bit Clock) của INMP441
#define I2S_MIC_WS_PIN          11                      // Chân LRCL / WS (Word Select) của INMP441
#define I2S_MIC_SD_PIN          10                      // Chân SD / DOUT (Data Out từ mic vào ESP32)
#define I2S_MIC_PORT            I2S_NUM_0               // Bộ I2S phần cứng 0
#define I2S_SAMPLE_RATE         16000                   // Tần số lấy mẫu 16,000 Hz (chuẩn ASR / Speech-to-Text)
#define I2S_MIC_BUFFER_COUNT    4                       // Số lượng DMA Buffer (Buffer kép luân phiên)
#define I2S_MIC_BUFFER_LEN      512                     // Độ dài mỗi DMA Buffer (512 bytes)

// ----------------------------------------------------------------------------
// 4. MẠCH KHUẾCH ĐẠI ÂM THANH DAC MAX98357A (I2S PHÁT TIẾNG & BARGE-IN)
// ----------------------------------------------------------------------------
#define I2S_SPK_BCLK_PIN        15                      // Chân BCLK (Bit Clock) của MAX98357A
#define I2S_SPK_LRC_PIN         16                      // Chân LRC / WS (Left-Right Clock)
#define I2S_SPK_DIN_PIN         17                      // Chân DIN (Dữ liệu âm thanh từ ESP32 sang loa)
#define I2S_SPK_PORT            I2S_NUM_1               // Bộ I2S phần cứng 1
#define I2S_SPK_SAMPLE_RATE     24000                   // Tần số phát âm thanh 24,000 Hz (chuẩn Edge-TTS Neural)
#define I2S_SPK_BUFFER_COUNT    4                       // Số lượng DMA Buffer cho Loa
#define I2S_SPK_BUFFER_LEN      512                     // Độ dài mỗi DMA Buffer

// ----------------------------------------------------------------------------
// 5. ĐIỀU KHIỂN ĐỘNG CƠ BÁNH XE N20 QUA MẠCH CẦU H MX1508 / L9110S
// ----------------------------------------------------------------------------
#define MOTOR_LEFT_IN1          1                       // Bánh trái chiều tiến (GPIO 1)
#define MOTOR_LEFT_IN2          2                       // Bánh trái chiều lùi (GPIO 2)
#define MOTOR_RIGHT_IN1         41                      // Bánh phải chiều tiến (GPIO 41)
#define MOTOR_RIGHT_IN2         42                      // Bánh phải chiều lùi (GPIO 42)
#define MOTOR_DEFAULT_SPEED     200                     // Tốc độ PWM mục tiêu (Dải 0 - 255)
#define MOTOR_RAMP_DURATION_MS  150                     // Thời gian tăng tốc mềm 0 -> Target trong 150ms

// ----------------------------------------------------------------------------
// 6. SERVO ĐIỀU KHIỂN CỬ ĐỘNG ĐẦU (PAN & TILT HEAD GESTURES)
// ----------------------------------------------------------------------------
#define SERVO_TILT_PIN          18                      // Servo gật đầu lên/xuống (Tilt: -45° đến +45°)
#define SERVO_PAN_PIN           19                      // Servo quay đầu trái/phải (Pan: -90° đến +90°)
#define SERVO_TILT_BARGE_IN_DEG 10                      // Ngước đầu lên thêm +10° khi kích hoạt Barge-in

// ----------------------------------------------------------------------------
// 7. GIÁM SÁT ĐIỆN ÁP PIN LI-PO 1S (ADC VOLTAGE MONITOR & TELEMETRY)
// ----------------------------------------------------------------------------
#define BATTERY_ADC_PIN         1                       // Chân ADC đọc điện áp pin qua cầu phân áp
#define BATTERY_MIN_VOLTAGE     3.2f                    // Điện áp pin lúc 0% (V)
#define BATTERY_MAX_VOLTAGE     4.2f                    // Điện áp pin lúc 100% đầy (V)
#define BATTERY_DIVIDER_RATIO   2.0f                    // Tỉ lệ cầu phân áp 1:1 (R1=100k, R2=100k)
#define TELEMETRY_INTERVAL_MS   10000                   // Chu kỳ gửi telemetry định kỳ (10 giây)

// ----------------------------------------------------------------------------
// 8. HẰNG SỐ CHỚP MẮT TỰ NHIÊN (NATURAL BLINK ENGINE)
// ----------------------------------------------------------------------------
#define BLINK_MIN_DELAY_MS      2500                    // Thời gian chờ chớp mắt tối thiểu (2.5 giây)
#define BLINK_MAX_DELAY_MS      6000                    // Thời gian chờ chớp mắt tối đa (6.0 giây)
#define BLINK_DURATION_MS       120                     // Thời gian một lần nhắm mắt (120ms)
