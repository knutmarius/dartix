# DartiX 🎯

A modern, responsive dart scoring application built with React and TypeScript. Keep track of your dart games with multiple game modes, real-time scoring, and a beautiful user interface.

## ✨ Features

- **Multiple Game Modes**

  - **Half-It**: Progress through numbers 13-20, doubles, triples, and bullseye. Miss a target and your score is halved!
  - **Cricket**: Close out numbers 15-20 and bullseye while scoring points against your opponents
  - **501**: Classic dart game - start at 501 and aim to reach exactly zero

- **Smart Features**

  - Real-time score calculation
  - Dynamic round management for 501
  - Checkout suggestions for 501
  - Helpful tooltips for scoring rules
  - Player management with confirmation dialogs

- **Modern UI**
  - Clean, responsive design
  - Dark mode support
  - Mobile-friendly interface
  - Beautiful animations and transitions

## 🛠️ Tech Stack

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Framework**: Mantine UI
- **Icons**: Tabler Icons
- **Styling**: CSS-in-JS with Mantine
- **State Management**: React Context

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm, yarn, or pnpm

### Installation

1. Clone the repository

   ```bash
   git clone https://github.com/yourusername/dartix.git
   cd dartix
   ```

2. Install dependencies

   ```bash
   npm install
   # or
   yarn
   # or
   pnpm install
   ```

3. Start the development server

   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

4. Open your browser and navigate to `http://localhost:5173`

## 🎮 Game Rules

### Half-It

1. Players take turns throwing at specific targets in sequence
2. Each round targets a specific number (13-20), doubles, triples, or bullseye
3. Missing a target completely (scoring 0) halves your current total score
4. The player with the highest score at the end wins

### Cricket

1. Players aim to "close out" numbers 15-20 and bullseye
2. Three marks on a number closes it (single = 1 mark, double = 2 marks, triple = 3 marks)
3. Score points on a number only if you've closed it and others haven't
4. First player to close all numbers with the highest score wins

### 501

1. Each player starts with 501 points
2. Subtract points scored from your total
3. Must reach exactly zero to win
4. Optional double-out rule (not implemented yet)

## 🤝 Contributing

Contributions are welcome! Feel free to submit issues and pull requests.

## 📝 License

This project is open source and available under the [MIT License](LICENSE).
