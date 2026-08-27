// SSRF guard regression test — proves fetch_page_content cannot be steered
// at internal infrastructure by a prompt-injected page.
// Usage: npm run test:security   (no API keys required)

// The guard is pure URL/DNS logic and calls no API, but it imports `config`,
// which fails fast on missing keys. Supply placeholders, then import.
process.env.ANTHROPIC_API_KEY ||= "test-not-a-real-key";
process.env.TAVILY_API_KEY ||= "test-not-a-real-key";

const { assertFetchable } = await import("../src/tools/fetch-page.js");

const cases: [string, boolean][] = [
  // [url, shouldBeBlocked]
  ["http://169.254.169.254/latest/meta-data/", true],   // AWS/Azure metadata
  ["http://metadata.google.internal/computeMetadata/", true], // GCP metadata
  ["http://127.0.0.1:8080/admin", true],                // loopback
  ["http://localhost:3000/", true],                     // loopback by name
  ["http://10.0.0.5/internal", true],                   // RFC1918
  ["http://192.168.1.1/", true],                        // RFC1918
  ["http://172.16.0.1/", true],                         // RFC1918
  ["http://100.64.0.1/", true],                         // CGNAT
  ["http://[::1]/", true],                              // IPv6 loopback
  ["http://[fd00::1]/", true],                          // IPv6 unique-local
  ["http://attacker.com/?data=leak", true],             // exfiltration channel
  ["file:///etc/passwd", true],                         // scheme
  ["gopher://evil/", true],                             // scheme
  ["https://evil-bbc.com/", true],                      // prefix lookalike
  ["https://bbc.com.evil.com/", true],                  // suffix lookalike
  ["https://www.bbc.com/news", false],                  // legitimate
  ["https://bbc.com/news", false],                      // legitimate apex
  ["https://www.reuters.com/world/", false],            // legitimate
];

let pass = 0, fail = 0;
for (const [raw, shouldBlock] of cases) {
  let blocked = false, why = "";
  try {
    await assertFetchable(new URL(raw));
  } catch (e) {
    blocked = true;
    why = e instanceof Error ? e.message : String(e);
  }
  const ok = blocked === shouldBlock;
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${(blocked ? "BLOCKED" : "allowed").padEnd(8)} ${raw}`);
  if (!ok) console.log(`      expected ${shouldBlock ? "BLOCKED" : "allowed"}`);
  if (blocked && why) console.log(`             -> ${why}`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
