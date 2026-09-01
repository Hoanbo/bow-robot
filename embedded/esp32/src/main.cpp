/**
 * BOW ROBOT ESP32 FIRMWARE V3.3
 * Physical Robot Hardware Gateway: Animated Eyes (SSD1306), 2-Axis Pan/Tilt Servos,
 * I2S INMP441 Microphone Stream, and I2S MAX98357A Audio Speaker.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ESP32Servo.h>
#include "driver/i2s.h"
#include "config.h"

// Hardware Singletons
Adafruit_SSD1306 display(OLED_SCREEN_WIDTH, OLED_SCREEN_HEIGHT, &Wire, -1);
WebSocketsClient webSocket;
Servo panServo;
Servo tiltServo;

// Robot Expression & Movement State
enum ExpressionType {
    EXP_NEUTRAL,
    EXP_BLINK,
    EXP_HAPPY,
    EXP_THINKING,
    EXP_SURPRISED,
    EXP_SLEEPING,
    EXP_LISTENING,
    EXP_SPEAKING,
    EXP_ERROR
};

ExpressionType currentExpression = EXP_NEUTRAL;
int currentPan = 0;   // -90 to +90 degrees
int currentTilt = 0;  // -45 to +45 degrees
int targetPan = 0;
int targetTilt = 0;
bool isBlinking = false;
unsigned long blinkStartTime = 0;
unsigned long nextBlinkTime = 0;
float thinkAngle = 0.0;

// Task Handles
TaskHandle_t displayTaskHandle = NULL;
TaskHandle_t servoTaskHandle = NULL;

// Prototypes
void setupWiFi();
void setupOLED();
void setupServos();
void setupI2SMic();
void setupI2SSpeaker();
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length);
void drawEyes();

// FreeRTOS Task: OLED Animated Eyes Renderer (60 FPS)
void taskDisplayAnimation(void * parameter) {
    for (;;) {
        drawEyes();
        vTaskDelay(pdMS_TO_TICKS(16)); // ~60fps
    }
}

// FreeRTOS Task: Smooth Servo Head Motion
void taskServoMotion(void * parameter) {
    for (;;) {
        // Smooth easing towards target angle
        if (currentPan < targetPan) currentPan = min(currentPan + 2, targetPan);
        else if (currentPan > targetPan) currentPan = max(currentPan - 2, targetPan);

        if (currentTilt < targetTilt) currentTilt = min(currentTilt + 2, targetTilt);
        else if (currentTilt > targetTilt) currentTilt = max(currentTilt - 2, targetTilt);

        // Map -90..90 to 0..180 for standard servos
        panServo.write(map(currentPan, -90, 90, 0, 180));
        tiltServo.write(map(currentTilt, -45, 45, 45, 135));

        vTaskDelay(pdMS_TO_TICKS(20)); // 50Hz update
    }
}

void setup() {
    Serial.begin(115200);
    Serial.println("\n[BOW-ROBOT-ESP32] Initializing V3.3 Hardware Engine...");

    setupOLED();
    setupServos();
    setupI2SMic();
    setupI2SSpeaker();
    setupWiFi();

    // Create FreeRTOS Background Animation & Motion Tasks
    xTaskCreatePinnedToCore(taskDisplayAnimation, "DisplayTask", 4096, NULL, 2, &displayTaskHandle, 1);
    xTaskCreatePinnedToCore(taskServoMotion, "ServoTask", 2048, NULL, 1, &servoTaskHandle, 1);

    // Setup WebSocket Gateway Client
    webSocket.begin(BOW_GATEWAY_HOST, BOW_GATEWAY_PORT, BOW_GATEWAY_PATH);
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(3000);

    nextBlinkTime = millis() + random(BLINK_MIN_DELAY_MS, BLINK_MAX_DELAY_MS);
    Serial.println("[BOW-ROBOT-ESP32] Hardware ready. Entering main loop.");
}

void loop() {
    webSocket.loop();
    vTaskDelay(pdMS_TO_TICKS(5));
}

void setupWiFi() {
    Serial.printf("[WIFI] Connecting to SSID: %s\n", WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\n[WIFI] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
    } else {
        Serial.println("\n[WIFI] Warning: WiFi not connected yet, will retry in background.");
    }
}

void setupOLED() {
    Wire.begin(OLED_SDA_PIN, OLED_SCL_PIN);
    if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDRESS)) {
        Serial.println("[OLED] Warning: SSD1306 allocation failed");
        return;
    }
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(20, 28);
    display.println("BOW ROBOT V3.3");
    display.display();
    delay(500);
}

void setupServos() {
    panServo.attach(SERVO_PAN_PIN);
    tiltServo.attach(SERVO_TILT_PIN);
    panServo.write(90);  // Center (0 deg)
    tiltServo.write(90); // Center (0 deg)
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

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
    switch (type) {
        case WStype_DISCONNECTED:
            Serial.println("[WS] Disconnected from BOW Gateway");
            break;
        case WStype_CONNECTED:
            Serial.println("[WS] Connected to BOW Gateway!");
            break;
        case WStype_TEXT: {
            StaticJsonDocument<1024> doc;
            DeserializationError error = deserializeJson(doc, payload, length);
            if (error) {
                Serial.printf("[WS] JSON parse error: %s\n", error.c_str());
                return;
            }

            const char* cmdType = doc["type"] | "";
            if (strcmp(cmdType, "set_expression") == 0) {
                const char* exp = doc["parameters"]["expression"] | "neutral";
                if (strcmp(exp, "happy") == 0) currentExpression = EXP_HAPPY;
                else if (strcmp(exp, "thinking") == 0) currentExpression = EXP_THINKING;
                else if (strcmp(exp, "surprised") == 0) currentExpression = EXP_SURPRISED;
                else if (strcmp(exp, "sleeping") == 0) currentExpression = EXP_SLEEPING;
                else if (strcmp(exp, "listening") == 0) currentExpression = EXP_LISTENING;
                else if (strcmp(exp, "speaking") == 0) currentExpression = EXP_SPEAKING;
                else currentExpression = EXP_NEUTRAL;
            } else if (strcmp(cmdType, "move_head") == 0) {
                targetPan = constrain(doc["parameters"]["pan"] | 0, -90, 90);
                targetTilt = constrain(doc["parameters"]["tilt"] | 0, -45, 45);
            }
            break;
        }
        default:
            break;
    }
}

void drawEyes() {
    display.clearDisplay();

    unsigned long now = millis();

    // Natural Blinking
    if (!isBlinking && now >= nextBlinkTime && currentExpression != EXP_SLEEPING) {
        isBlinking = true;
        blinkStartTime = now;
    }

    float blinkRatio = 0.0;
    if (isBlinking) {
        unsigned long elapsed = now - blinkStartTime;
        if (elapsed >= BLINK_DURATION_MS) {
            isBlinking = false;
            nextBlinkTime = now + random(BLINK_MIN_DELAY_MS, BLINK_MAX_DELAY_MS);
        } else {
            float progress = (float)elapsed / BLINK_DURATION_MS;
            blinkRatio = progress <= 0.5 ? progress * 2.0 : (1.0 - progress) * 2.0;
        }
    }

    thinkAngle += 0.05;

    // Pan & Tilt offsets
    int panOffset = (currentPan * 10) / 90;
    int tiltOffset = (currentTilt * 6) / 45;

    int leftCenterX = 38 + panOffset;
    int leftCenterY = 32 + tiltOffset;
    int rightCenterX = 90 + panOffset;
    int rightCenterY = 32 + tiltOffset;

    int eyeWidth = 28;
    int eyeHeight = 34;

    if (blinkRatio > 0.0) {
        eyeHeight = max(4, (int)(eyeHeight * (1.0 - blinkRatio)));
    }

    if (currentExpression == EXP_HAPPY) {
        // Happy crescent eyes
        display.fillCircle(leftCenterX, leftCenterY, eyeWidth / 2, SSD1306_WHITE);
        display.fillCircle(leftCenterX, leftCenterY + 4, eyeWidth / 2, SSD1306_BLACK);

        display.fillCircle(rightCenterX, rightCenterY, eyeWidth / 2, SSD1306_WHITE);
        display.fillCircle(rightCenterX, rightCenterY + 4, eyeWidth / 2, SSD1306_BLACK);
    } else if (currentExpression == EXP_SLEEPING) {
        // Sleeping horizontal lines
        display.fillRoundRect(leftCenterX - eyeWidth / 2, leftCenterY - 2, eyeWidth, 5, 2, SSD1306_WHITE);
        display.fillRoundRect(rightCenterX - eyeWidth / 2, rightCenterY - 2, eyeWidth, 5, 2, SSD1306_WHITE);
    } else if (currentExpression == EXP_SURPRISED) {
        // Big round surprised eyes
        display.fillCircle(leftCenterX, leftCenterY, 18, SSD1306_WHITE);
        display.fillCircle(rightCenterX, rightCenterY, 18, SSD1306_WHITE);
    } else if (currentExpression == EXP_THINKING) {
        // Thinking eyes with rolling pupil
        display.fillRoundRect(leftCenterX - eyeWidth / 2, leftCenterY - 12, eyeWidth, 24, 6, SSD1306_WHITE);
        display.fillRoundRect(rightCenterX - eyeWidth / 2, rightCenterY - 12, eyeWidth, 24, 6, SSD1306_WHITE);
        int pupilX = (int)(cos(thinkAngle) * 4);
        display.fillCircle(leftCenterX + pupilX, leftCenterY - 3, 4, SSD1306_BLACK);
        display.fillCircle(rightCenterX + pupilX, rightCenterY - 3, 4, SSD1306_BLACK);
    } else {
        // Neutral / Speaking / Listening rounded pill eyes
        int radius = min(eyeWidth, eyeHeight) / 2;
        display.fillRoundRect(leftCenterX - eyeWidth / 2, leftCenterY - eyeHeight / 2, eyeWidth, eyeHeight, radius, SSD1306_WHITE);
        display.fillRoundRect(rightCenterX - eyeWidth / 2, rightCenterY - eyeHeight / 2, eyeWidth, eyeHeight, radius, SSD1306_WHITE);
    }

    display.display();
}
