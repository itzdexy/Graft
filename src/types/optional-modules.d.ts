/**
 * Optional runtime integrations that are deliberately not installed.
 *
 * Each module below is imported behind a guard -- a dynamic `await import()`
 * inside a try/catch, or a code path only reachable once the user has
 * configured that provider. None of them are needed to run Graft, and several
 * (sharp, the *-napi addons, the AWS and OpenTelemetry SDKs) are large or
 * platform-specific enough that shipping them as hard dependencies would cost
 * every user an install they will probably never use.
 *
 * Without these declarations the typechecker reports ~90 TS2307 errors for
 * modules whose absence is the intended state, which is enough noise to hide
 * the resolution failures that *are* bugs. Declaring them keeps the signal.
 *
 * The cost is real and worth stating: bodies typed `any` mean the call sites
 * below are unchecked. If one of these ever becomes a true dependency, delete
 * its entry here and add it to package.json rather than widening this file.
 *
 * NOT the place for missing first-party modules. A `Cannot find module
 * './something.js'` inside this repo is a porting hole or a dead code path --
 * fix or delete it, do not declare it away.
 */

// Image handling. Both are fallbacks inside FileReadTool/imagePaste; the
// primary path uses the platform's own decoding.
declare module 'sharp'
declare module 'image-processor-napi'

// Native helpers for voice input and OS URL handling.
declare module 'audio-capture-napi'
declare module 'url-handler-napi'

// Archive and cache helpers, dynamically imported by the plugin/DXT loaders.
declare module 'fflate'
declare module 'cacache'

// macOS-only: notification plumbing reads plists.
declare module 'plist'

// Proxy/mTLS support. Imported as `import type * as undici` only -- the
// runtime uses the global fetch.
declare module 'undici'

// Alternative model providers. Reachable only when the matching provider is
// selected, and each import is guarded.
declare module '@anthropic-ai/bedrock-sdk'
declare module '@anthropic-ai/vertex-sdk'
declare module '@anthropic-ai/foundry-sdk'
declare module 'google-auth-library'
declare module '@azure/identity'
declare module '@aws-sdk/client-bedrock'
declare module '@aws-sdk/client-bedrock-runtime'
declare module '@aws-sdk/client-sts'
declare module '@aws-sdk/credential-provider-node'
declare module '@aws-sdk/credential-providers'
declare module '@smithy/core'
declare module '@smithy/node-http-handler'

// MCP bundle (.mcpb) reader, used only when installing a bundled server.
declare module '@anthropic-ai/mcpb'

// OpenTelemetry exporters. The SDK itself is a real dependency; which
// exporter loads depends on the user's OTEL_*_EXPORTER setting, so all of
// them are optional and none are installed by default.
declare module '@opentelemetry/exporter-logs-otlp-grpc'
declare module '@opentelemetry/exporter-logs-otlp-http'
declare module '@opentelemetry/exporter-logs-otlp-proto'
declare module '@opentelemetry/exporter-metrics-otlp-grpc'
declare module '@opentelemetry/exporter-metrics-otlp-http'
declare module '@opentelemetry/exporter-metrics-otlp-proto'
declare module '@opentelemetry/exporter-prometheus'
declare module '@opentelemetry/exporter-trace-otlp-grpc'
declare module '@opentelemetry/exporter-trace-otlp-http'
declare module '@opentelemetry/exporter-trace-otlp-proto'
