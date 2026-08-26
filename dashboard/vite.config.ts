import { readdir, readFile } from "node:fs/promises"
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

const sanityReportDirectory = "/tmp/ansible/sys-patching/sanity-reboot"

function sanityReportsApi(): Plugin {
  const middleware = async (_request: unknown, response: { setHeader: (name: string, value: string) => void; end: (body: string) => void }) => {
    try {
      const filenames = (await readdir(sanityReportDirectory)).filter((filename) => filename.endsWith("_sanity_reboot_status.json"))
      const reports = await Promise.all(filenames.map(async (filename) => ({
        host: filename.replace("_sanity_reboot_status.json", ""),
        ...JSON.parse(await readFile(path.join(sanityReportDirectory, filename), "utf8")),
      })))

      response.setHeader("Content-Type", "application/json")
      response.end(JSON.stringify(reports))
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to read sanity reboot reports."
      response.setHeader("Content-Type", "application/json")
      response.end(JSON.stringify({ error: message }))
    }
  }

  return {
    name: "sanity-reports-api",
    configureServer(server) {
      server.middlewares.use("/api/sanity-reboot", middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/sanity-reboot", middleware)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), sanityReportsApi()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
