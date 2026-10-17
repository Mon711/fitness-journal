// A separate, loopback-only preview backed by synthetic QA data.
process.env.FITNESS_QA = "1";
process.argv = [process.execPath, import.meta.filename, "dev", "--hostname", "127.0.0.1", "--port", "5175"];
await import("./run-framework.mjs");
