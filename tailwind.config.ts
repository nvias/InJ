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
        primary: "#1A3BE8",
        background: "#0A0F2E",
        accent: "#00D4FF",
        foreground: "#FFFFFF",
      },
    },
  },
  plugins: [],
};
export default config;
