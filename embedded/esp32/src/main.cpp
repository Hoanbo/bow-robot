/**
 * ============================================================================
 * BOW ROBOT V3.3 — ESP32-S3 N16R8 AUTONOMOUS FIRMWARE (ARDUINO / ESP-IDF)
 * ============================================================================
 * Hardware Integration:
 * - MCU: ESP32-S3 (16MB Flash, 8MB PSRAM, Dual-Core 240MHz)
 * - Display: 0.96" I2C OLED SSD1306 (128x64) 60 FPS Animated Eyes
 * - Audio Input: I2S INMP441 Digital Microphone
 * - Audio Output: I2S MAX98357A DAC Amplifier
 * - Locomotion: Dual N20 Gear Motors (Differential H-Bridge Drive)
 * - Network: WebSocket Client connecting to BOW Agent (Port 4000)
 * ============================================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "driver/i2s.h"
#include "config.h"

// Hardware Singletons
Adafruit_SSD1306 display(OLED_SCREEN_WIDTH, OLED_SCREEN_HEIGHT, &Wire, -1);
WebSocketsClient webSocket;

// Robot Expression & Locomotion State
enum ExpressionType {
    EXP_NEUTRAL,
    EXP_BLINK,
    EXP_HAPPY,
    EXP_THINKING,
    EXP_LISTENING,
    EXP_SPEAKING,
    EXP_ERROR,
    EXP_SLEEPING
};

enum MoveDirection {
    MOVE_STOP,
    MOVE_FORWARD,
    MOVE_BACKWARD,
    MOVE_LEFT,
    MOVE_RIGHT
};

ExpressionType currentExpression = EXP_NEUTRAL;
bool isBlinking = false;
unsigned long blinkStartTime = 0;
unsigned long nextBlinkTime = 0;
float speakAnimationPhase = 0.0;
unsigned long motorStopTimestamp = 0;

// FreeRTOS Task Handles
TaskHandle_t displayTaskHandle = NULL;
TaskHandle_t audioTaskHandle = NULL;

// Function Prototypes
void setupWiFi();
void setupOLED();
void setupMotors();
void setupI2SMic();
void setupI2SSpeaker();
void setMotors(MoveDirection dir, int speed = MOTOR_DEFAULT_SPEED);
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length);
void drawEyes();

// ============================================================================
// FREERTOS TASK: OLED ANIMATED EYES RENDERER (CORE 1 - 60 FPS)
// ============================================================================
void taskDisplayAnimation(void * parameter) {
    for (;;) {
        // Automatic natural blinking logic
        unsigned long now = millis();
        if (!isBlinking && now >= nextBlinkTime) {
            isBlinking = true;
            blinkStartTime = now;
        }
        if (isBlinking && (now - blinkStartTime >= BLINK_DURATION_MS)) {
            isBlinking = false;
            nextBlinkTime = now + random(BLINK_MIN_DELAY_MS, BLINK_MAX_DELAY_MS);
        }

        drawEyes();
        vTaskDelay(pdMS_TO_TICKS(16)); // ~60 FPS
    }
}

// ============================================================================
// FREERTOS TASK: I2S AUDIO STREAMING (CORE 0)
// ============================================================================
void taskAudioProcessing(void * parameter) {
    const size_t bytesToRead = 512;
    int16_t audioBuffer[256];
    size_t bytesRead = 0;

    for (;;) {
        // Stream mic audio to bow-agent when listening
        if (currentExpression == EXP_LISTENING && webSocket.isConnected()) {
            esp_err_t result = i2s_read(I2S_MIC_PORT, audioBuffer, bytesToRead, &bytesRead, pdMS_TO_TICKS(50));
            if (result == ESP_OK && bytesRead > 0) {
                webSocket.sendBIN((uint8_t*)audioBuffer, bytesRead);
            }
        }
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

// ============================================================================
// MAIN ARDUINO SETUP
// ============================================================================
void setup() {
    Serial.begin(115200);
    Serial.println("\n========================================================");
    Serial.println("🤖 BOW ROBOT ESP32-S3 N16R8 FIRMWARE V3.3 INITIALIZING...");
    Serial.println("========================================================");

    setupOLED();
    setupMotors();
    setupI2SMic();
    setupI2SSpeaker();
    setupWiFi();

    // Create FreeRTOS Background Tasks across Dual Cores
    xTaskCreatePinnedToCore(taskDisplayAnimation, "DisplayTask", 4096, NULL, 2, &displayTaskHandle, 1);
    xTaskCreatePinnedToCore(taskAudioProcessing, "AudioTask", 4096, NULL, 1, &audioTaskHandle, 0);

    // Connect to BOW Agent Central Brain Gateway (Port 4000)
    webSocket.begin(BOW_GATEWAY_HOST, BOW_GATEWAY_PORT, BOW_GATEWAY_PATH);
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(2500);

    nextBlinkTime = millis() + random(BLINK_MIN_DELAY_MS, BLINK_MAX_DELAY_MS);
    Serial.println("✅ Hardware Ready! Waiting for BOW Agent Handshake...");
}

// ============================================================================
// MAIN ARDUINO LOOP
// ============================================================================
void loop() {
    webSocket.loop();

    // Auto-stop motors after duration expired
    if (motorStopTimestamp > 0 && millis() >= motorStopTimestamp) {
        setMotors(MOVE_STOP);
        motorStopTimestamp = 0;
    }

    vTaskDelay(pdMS_TO_TICKS(2));
}

// ============================================================================
// HARDWARE INITIALIZATIONS
// ============================================================================
void setupWiFi() {
    Serial.printf("[WIFI] Connecting to SSID: %s\n", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 25) {
        delay(300);
        Serial.print(".");
        attempts++;
    }
    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\n[WIFI] Connected! Robot IP: %s\n", WiFi.localIP().toString().c_str());
    } else {
        Serial.println("\n[WIFI] Wi-Fi connection timed out. Will auto-retry in background.");
    }
}

void setupOLED() {
    Wire.begin(OLED_SDA_PIN, OLED_SCL_PIN);
    if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDRESS)) {
        Serial.println("[OLED] Warning: SSD1306 allocation failed.");
        return;
    }
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(18, 26);
    display.println("BOW ROBOT S3");
    display.setCursor(30, 38);
    display.println("CONNECTING...");
    display.display();
    delay(600);
}

void setupMotors() {
    pinMode(MOTOR_LEFT_IN1, OUTPUT);
    pinMode(MOTOR_LEFT_IN2, OUTPUT);
    pinMode(MOTOR_RIGHT_IN1, OUTPUT);
    pinMode(MOTOR_RIGHT_IN2, OUTPUT);
    setMotors(MOVE_STOP);
}

void setMotors(MoveDirection dir, int speed) {
    switch (dir) {
        case MOVE_FORWARD:
            analogWrite(MOTOR_LEFT_IN1, speed);
            analogWrite(MOTOR_LEFT_IN2, 0);
            analogWrite(MOTOR_RIGHT_IN1, speed);
            analogWrite(MOTOR_RIGHT_IN2, 0);
            break;
        case MOVE_BACKWARD:
            analogWrite(MOTOR_LEFT_IN1, 0);
            analogWrite(MOTOR_LEFT_IN2, speed);
            analogWrite(MOTOR_RIGHT_IN1, 0);
            analogWrite(MOTOR_RIGHT_IN2, speed);
            break;
        case MOVE_LEFT:
            analogWrite(MOTOR_LEFT_IN1, 0);
            analogWrite(MOTOR_LEFT_IN2, speed);
            analogWrite(MOTOR_RIGHT_IN1, speed);
            analogWrite(MOTOR_RIGHT_IN2, 0);
            break;
        case MOVE_RIGHT:
            analogWrite(MOTOR_LEFT_IN1, speed);
            analogWrite(MOTOR_LEFT_IN2, 0);
            analogWrite(MOTOR_RIGHT_IN1, 0);
            analogWrite(MOTOR_RIGHT_IN2, speed);
            break;
        case MOVE_STOP:
        default:
            analogWrite(MOTOR_LEFT_IN1, 0);
            analogWrite(MOTOR_LEFT_IN2, 0);
            analogWrite(MOTOR_RIGHT_IN1, 0);
            analogWrite(MOTOR_RIGHT_IN2, 0);
            break;
    }
}

void setupI2SMic() {
    i2s_config_t i2s_mic_config = {
        .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
        .sample_rate = I2S_SAMPLE_RATE,
        .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
        .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
        .communication_format = I2S_COMM_FORMAT_STAND_I2S,
        .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
        .dma_buf_count = 4,
        .dma_buf_len = 512,
        .use_apll = false,
    };
    i2s_pin_config_t i2s_mic_pins = {
        .bck_io_num = I2S_MIC_SCK_PIN,
        .ws_io_num = I2S_MIC_WS_PIN,
        .data_out_num = I2S_PIN_NO_CHANGE,
        .data_in_num = I2S_MIC_SD_PIN,
    };
    i2s_driver_install(I2S_MIC_PORT, &i2s_mic_config, 0, NULL);
    i2s_set_pin(I2S_MIC_PORT, &i2s_mic_pins);
}

void setupI2SSpeaker() {
    i2s_config_t i2s_spk_config = {
        .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
        .sample_rate = 24000,
        .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
        .channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT,
        .communication_format = I2S_COMM_FORMAT_STAND_I2S,
        .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
        .dma_buf_count = 4,
        .dma_buf_len = 512,
        .use_apll = false,
    };
    i2s_pin_config_t i2s_spk_pins = {
        .bck_io_num = I2S_SPK_BCLK_PIN,
        .ws_io_num = I2S_SPK_LRC_PIN,
        .data_out_num = I2S_SPK_DIN_PIN,
        .data_in_num = I2S_PIN_NO_CHANGE,
    };
    i2s_driver_install(I2S_SPK_PORT, &i2s_spk_config, 0, NULL);
    i2s_set_pin(I2S_SPK_PORT, &i2s_spk_pins);
}

// ============================================================================
// WEBSOCKET COMMUNICATION WITH BOW AGENT
// ============================================================================
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
    switch (type) {
        case WStype_DISCONNECTED:
            Serial.println("[WS] Disconnected from BOW Agent.");
            currentExpression = EXP_ERROR;
            break;
        case WStype_CONNECTED:
            Serial.println("[WS] Handshake SUCCESS! Connected to BOW Agent V3.3");
            currentExpression = EXP_HAPPY;
            // Send client registration
            webSocket.sendTXT("{\"type\":\"client.register\",\"client\":\"bow-robot-esp32s3\",\"version\":\"3.3\"}");
            break;
        case WStype_TEXT: {
            StaticJsonDocument<1024> doc;
            DeserializationError error = deserializeJson(doc, payload, length);
            if (error) return;

            const char* msgType = doc["type"] | "";

            // Handle Emotion Changes
            if (strcmp(msgType, "robot.emotion") == 0 || strcmp(msgType, "set_expression") == 0) {
                const char* exp = doc["emotion"] | doc["parameters"]["expression"] | "neutral";
                if (strcmp(exp, "happy") == 0) currentExpression = EXP_HAPPY;
                else if (strcmp(exp, "thinking") == 0) currentExpression = EXP_THINKING;
                else if (strcmp(exp, "listening") == 0) currentExpression = EXP_LISTENING;
                else if (strcmp(exp, "speaking") == 0) currentExpression = EXP_SPEAKING;
                else if (strcmp(exp, "sleeping") == 0) currentExpression = EXP_SLEEPING;
                else if (strcmp(exp, "error") == 0) currentExpression = EXP_ERROR;
                else currentExpression = EXP_NEUTRAL;
            }

            // Handle Locomotion / Movement Commands
            else if (strcmp(msgType, "robot.move") == 0) {
                const char* dir = doc["direction"] | "stop";
                int durationMs = doc["duration"] | 1000;
                int speed = doc["speed"] | MOTOR_DEFAULT_SPEED;

                if (strcmp(dir, "forward") == 0) setMotors(MOVE_FORWARD, speed);
                else if (strcmp(dir, "backward") == 0) setMotors(MOVE_BACKWARD, speed);
                else if (strcmp(dir, "left") == 0) setMotors(MOVE_LEFT, speed);
                else if (strcmp(dir, "right") == 0) setMotors(MOVE_RIGHT, speed);
                else setMotors(MOVE_STOP);

                if (durationMs > 0) {
                    motorStopTimestamp = millis() + durationMs;
                }
            }
            break;
        }
        case WStype_BIN: {
            // Audio Playback Stream from BOW Agent (TTS Audio chunk)
            size_t bytesWritten = 0;
            i2s_write(I2S_SPK_PORT, payload, length, &bytesWritten, portMAX_DELAY);
            currentExpression = EXP_SPEAKING;
            break;
        }
        default:
            break;
    }
}

// ============================================================================
// OLED 128x64 ANIMATED EYES DRAW ENGINE
// ============================================================================
void drawEyes() {
    display.clearDisplay();

    // Blink state
    if (isBlinking && currentExpression != EXP_SLEEPING) {
        display.fillRoundRect(22, 30, 36, 4, 2, SSD1306_WHITE);
        display.fillRoundRect(70, 30, 36, 4, 2, SSD1306_WHITE);
        display.display();
        return;
    }

    switch (currentExpression) {
        case EXP_HAPPY:
            // Curved laughing eyes (^ _ ^)
            display.fillRoundRect(22, 20, 36, 26, 8, SSD1306_WHITE);
            display.fillCircle(40, 38, 16, SSD1306_BLACK);
            display.fillRoundRect(70, 20, 36, 26, 8, SSD1306_WHITE);
            display.fillCircle(88, 38, 16, SSD1306_BLACK);
            break;

        case EXP_THINKING:
            // Left eye focused, right eye tilted (O _ o)
            display.fillRoundRect(26, 18, 30, 28, 6, SSD1306_WHITE);
            display.fillCircle(41, 32, 7, SSD1306_BLACK);
            display.fillRoundRect(74, 26, 26, 18, 5, SSD1306_WHITE);
            display.fillCircle(87, 35, 4, SSD1306_BLACK);
            break;

        case EXP_LISTENING:
            // Big attentive round eyes (O _ O)
            display.fillCircle(40, 32, 18, SSD1306_WHITE);
            display.fillCircle(40, 32, 7, SSD1306_BLACK);
            display.fillCircle(88, 32, 18, SSD1306_WHITE);
            display.fillCircle(88, 32, 7, SSD1306_BLACK);
            break;

        case EXP_SPEAKING: {
            // Bouncing height animated talking eyes
            speakAnimationPhase += 0.25;
            int bounce = abs((int)(sin(speakAnimationPhase) * 12));
            display.fillRoundRect(24, 18 - bounce/2, 34, 28 + bounce, 8, SSD1306_WHITE);
            display.fillRoundRect(70, 18 - bounce/2, 34, 28 + bounce, 8, SSD1306_WHITE);
            break;
        }

        case EXP_ERROR:
            // Cross X eyes
            display.drawLine(24, 18, 56, 46, SSD1306_WHITE);
            display.drawLine(24, 46, 56, 18, SSD1306_WHITE);
            display.drawLine(72, 18, 104, 46, SSD1306_WHITE);
            display.drawLine(72, 46, 104, 18, SSD1306_WHITE);
            break;

        case EXP_SLEEPING:
            // Sleeping slits (~ _ ~)
            display.fillRoundRect(24, 34, 32, 4, 2, SSD1306_WHITE);
            display.fillRoundRect(72, 34, 32, 4, 2, SSD1306_WHITE);
            break;

        case EXP_NEUTRAL:
        default:
            // Cute rounded rectangle eyes
            display.fillRoundRect(24, 18, 34, 28, 8, SSD1306_WHITE);
            display.fillRoundRect(70, 18, 34, 28, 8, SSD1306_WHITE);
            break;
    }

    display.display();
}
