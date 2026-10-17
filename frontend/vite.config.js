import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `npm run dev`  -> hot-reloading dev server on :5173, API calls proxied to the FastAPI server on :8000
// `npm run build` -> static files in dist/, which FastAPI serves in production
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": "http://127.0.0.1:8000" } },
});
