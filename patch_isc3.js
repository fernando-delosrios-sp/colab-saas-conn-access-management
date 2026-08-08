const fs = require('fs');
let file = fs.readFileSync('src/isc-client.ts', 'utf8');

file = file.replace(
    /const chunkSize = 30\s*const chunks: string\[\]\[\] = \[\]\s*for \(let i = 0; i < names\.length; i \+= chunkSize\) \{\s*chunks\.push\(names\.slice\(i, i \+ chunkSize\)\)\s*\}\s*const results = await runWithConcurrency\(chunks, 10, async \(chunk\) => \{/g,
    "const chunkSize = 30\n        const chunks: string[][] = []\n        for (let i = 0; i < names.length; i += chunkSize) {\n            chunks.push(names.slice(i, i + chunkSize))\n        }\n\n        const results = await runWithConcurrency(chunks, 10, async (chunk) => {"
);

fs.writeFileSync('src/isc-client.ts', file);
