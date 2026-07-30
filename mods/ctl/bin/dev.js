#!/usr/bin/env -S node --import tsx

process.removeAllListeners("warning");
process.on("warning", () => {});

const { execute } = await import("@oclif/core");
await execute({ development: true, dir: import.meta.url });
