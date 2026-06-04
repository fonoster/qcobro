// Generic call script for any demo
// Usage: node call.cjs <appRef> <toNumber> [metadata as JSON string]
const SDK = require("@fonoster/sdk");

// Configuration constants
const workspaceAccessKeyId = "WOub8kbgmw31n3fb7vcxd01ddvmehjqzx2";
const apiKey = "AP11nl9agyvkbrn4wi1cpjcsg8ispjq40o";
const apiSecret = "c4zQjXjEtjAKndTVf4Zk5GjutQXoGMLjfVk3mDe0jjSiC7uacvlLnCzpZyTbPbwI";
const fromNumber = "18297340812";

// Get command line arguments
const appRef = process.argv[2];
const toNumber = process.argv[3];
const metadataArg = process.argv[4];

if (!appRef || !toNumber) {
  console.error("❌ Usage: node call.cjs <appRef> <toNumber> [metadata as JSON string]");
  console.error("   Example: node call.cjs 1f431598-f455-49da-bf35-69716c0d2da4 +17853178070 '{\"businessName\":\"Test\"}'");
  process.exit(1);
}

// Parse metadata if provided
let metadata = {};
if (metadataArg) {
  try {
    metadata = JSON.parse(metadataArg);
  } catch (error) {
    console.error("❌ Error parsing metadata JSON:", error.message);
    process.exit(1);
  }
}

/**
 * 🎯 Main function: Makes a call with the provided appRef and metadata
 */
async function main() {
  try {
    console.log("📨 Making call with:");
    console.log("App Ref:", appRef);
    console.log(`Phone Number: '${toNumber}'`);
    if (Object.keys(metadata).length > 0) {
      console.log("Metadata:", JSON.stringify(metadata, null, 2));
    }

    const client = new SDK.Client({ accessKeyId: workspaceAccessKeyId });
    await client.loginWithApiKey(apiKey, apiSecret);
    
    const calls = new SDK.Calls(client);

    console.log("📞 Starting call...");
    
    const callStream = await calls.createCall({
      from: fromNumber,
      to: toNumber,
      appRef,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined
    });

    const { ref, statusStream } = callStream;
    console.log('📞 Call reference:', ref);
    
    // Fire and forget status logging
    (async () => {
      try {
        for await (const status of statusStream) {
          console.log('📞 Call status:', status);
        }
      } catch (error) {
        console.error('❌ Call stream error:', error.message);
      }
    })();

    console.log("✅ Call initiated successfully");
  } catch (error) {
    console.error("❌ Error making call:", error.message);
    process.exit(1);
  }
}

// Execute the main function
main();
