#include <WiFi.h>
#include <PubSubClient.h>
#include <WiFiClientSecure.h>
#include <Adafruit_Sensor.h>
#include <DHT.h>
#include <DHT_U.h>
#include <string.h>

#include "certificate.h"
#include "config.h"

#define DHT_PIN 4
#define FAN_PIN 2
#define RED_PIN 25
#define GREEN_PIN 26
#define BLUE_PIN 27
#define GAS_PIN 34

#define AUTO false
#define MANUAL true

const char *led_topic = "smart-home/led";
const char *dht_topic = "smart-home/dht-data";
const char *fan_topic = "smart-home/fan/#";
const char *fan_mode_topic = "smart-home/fan/mode";
const char *fan_state_topic = "smart-home/fan/state";
const char *gas_sensor_topic = "smart-home/gas";
const char *init_topic = "smart-home/init";

int led_red = 255;
int led_green = 255;
int led_blue = 0;

unsigned long previousMillis = 0;
const unsigned long interval = 2000;

bool fan_mode = MANUAL;
bool fan_on = false;
bool led_on = false;

WiFiClientSecure wifi_client;
PubSubClient client(wifi_client);
DHT dht(DHT_PIN, DHT22);

void set_color(int r, int g, int b) {
  analogWrite(RED_PIN, r);
  analogWrite(GREEN_PIN, g);
  analogWrite(BLUE_PIN, b);
}

void on_message(char *topic, byte *payload, unsigned int length) {
    Serial.printf("[%s] ", topic);
    for (int i = 0; i < length; i++) {
        Serial.print((char)payload[i]);
    }
    Serial.println();

    if (strcmp(topic, led_topic) == 0) {
        char command[length + 1];
        strcpy(command, (const char *)payload);
        command[length] = '\0';

        char *p = strtok(command, " ");

        if (strcmp(p, "switch") == 0) {
            p = strtok(NULL, " ");

            if (strcmp(p, "on") == 0) {
                set_color(led_red, led_green, led_blue);
                led_on = true;
            }

            if (strcmp(p, "off") == 0) {
                set_color(0, 0, 0);
                led_on = false;
            }
        }

        if (strcmp(p, "color") == 0) {
            led_red = atoi(strtok(NULL, " "));
            led_green = atoi(strtok(NULL, " "));
            led_blue = atoi(strtok(NULL, " "));
            set_color(led_red, led_green, led_blue);
        }
    }

    if (strcmp(topic, fan_state_topic) == 0) {
        char command[length + 1];
        strcpy(command, (const char *)payload);
        command[length] = '\0';

        if (strcmp(command, "on") == 0) {
            analogWrite(FAN_PIN, 255);
            fan_on = true;
        } else {
            analogWrite(FAN_PIN, 0);
            fan_on = false;
        }
    }

    if (strcmp(topic, fan_mode_topic) == 0) {
        char command[length + 1];
        strcpy(command, (const char *)payload);
        command[length] = '\0';
        Serial.print("received on this topic");

        if (strcmp(command, "auto") == 0) {
            fan_mode = AUTO;
        } else {
            fan_mode = MANUAL;
        }
    }
}

void mqtt_connect() {
    while (!client.connected()) {
        char client_id[] = "esp32-smart-home";
        Serial.printf("The client %s connects to the public MQTT broker", client_id);

        if (client.connect(client_id, mqtt_username, mqtt_password)) {
            Serial.println("Connected to the MQTT broker");
            client.subscribe(led_topic);
            client.subscribe(dht_topic);
            client.subscribe(fan_topic);
            client.subscribe(gas_sensor_topic);
            client.subscribe(init_topic);
        } else {
            Serial.print("Failed to connect to the MQTT Broker. Status=");
            Serial.println(client.state());
            delay(2000);
        }
    }
}

void wifi_connect() {
    WiFi.begin(ssid, password);

    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.println("Connecting to WiFi..");
    }

    Serial.println("Connected to the Wi-Fi network");

    wifi_client.setCACert(ca_cert);
}

void read_dht_sensor() {
    float humidity = dht.readHumidity();
    float temperature = dht.readTemperature();
    char dht_data[100];
    sprintf(dht_data, "%.2f %.2f", humidity, temperature);
    client.publish(dht_topic, dht_data);
    
    if (fan_mode == AUTO && !fan_on) {
        if (temperature > 30.0f) {
            fan_on = true;
            analogWrite(FAN_PIN, 255);
            client.publish(fan_state_topic, "on");
        }
    }

    if (fan_mode == AUTO && fan_on) {
        if (temperature < 29.0f) {
            fan_on = false;
            analogWrite(FAN_PIN, 0);
            client.publish(fan_state_topic, "off");
        }
    }
}

void read_gas_sensor() {
    char buffer[50];
    itoa(analogRead(GAS_PIN), buffer, 10);
    client.publish(gas_sensor_topic, buffer);
}

void init_home() {
    char init_data[150];
    sprintf(init_data, "%hhu %hhu %hhu %hhu %hhu %hhu", led_red, led_green, led_blue, (unsigned char)fan_mode, (unsigned char)fan_on, (unsigned char)led_on);
    client.publish(init_topic, init_data);
}

void setup() {
    Serial.begin(115200);
    pinMode(RED_PIN, OUTPUT);
    pinMode(GREEN_PIN, OUTPUT);
    pinMode(BLUE_PIN, OUTPUT);
    pinMode(FAN_PIN, OUTPUT);
    pinMode(GAS_PIN, INPUT);
    wifi_connect();
    client.setServer(mqtt_broker, mqtt_port);
    client.setCallback(on_message);
    dht.begin();
    mqtt_connect();
    client.loop();
    init_home();
}

void loop() {
    unsigned long currentMillis = millis();
    mqtt_connect();
    client.loop();
    if (currentMillis - previousMillis >= interval) {
        previousMillis = currentMillis;
        read_dht_sensor();
        read_gas_sensor();
    }
	delay(10);
}
