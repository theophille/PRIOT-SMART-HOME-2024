import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import firebaseConfig from "./firebaseConfig.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    const chart = gen_chart('temperature-graph', 'Temperature (°C)', 'Real-Time Temperature Data');
    getSensorData('temperature', chart);

    const humid_chart = gen_chart('humidity-graph', 'Humidity (%)', 'Real-Time Humidity Data');
    getSensorData('humidity', humid_chart);
});

function gen_chart(canvas, label, title_text) {
    const ctx = document.getElementById(canvas);
    return new Chart(ctx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: label,
            data: [],
            borderColor: 'rgba(229, 57, 75, 1)',
            backgroundColor: 'rgba(229, 57, 75, 0.2)',
            fill: true
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'top'
            },
            title: {
              display: true,
              text: title_text
            }
          },
          scales: {
            x: {
              type: 'time',
              time: {
                unit: 'second',
                tooltipFormat: 'HH:mm:ss'
              },
              title: {
                display: true,
                text: 'Time'
              }
            },
            y: {
              title: {
                display: true,
                text: label
              },
              beginAtZero: true
            }
          }
        }
    });
}

function getSensorData(fbDoc, chart) {
    const docRef = doc(db, 'sensor', fbDoc);
    onSnapshot(docRef, (doc) => {
        if (doc.exists()) {
            const readings = doc.data().readings || [];
            const timestamps = readings.map(reading => new Date(reading.timestamp));
            const data = readings.map(reading => reading.value);

            chart.data.labels = timestamps;
            chart.data.datasets[0].data = data;
            chart.update();
            updateRealTimeValues(data[data.length - 1], fbDoc);
        } else {
            console.log("No data found!");
        }
    });
}

function updateRealTimeValues(data, fbDoc) {
    if (fbDoc == "humidity") {
        const realHumid = document.getElementById("real-humid");
        realHumid.textContent = `${data} %`;
    }

    if (fbDoc == "temperature") {
        const realTemp = document.getElementById("real-temp");
        realTemp.textContent = `${data} °C`;
    }
}
