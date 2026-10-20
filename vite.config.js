import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          if (
            id.includes("node_modules/@firebase/firestore") ||
            id.includes("node_modules/firebase/firestore")
          )
            return "firebase-database";
          if (
            id.includes("node_modules/@firebase/") ||
            id.includes("node_modules/firebase/")
          )
            return "firebase-account";
        },
      },
    },
  },
});
