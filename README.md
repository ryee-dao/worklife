# WorkLife

A personal Pomodoro-style desktop app that enforces work boundaries through mandatory but configurable breaks. Built with Electron.

<p align="left">
 <img src="https://github.com/user-attachments/assets/f5958702-7b3b-4a6c-8258-23e133733efc" alt="WorkLife Preview" width="500" />
</p>

## Tech Stack

- **Electron** - Desktop app framework
- **React** - UI components
- **TypeScript** - Type safety
- **Vite** - Fast build tooling
- **Tailwind CSS** - Styling
- **Playwright** - E2E testing
- **Vitest** - Unit testing

## Installation

Download the latest installer for your platform:

**Windows:**
1. Download `WorkLife Setup.exe` from releases
2. Run the installer
3. Launch WorkLife from Start Menu

**macOS:**
1. Download `WorkLife.dmg` from releases
2. Open the DMG and drag WorkLife to Applications
3. Launch from Applications folder

## Local Development

### Prerequisites
- Node.js 22+ 
- npm

### Setup
```bash
# Install dependencies
npm install
 
# Run in development mode
npm run dev
 
# Build for production
npm run build
 
# Create distributable
npm run dist
```
 
### Testing
```bash
# Unit tests
npm run test:unit
 
# End to end tests
npm run test:e2e
 
# All tests
npm run test
```
