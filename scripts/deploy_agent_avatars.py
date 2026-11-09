#!/usr/bin/env python3
"""
Deploy AI Agent Avatar Portraits to Web Public Assets and Database Identities
"""

import glob
import json
import os
import sqlite3
from PIL import Image

BRAIN_DIR = "/home/devine-general/.gemini/antigravity/brain/d728ee14-0e6b-4ca6-960e-619b5f4e85ea"
DEST_DIR = "/home/devine-general/Projects/Sila/apps/web/public/avatars"
DB_PATH = "/home/devine-general/.local/share/neiman/production.db"

os.makedirs(DEST_DIR, exist_ok=True)

jpg_files = glob.glob(os.path.join(BRAIN_DIR, "*_*.jpg"))
deployed_slugs = []

for filepath in jpg_files:
    filename = os.path.basename(filepath)
    # e.g., cto_agent_1793881164783.jpg -> cto_agent
    slug = "_".join(filename.split("_")[:-1])
    if not slug:
        continue

    dest_png = os.path.join(DEST_DIR, f"{slug}.png")
    dest_jpg = os.path.join(DEST_DIR, f"{slug}.jpg")

    with Image.open(filepath) as img:
        img_rgb = img.convert("RGB")
        img_rgb.save(dest_png, "PNG", optimize=True)
        img_rgb.save(dest_jpg, "JPEG", quality=95)

    deployed_slugs.append(slug)
    print(f"[OK] Deployed avatar for {slug} -> {dest_png}")

# Update SQLite Database
if os.path.exists(DB_PATH):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("SELECT id, name, identity FROM agents;")
    agents = cur.fetchall()
    updated_count = 0

    for agent_id, name, identity_json in agents:
        try:
            identity = json.loads(identity_json) if identity_json else {}
        except Exception:
            identity = {}

        slug = identity.get("slug")
        if slug and slug in deployed_slugs:
            identity["avatar_url"] = f"/avatars/{slug}.png"
            new_identity_json = json.dumps(identity)
            cur.execute("UPDATE agents SET identity = ? WHERE id = ?;", (new_identity_json, agent_id))
            updated_count += 1
            print(f"[DB] Updated agent '{name}' (slug: {slug}) with avatar: /avatars/{slug}.png")

    conn.commit()
    conn.close()
    print(f"\n[DONE] Successfully updated {updated_count} agents in {DB_PATH}.")
else:
    print(f"[WARN] Database {DB_PATH} not found.")

