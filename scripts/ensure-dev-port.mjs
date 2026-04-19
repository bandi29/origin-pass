#!/usr/bin/env node
/**
 * Ensures the dev port is free before `next dev` runs.
 * Prevents Next from auto-switching to 3001/3002 when 3000 is taken.
 */
import net from "node:net"

const port = Number(process.env.DEV_PORT || process.env.PORT || 3000)
const host = process.env.DEV_HOST || "0.0.0.0"

const server = net.createServer()
server.once("error", (err) => {
  if (err && "code" in err && err.code === "EADDRINUSE") {
    console.error(
      `\n[dev] Port ${port} is already in use on ${host}.\n` +
        `    Stop the other process (e.g. another terminal running npm run dev), or:\n` +
        `    lsof -i :${port}\n`
    )
    process.exit(1)
  }
  throw err
})
server.listen({ port, host }, () => {
  server.close(() => process.exit(0))
})
