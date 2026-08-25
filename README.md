# MultiGauge OBD Universal

MultiGauge is a mobile-first, bilingual OBD-II monitor and basic diagnostic PWA. It is intentionally read-only by default and does not expose raw CAN transmission, ECU coding, or actuator tests.

## Run locally

1. Install Node.js 22.13 or newer and pnpm.
2. Run `pnpm install`.
3. Run `pnpm dev` and open the shown local address.
4. Choose **Simulator** to test without a vehicle, or select an ELM327 connection method.

Production build: `pnpm build`.

GitHub Pages build: `pnpm run build:pages`. The included workflow publishes `pages-dist` from the `main` branch to the repository path `/multigauge-obd/`.

## Architecture

`OBDTransport` → `ELM327Driver` → `DiagnosticProtocol` → PID/DTC engine → React dashboard.

- `lib/transports/` contains Simulator, Web Bluetooth, and WiFi implementations.
- `lib/elm327.ts` owns adapter initialization and command exchange.
- `lib/diagnostic.ts` owns PID decoding, capability discovery, and DTC operations.
- `public/database/` contains data-driven PID, DTC, and vehicle profiles.
- `lib/indexed-db.ts` persists device-local language, theme, and dashboard preferences.

Web Bluetooth requires a compatible Chromium browser, HTTPS, and a **BLE** ELM327 adapter. The transport supports common FFE0/FFE1, Nordic UART, and FFF0/FFF1/FFF2 serial profiles, receives segmented notification responses, and serializes ELM327 commands. Classic Bluetooth SPP adapters are not available through Web Bluetooth; use a BLE model or a future native Android build. WiFi browser support depends on the adapter or a local bridge exposing a WebSocket endpoint; browsers cannot open raw TCP sockets.

The responsive layout includes dedicated portrait, tablet/desktop, and short landscape-phone rules. In phone landscape, navigation moves to a narrow side rail and the active cluster fills the available height.

## Native mobile path

The lowest-risk migration is to wrap the existing React UI with Capacitor and replace browser transports with native plugins. Android should support BLE and optionally Bluetooth Classic/RFCOMM for low-cost ELM327 adapters. iOS should target BLE and WiFi adapters through Core Bluetooth and local-network APIs. Both apps need native permission flows, connection lifecycle handling, signed release builds, physical-device/vehicle testing, privacy disclosures, store artwork, and developer accounts.

## Safety

Clearing DTCs resets stored codes but does not repair the underlying fault. Vehicle PID support varies; unsupported readings are presented explicitly and never converted to fake zero values.

## Touch dashboard

The dashboard includes sporty Focus, Dual Gauge, and Digital Grid views with animated needles, scale marks, redline accents, and RPM shift lights. Switch views from the compact control above the gauges. Touch and hold anywhere on the dashboard to enter edit mode, then tap any highlighted value to assign a different supported PID. Layout mode and slot choices are saved offline on the device.
