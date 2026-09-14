# 🏡 Starter Farmhouse 3D — Playable Architectural Walkthrough

An interactive, cross-platform 3D walkthrough game and automated virtual tour of architect **Jay Osborne's Open-Source Starter Farmhouses**, built with **Three.js** and WebGL. Playable directly in any web browser on **PC, Mac, Android, and iOS** with full character controls, physics, stair traversal, and cinematic room tours.

---

## 🎮 Play Online (Web & Mobile)

> **Live Demo:** [https://xxsoloxxleveling-sketch.github.io/3dmodel/](https://xxsoloxxleveling-sketch.github.io/3dmodel/)

* **PC / Mac:** Full keyboard (WASD) and mouse pointer-lock controls.
* **Android / Mobile:** Virtual on-screen touch joystick and 360° swipe camera.

---

## ✨ Features

- **All 4 House Variations Included:**
  - **Caroline:** The classic original starter farmhouse with balanced massing and full-width porch.
  - **Georgia:** Expanded footprint with unique rooflines and porch layouts.
  - **Marilyn:** Open-concept interior living space with front stoop.
  - **Virginia:** Traditional heritage farmhouse layout.
- **Dual Camera Perspectives:**
  - **1st-Person View (`C`):** Realistic eye-level walk (1.65m eye height).
  - **3rd-Person View (`C`):** 3D stylized character avatar with walking animations.
- **Smooth Stair Navigation:** Real-time collision and step-up physics allow walking seamlessly between the downstairs living spaces and the upstairs bedrooms/bath.
- **Automated Guided Tour (`T`):** Catmull-Rom spline camera flight through 10 architectural waypoints with room names and blueprint design notes.
- **2D Floor Plan Minimap Radar (`M`):** Live top-down schematic that auto-switches between **Floor 1 (Downstairs)** and **Floor 2 (Upstairs)** with vision cone radar.
- **Dynamic Day / Sunset / Night Lighting (`L`):** Toggle between daytime sun, golden hour sunset, and nighttime with warm interior point lighting.

---

## 🕹️ Controls

### PC & Desktop
| Action | Key / Input |
| :--- | :--- |
| **Move / Strafe** | `W`, `A`, `S`, `D` or `Arrow Keys` |
| **Look / Turn** | `Mouse Movement` (Click canvas to lock cursor, `ESC` to unlock) |
| **Sprint / Jog** | Hold `Shift` |
| **Jump / Step** | `Spacebar` |
| **Switch View (1P / 3P)** | `C` |
| **Guided Tour** | `T` |
| **Floor Plan Minimap** | `M` |
| **Day / Sunset / Night** | `L` |

### Mobile & Android
- **Left Thumb:** Virtual analog joystick for 360° directional movement.
- **Right Screen:** Swipe to rotate camera and pitch angle.
- **Action Buttons:** `JUMP`, `RUN`, `1P/3P` perspective toggle.

---

## 🚀 Run Locally

Clone the repository and start the lightweight Python HTTP server:

```bash
git clone https://github.com/xxsoloxxleveling-sketch/3dmodel.git
cd 3dmodel
python serve_game.py
```

Then open:
- **Local PC:** `http://localhost:8080`
- **Mobile Device (Same Wi-Fi):** `http://<YOUR_LAN_IP>:8080`

---

## 📂 Project Structure

```text
├── assets/
│   ├── models/            # Converted WebGL-ready 3D models (caroline, georgia, marilyn, virginia .glb)
│   └── textures/          # Extracted PBR textures (clapboards, metal roofing, wood floors, brick)
├── css/
│   └── style.css          # Glassmorphism HUD, minimap, and mobile touch joystick styles
├── js/
│   ├── lib/               # Three.js r128 and GLTFLoader libraries
│   ├── controls.js        # Cross-platform PC and touch input controller
│   ├── player.js          # Player physics, avatar mesh, collision, and stair climbing
│   ├── tour.js            # Automated guided tour with spline interpolation
│   ├── minimap.js         # Real-time 2D floor plan radar HUD
│   └── game.js            # Main Three.js scene, lighting, and render loop
├── tools/
│   └── export_house_model.py # Python script converting SketchUp (.skp) files to optimized .glb
├── serve_game.py          # Local multi-device web server
├── index.html             # Main entry point (compatible with GitHub Pages)
└── README.md
```

---

## 📜 Credits & License

- **Architectural Designs:** Jay Osborne ([FreeFarmhouse.com](https://www.freefarmhouse.com))
- **License:** Creative Commons Attribution-ShareAlike (CC BY-SA 4.0)
