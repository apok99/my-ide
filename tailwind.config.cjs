/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Space Grotesk", "Poppins", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      colors: {
        ink: "#0b0d12",
        panel: "#151922",
        edge: "#222838",
        accent: "#ff7b72",
        accentTwo: "#4cc9f0",
      },
      boxShadow: {
        glow: "0 20px 40px rgba(5, 8, 16, 0.5)",
      },
    },
  },
  plugins: [],
};
