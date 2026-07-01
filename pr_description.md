🎯 **What:** Removed the `areStringArraysEqual` utility function from `src/utils/index.ts` and inlined its equivalent logic using `areJsonEqual` and array sorting at its only call site in `src/index.ts`.

💡 **Why:** The utility function `areStringArraysEqual` was considered an unnecessary code health burden. Inlining its logic where it's used simplifies the utility library, reduces dead/single-use code, and improves maintainability by relying on the generalized deep equality function (`areJsonEqual`) already present.

✅ **Verification:** Verified by ensuring the logic (comparing two sorted string arrays for equality) behaves identically, running unit tests (`npx jest`), formatting (`npm run prettier`), and completing a full build (`npm run build`). The code review tool also confirmed the change is safe.

✨ **Result:** A cleaner utility file with no loss of functionality, removing unnecessary and highly-specific string array comparison logic from the codebase.
