import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, "..", "schema.sql"), "utf8");

(async () => {
  await pool.query(sql);
  console.log("✓ schema applied");
  await pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
