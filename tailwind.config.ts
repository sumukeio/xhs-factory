import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        xhs: {
          bg: {
            cream: "#FDFBF7",
            green: "#E0E5DF",
            blue: "#D8E2EB",
            dark: "#1A1A1A",
          },
          text: {
            main: "#333333",
            sub: "#666666",
            accent: "#FF4D4F",
          }
        }
      },
    },
  },
  plugins: [],
};
export default config;