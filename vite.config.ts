import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
    plugins: [react()],
    build: {
        outDir: "dist",
        emptyOutDir: true,
        rollupOptions: {
            input: {
                popup: resolve(__dirname, "index.html"),
                content: resolve(__dirname, "src/content/content.ts"), // <-- ¡Nueva entrada!
            },
            output: {
                entryFileNames: (chunk) => {
                    // Si el chunk se llama 'content', su nombre de archivo de salida será 'content.js'
                    if (chunk.name === "content") return "content.js";
                    return "assets/[name].js";
                },
            },
        },
    },
});
