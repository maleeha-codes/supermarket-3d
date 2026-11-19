# SuperMart 3D - Realistic In-Store Supermarket Shopping Demo

A realistic 3D supermarket shopping experience built with Three.js, plain HTML, modern CSS, and JavaScript. Zero external assets required — all textures, packaging labels, and sound effects are generated procedurally in real-time.

---

## 🚀 How to Run

Run this project locally with any simple HTTP server:

```powershell
cd C:\Users\Dell\.gemini\antigravity\scratch\supermarket-3d
python -m http.server 8000
```
Then open your browser and navigate to: **`http://localhost:8000`**

---

## 🎮 Simplified Controls

- 🛒 **Attached Trolley**:
  - The shopping trolley is always attached in front of you (bottom-right of the screen) and follows you automatically as you walk.
  - No need to "grab" or fetch a trolley.
  - When you click any item, it plays a smooth 3D drop animation directly into your trolley basket.

- 🖱️ **Look Around**:
  - **No pointer lock required!** Your mouse cursor stays free and visible.
  - Simply click & hold anywhere on screen, then drag your mouse to smoothly look around in 360°.

- 🚶 **Smooth, Calmer Walking**:
  - Walking speed is tuned to a smooth, relaxed in-store walking pace.
  - **Keyboard**: Use `W`, `A`, `S`, `D` or arrow keys to move.
  - **Mouse Only**: Use the on-screen navigation buttons (▲ ◄ ▼ ►) on the bottom-left to walk without touching your keyboard.

- 🍎 **Picking Products (Up to 3.5m reach)**:
  - Simply hover your mouse cursor over any product on the shelves.
  - The item highlights with a cyan glow and displays its name, category, and ₹ price.
  - A single click picks it up and drops it straight into your attached trolley.

- ❓ **Controls & Help Panel**:
  - A friendly welcome card on startup explains the basic steps.
  - Click the **`?`** button at the top-right anytime to review the controls in simple words.

- 💳 **Billing & 5% GST Checkout**:
  - Walk to the front cash counter (Lane 1) and click the glowing checkout prompt (or press `E`).
  - View your itemized thermal receipt with prices in Indian Rupees (₹), 5% GST breakdown, and total.
  - Confirm payment to trigger celebratory confetti and register chime!

---

## 📂 Project Structure

```text
supermarket-3d/
├── index.html        # Main HTML shell, HUD, D-Pad, Help & Cart modals
├── style.css         # Modern styling, glassmorphic HUD, D-Pad buttons
├── main.js           # Three.js loop, attached viewmodel trolley, drag-look, physics
├── store.js          # 3D supermarket aisles, produce tables, coolers, colliders
├── ui.js             # Cart state, D-Pad setup, Help dialog, receipt generator
├── products.json     # Indian grocery catalog in INR (Fruits, Dairy, Snacks, Drinks, Staples, Household)
└── README.md         # Documentation
```
