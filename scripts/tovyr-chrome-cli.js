/**
 * Tovyr does not currently ship a browser extension or native host.
 * Keep this command explicit and inert so it can never register another
 * product's extension, host, files, or credentials.
 */
export async function runTovyrChromeCli() {
  console.log(`Tovyr browser extension integration is not available yet.

WebFetch and WebSearch still work for public web content.
For clicking, forms, screenshots, or signed-in pages, configure a Playwright
or computer-use MCP server.
`)
}

if (process.argv[1]?.endsWith('tovyr-chrome-cli.js')) {
  await runTovyrChromeCli()
}
