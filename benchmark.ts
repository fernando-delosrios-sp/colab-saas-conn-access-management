import { EntitlementV2025 } from 'sailpoint-api-client'
import { escapeFilterString } from './src/utils/index'

// Simulate a map of entitlements and applications to simulate concurrent lookup
async function benchmark() {
    console.log("Mock getAppByName simulation");

    // N+1 approach
    const startN1 = Date.now();
    for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 100)); // simulate API call
    }
    const endN1 = Date.now();
    console.log(`N+1 time: ${endN1 - startN1}ms`);

    // Concurrent approach
    const startConcurrent = Date.now();
    const promises = [];
    for (let i = 0; i < 10; i++) {
        promises.push(new Promise(r => setTimeout(r, 100)));
    }
    await Promise.all(promises);
    const endConcurrent = Date.now();
    console.log(`Concurrent time: ${endConcurrent - startConcurrent}ms`);
}

benchmark().catch(console.error);
