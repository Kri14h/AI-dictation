# 🎙️ AI Dictation Challenge

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

A minimalist, dark-mode web application designed to test your spelling and vocabulary through AI-powered dictation. Built entirely on the client-side, it communicates directly with the Google Gemini API to generate words dynamically based on a custom difficulty scale.

🚀 **Live Demo:** [https://ai-dictation-mauve.vercel.app/](https://ai-dictation-mauve.vercel.app/)

## ✨ Features

- **Dynamic Word Generation:** Uses the Gemini API to fetch words on a 1-10 difficulty scale (ranging from basic A1 vocabulary to complex C2/GRE words).
- **Smart Memory System:** Utilizes browser `localStorage` to remember past words and ensure you never get the same word twice across your sessions.
- **Native Text-to-Speech:** Leverages the browser's built-in `SpeechSynthesis` API for clear audio playback without relying on heavy external libraries.
- **Distraction-Free UI:** A clean, developer-focused aesthetic built with Tailwind CSS, featuring visual feedback for correct and incorrect spellings.
- **Serverless Architecture:** 100% frontend. API communication is handled directly in the browser via `fetch()`.

## 🛠️ Tech Stack

- **Framework:** React + Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **AI Integration:** Google Gemini API
- **Deployment:** Vercel

## 🚀 Local Development Setup

To run this project locally on your machine, follow these steps:

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/Kri14h/AI-dictation.git](https://github.com/Kri14h/AI-dictation.git)
   cd AI-dictation
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Configuration:**
   Copy the `.env.example` file to create a new `.env` file, and add your Gemini API key:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and insert your key:
   ```env
   VITE_GEMINI_API_KEY="your_actual_api_key_here"
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:5173`.
