#!/usr/bin/env node

// The following code suppresses the warning about the punycode deprecated module.
// This is a temporary workaround until this get's fixed upstream.
process.removeAllListeners("warning");
process.on("warning", () => {});

const { execute } = await import("@oclif/core");
await execute({ dir: import.meta.url });
