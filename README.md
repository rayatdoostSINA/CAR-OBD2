# 🏎️ MultiGauge OBD-II Telemetry & AI Diagnostic Dashboard
> **English & فارسی** | Professional Web-based Automotive Telemetry, Diagnostics & AI Assistant

---

## 🇬🇧 English

### Overview
A high-performance, real-time automotive telemetry and diagnostic dashboard built with Next.js, TypeScript, and Tailwind CSS. It communicates directly with standard ELM327 / STN adapters via Web Bluetooth, Web Serial, and WiFi, featuring custom digital clusters, multi-module DTC diagnostics, performance testing, and an AI-powered Master Mechanic assistant powered by Gemini.

### ✨ Key Features
- **Real-Time Digital Clusters & HUDs:**
  - *Cyber HUD:* High-contrast digital cluster with shift-light LEDs, real-time boost, coolant temp, speed, and tachometer.
  - *Lufi XS Minimalist Gauge:* Compact multi-metric digital display with responsive needle arcs.
  - *Sport Twin-Dial Cluster & Matrix Grid:* Customizable PID grid and sports gauge.
- **Comprehensive DTC Diagnostics:**
  - Standard SAE J1979 DTC scanning and clearing.
  - Multi-module scanning support (Engine ECU, Transmission TCU, ABS, Airbag SRS, BCM).
  - Offline OBD-II Trouble Code Dictionary with search and actionable repair steps.
- **AI Master Mechanic:**
  - Intelligent fault code analysis and diagnostic guidance powered by Gemini.
- **0-100 & Performance Testing:**
  - High-precision acceleration (0-100 km/h, 400m drag) and braking distance timers.
- **Universal Hardware Support:**
  - Web Bluetooth API (BLE ELM327 adapters).
  - Web Serial API (USB OBD-II Adapters).
  - Built-in dynamic vehicle physics simulator for testing without hardware.

### 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/rayatdoostSINA/CAR-OBD2.git

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local
# Add your GEMINI_API_KEY in .env.local

# Run development server
npm run dev
