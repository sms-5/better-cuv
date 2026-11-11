import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
    build: {
        outDir: "dist",
        emptyOutDir: true,
        rollupOptions: {
            input: {
                popup: resolve(__dirname, "index.html"),
                // Autocontenido: si el content script importa código compartido,
                // Rollup lo emite como módulo ES y Chrome no lo carga como content script.
                content: resolve(__dirname, "src/content/content.ts"),
            },
            output: {
                entryFileNames: (chunk) =>
                    chunk.name === "content" ? "content.js" : "assets/[name].js",
            },
        },
    },
});
