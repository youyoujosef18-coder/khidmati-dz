// Reads what the app's WebView is showing (URL, title, start of the visible text) through the
// Chrome DevTools protocol. Works on debug builds only (WebView debugging is off in release).
// Usage: node webview-inspect.mjs <forwarded-port>
const port = process.argv[2] ?? "9222";
const timer = setTimeout(() => { console.log(JSON.stringify({ error: "timeout" })); process.exit(0); }, 15000);
try {
  const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = list.find((p) => p.type === "page");
  if (!page) {
    console.log(JSON.stringify({ error: "no page", targets: list.map((p) => p.type) }));
  } else {
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    const expression =
      "JSON.stringify({href: location.href, title: document.title, text: ((document.body && document.body.innerText) || '').replace(/\\s+/g, ' ').slice(0, 400)})";
    ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, returnByValue: true } }));
    const reply = await new Promise((resolve) => {
      ws.onmessage = (e) => { const d = JSON.parse(e.data); if (d.id === 1) resolve(d); };
    });
    console.log(reply.result?.result?.value ?? JSON.stringify({ error: "evaluate failed", reply }));
    ws.close();
  }
} catch (e) {
  console.log(JSON.stringify({ error: String(e?.message ?? e) }));
}
clearTimeout(timer);
process.exit(0);
