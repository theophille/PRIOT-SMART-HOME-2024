import paho.mqtt.client as mqtt
from flask import Flask, Response, request
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
from datetime import datetime, timezone
from dotenv import load_dotenv
import requests
import os

load_dotenv()

BROKER = os.getenv('BROKER')
PORT = int(os.getenv('PORT'))
MQTT_USERNAME = os.getenv('MQTT_USERNAME')
MQTT_PASSWORD = os.getenv('MQTT_PASSWORD')
CLIENT_ID = "server-smart-home"
CA_CERT = "cert.pem"
LED_TOPIC = "smart-home/led"
DHT22_TOPIC = "smart-home/dht-data"
FAN_STATE_TOPIC = "smart-home/fan/state"
FAN_MODE_TOPIC = "smart-home/fan/mode"
INIT_TOPIC = "smart-home/init"
GAS_TOPIC = "smart-home/gas"

app = Flask(__name__)
CORS(app)
client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1, CLIENT_ID)
led_status = 0

cred = credentials.Certificate('../serviceAccountKey.json')
firebase_admin.initialize_app(cred)
db = firestore.client()
temp_doc = db.collection('sensor').document('temperature')
humid_doc = db.collection('sensor').document('humidity')
rtstate_doc = db.collection('rtstate').document('actuators')

bot_token = os.getenv('BOT_TOKEN')
chat_id = os.getenv('CHAT_ID')


def send_telegram_message(message):
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {"chat_id": chat_id, "text": message}
    try:
        response = requests.post(url, json=payload)
        response.close()
        print("Message sent successfully!")
    except Exception as e:
        print(f"Error sending message: {e}")


def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("Connected successfully!")
        client.subscribe(FAN_STATE_TOPIC)
        client.subscribe(DHT22_TOPIC)
        client.subscribe(GAS_TOPIC)
        client.subscribe(INIT_TOPIC)
    else:
        print(f"Failed to connect, return code {rc}")


def updateActuators(field, value):
    doc = rtstate_doc.get()
    data = doc.to_dict()
    data[field] = value
    rtstate_doc.set(data)

def updateActuatorsAll(data):
    doc = rtstate_doc.get()
    rtstate_doc.set(data)

def updateColors(red, green, blue):
    doc = rtstate_doc.get()
    data = doc.to_dict()
    data['red'] = red
    data['green'] = green
    data['blue'] = blue
    rtstate_doc.set(data)


def on_message(client, userdata, msg):
    payload = msg.payload.decode()
    print(f"Message received on topic {msg.topic}: {msg.payload.decode()}")

    if msg.topic == DHT22_TOPIC:
        payload = payload.split()
        humid = float(payload[0])
        temp = float(payload[1])
        try:
            doc = temp_doc.get()
            readings = doc.to_dict().get('readings', []) if doc.exists else []
            new_reading = {
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'value': temp,
            }
            readings.append(new_reading)
            if len(readings) > 10:
                readings = readings[-10:]
            temp_doc.set({'readings': readings})

            doc = humid_doc.get()
            readings = doc.to_dict().get('readings', []) if doc.exists else []
            new_reading = {
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'value': humid,
            }
            readings.append(new_reading)
            if len(readings) > 10:
                readings = readings[-10:]
            humid_doc.set({'readings': readings})
        except Exception as e:
            print(f"Error updating Firestore: {e}")

    if msg.topic == GAS_TOPIC:
        value = float(payload)
        if value > 2000:
            send_telegram_message("GAS detection!")

    if msg.topic == FAN_STATE_TOPIC:
        updateActuators('fanIsOn', True if payload == "on" else False)

    if msg.topic == INIT_TOPIC:
        payload = payload.split()
        print(payload)
        updateActuatorsAll({
            "red": payload[0],
            "green": payload[1],
            "blue": payload[2],
            "fanMode": False if payload[3] == '0' else True,
            "fanIsOn": False if payload[4] == '0' else True,
            "ledIsOn": False if payload[5] == '0' else True
        })



@app.route("/api/fan/state", methods=['POST'])
def fan_state_control():
    if not request.is_json:
        return Response(status=400)
    
    payload = request.get_json()

    if "state" not in payload:
        return Response(status=400)
    
    client.publish(FAN_STATE_TOPIC, str(payload["state"]).encode(), qos=2)
    updateActuators('fanIsOn', False if payload["state"] == "off" else True)
    return Response(status=200)


@app.route("/api/fan/mode", methods=['POST'])
def fan_mode_control():
    if not request.is_json:
        return Response(status=400)
    
    payload = request.get_json()

    if "mode" not in payload:
        return Response(status=400)
    
    client.publish(FAN_MODE_TOPIC, str(payload["mode"]).encode(), qos=2)
    print(payload["mode"])
    updateActuators('fanMode', False if payload["mode"] == "auto" else True)
    return Response(status=200)


@app.route("/api/light/state", methods=['POST'])
def led_state():
    if not request.is_json:
        return Response(status=400)
    
    payload = request.get_json()

    if "action" not in payload:
        return Response(status=400)

    if "state" not in payload:
        return Response(status=400)

    command = f"switch {payload["state"]}"
    client.publish(LED_TOPIC, str(command).encode(), qos=2)
    updateActuators('ledIsOn', False if payload["state"] == "off" else True)
    return Response(status=200)


@app.route("/api/light/color", methods=['POST'])
def led_color():
    if not request.is_json:
        return Response(status=400)
    
    payload = request.get_json()

    if "action" not in payload:
        return Response(status=400)
    
    if "red" not in payload or "green" not in payload or "blue" not in payload:
        return Response(status=400)
    
    command = f"color {payload["red"]} {payload["green"]} {payload["blue"]}"
    client.publish(LED_TOPIC, str(command).encode(), qos=2)
    updateColors(payload["red"], payload["green"], payload["blue"])
    return Response(status=200)


if __name__ == '__main__':
    client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    client.tls_set(ca_certs=CA_CERT)
    client.on_connect = on_connect
    client.on_message = on_message
    client.connect(BROKER, PORT)
    client.loop_start()
    app.run(host="0.0.0.0", port=5000)
