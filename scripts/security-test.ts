// SSRF guard regression test — proves fetch_page_content cannot be steered
// at internal infrastructure by a prompt-injected page.
// Usage: npm run test:security
import { assertFetchable } from "../src/tools/fetch-page.js";

const cases: [string, boolean][] = [
  ["http://169.254.169.254/latest/meta-data/", true],
  ["http://metadata.google.internal/computeMetadata/", true],
  ["http://127.0.0.1:8080/admin", true],
  ["http://localhost:3000/", true],
  ["http://10.0.0.5/internal", true],
  ["http://192.168.1.1/", true],
  ["http://172.16.0.1/", true],
  ["http://[::1]/", true],
  ["http://attacker.com/?data=leak", true],
  ["file:///etc/passwd", true],
  ["gopher://evil/", true],
  ["https://evil-bbc.com/", true],
  ["https://bbc.com.evil.com/", true],
  ["https://www.bbc.com/news", false],
  ["https://bbc.com/news", false],
  ["https://www.reuters.com/world/", false],
];

let pass = 0, fail = 0;
for (const [raw, shouldBlock] of cases) {
  let blocked = false, why = "";
  try { await assertFetchable(new URL(raw)); }
  catch (e) { blocked = true; why = e instanceof Error ? e.message : String(e); }
  const ok = blocked === shouldBlock;
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${(blocked ? "BLOCKED" : "allowed").padEnd(8)} ${raw}`);
  if (blocked && why) console.log(`             -> ${why}`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
