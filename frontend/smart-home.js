import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import firebaseConfig from "./firebaseConfig.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let ledIsOn = false;
let fanIsOn = false;
let fanMode = false;

onInitApp();

const BASE_URL = 'http://172.22.121.250:5000/api';

document.addEventListener('DOMContentLoaded', () => {
    const ledStateBtn = document.getElementById('led-state');
    const colorPicker = document.getElementById('color-picker');
    const fanState = document.getElementById('fan-state');
    const fanModeBtn = document.getElementById('fan-mode');

    ledStateBtn.addEventListener('click', () => {
        const actionData = {
            action: 'switch',
            state: ledIsOn ? 'off' : 'on',
        };

        sendToServer(`${BASE_URL}/light/state`, actionData);
    });

    colorPicker.addEventListener('change', (event) => {
        const rgbColor = hexToRgb(event.target.value);
        const colorData = {
            action: 'color',
            red: rgbColor.r.toString(),
            green: rgbColor.g.toString(),
            blue: rgbColor.b.toString(),
        };
        
        sendToServer(`${BASE_URL}/light/color`, colorData);
    });

    fanState.addEventListener('click', () => {
        const fanSwitchData = {
            state: fanIsOn ? 'off' : 'on'
        };

        sendToServer(`${BASE_URL}/fan/state`, fanSwitchData);
    });
    
    fanModeBtn.addEventListener('click', () => {
        const fanModeData = {
            mode: fanMode ? 'auto' : 'manual'
        };

        sendToServer(`${BASE_URL}/fan/mode`, fanModeData);
    });
});

function onInitApp() {
    const docRef = doc(db, 'rtstate', 'actuators');
    onSnapshot(docRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data() || {};
            ledIsOn = data.ledIsOn;
            fanIsOn = data.fanIsOn;
            fanMode = data.fanMode;
            setAC();
            setLight();
        } else {
            console.log("No data found!");
        }
    });
}

function sendToServer(url, data) {
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        console.log(response)
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

function hexToRgb(hex) {
    hex = hex.replace(/^#/, '');
    const bigint = parseInt(hex, 16);
    return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255,
    };
}

function setAC() {
    const fanModeBtn = document.getElementById("fan-mode");
    const fanStateBtn = document.getElementById("fan-state");

    if (!fanMode) {
        fanStateBtn.classList.add("hidden");
        fanModeBtn.textContent = "Auto";
        fanModeBtn.classList.remove("active-button");
    } else {
        fanStateBtn.classList.remove("hidden");
        fanModeBtn.classList.add("active-button");
        fanModeBtn.textContent = "Manual";
        setFanStateButton();
    }
}

function setFanStateButton() {
    const fanStateBtn = document.getElementById("fan-state");

    if (fanIsOn) {
        fanStateBtn.classList.add("active-button");
        fanStateBtn.textContent = "Running";
    } else {
        fanStateBtn.classList.remove("active-button");
        fanStateBtn.textContent = "Off";
    }
}

function setLight() {
    const ledStateBtn = document.getElementById("led-state");
    const colorPicker = document.getElementById("color-picker");

    if (!ledIsOn) {
        colorPicker.classList.add("hidden");
        ledStateBtn.classList.remove("active-button");
        ledStateBtn.textContent = "Off";
    } else {
        colorPicker.classList.remove("hidden");
        ledStateBtn.classList.add("active-button");
        ledStateBtn.textContent = "On";
    }
}
