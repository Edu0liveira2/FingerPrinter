# 🧠 Fingerprinter — Browser Fingerprinting & Snapshot Engine

A research-oriented web application designed to demonstrate how modern websites derive **browser fingerprints** using client-side signals.

This project focuses on **real-world behavior**, dynamically cloning external websites and analyzing how fingerprinting techniques execute in different environments.

---

## 🚀 Features

### 🔍 Fingerprinting Engine

* Canvas fingerprint
* WebGL fingerprint (GPU vendor & renderer)
* Audio fingerprint
* Screen & device metrics
* Timezone & locale detection
* Network information (RTT, downlink, etc.)
* Stable device hash generation

---

### 📸 Data Collection (permission-based)

* Optional geolocation
* Optional camera capture (user permission required)
* Structured fingerprint payload

---

### 🌐 Dynamic Website Cloning

Clone any external website dynamically:

```bash
POST /api/snapshot
```

Example body:

```json
{
  "url": "https://example.com"
}
```

Access the cloned version:

```bash
/snapshot/<id>
```

---

### 🧬 Snapshot Engine

* Fetches remote HTML
* Rewrites internal links
* Injects fingerprint scripts
* Serves a local replica of the target page

---

## 📡 API Endpoints

### Create Snapshot

```bash
POST /api/snapshot
```

---

### Collect Data

```bash
POST /api/collect
```

Payload example:

```json
{
  "deviceHash": "...",
  "canvasFingerprint": "...",
  "webglFingerprint": "...",
  "audioFingerprint": "...",
  "geolocation": {...},
  "cameraImage": "base64..."
}
```

---

## 🧠 Overlay Interaction Flow

The system injects an overlay into the cloned page to trigger interaction.

### Flow:

1. Page loads normally (cloned version)
2. Overlay appears on top of the page
3. User clicks "Continue"
4. Browser permission prompts are triggered:

   * Geolocation
   * Camera (optional)
5. Fingerprint is generated and sent to backend

---

## 📷 Camera Behavior

* Uses `getUserMedia`
* Permission required (browser-controlled)
* Captures **one frame only**
* Stream is stopped immediately
* If denied:

  * No crash
  * `cameraImage = null`

---

## 📍 Geolocation Behavior

* Uses `navigator.geolocation`
* Permission-based
* Returns coordinates + accuracy
* Safe fallback if denied

---

## 🧱 Tech Stack

* **Backend:** Flask
* **Frontend:** Vanilla JavaScript
* **Parsing:** BeautifulSoup
* **Networking:** Requests

---

## 📦 Installation

```bash
git clone https://github.com/YOUR_USER/fingerprinter.git
cd fingerprinter

python -m venv venv
source venv/bin/activate  # linux/mac
venv\Scripts\activate     # windows

pip install -r requirements.txt
```

---

## ▶️ Running the Project

```bash
python server.py
```

Access locally:

```bash
http://localhost:8080
```

---

## 🌍 Public Exposure with Ngrok

After the server is running, expose it:

```bash
ngrok http 8080
```

Example output:

```bash
https://abc123.ngrok.io
```

Use snapshot URLs:

```bash
https://abc123.ngrok.io/snapshot/<id>
```

---

## 🧠 How It Works

1. Target URL is received
2. Server fetches the page
3. HTML is modified (script injection)
4. Snapshot is stored locally
5. User accesses `/snapshot/<id>`
6. Overlay triggers fingerprint collection
7. Data is sent to backend

---

## 📁 Project Structure

```bash
fingerprinter/
│
├── server.py
├── requirements.txt
│
├── static/
│   ├── fingerprint.js
│   └── overlay.js
│
├── snapshots/
└── captures/
```

---

## ⚠️ Disclaimer

This project is intended **strictly for educational and research purposes**.

* Demonstrates browser fingerprinting techniques
* Relies on browser permission systems
* Should not be used for unauthorized tracking

---

## 🧠 What You Can Learn

* Real-world fingerprinting behavior
* Browser permission mechanics
* Differences across devices and browsers
* How script injection works in cloned pages
* Privacy implications of modern web tracking

---

## 📌 Future Improvements

* Full asset rewriting (CSS/JS)
* Anti-bot detection simulation
* Multi-session tracking
* Advanced analytics dashboard

---

## 🤝 Contributing

Feel free to open issues or submit pull requests.

---

## 📜 License

MIT License
