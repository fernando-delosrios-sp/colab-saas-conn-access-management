1. Modify `src/utils/velocity.ts` using `replace_with_git_merge_diff`
    - Update `isUnsafeVelocityAST` to accept a `contextVars: Map<string, string>` parameter to track static string assignments.
    - Add logic to handle `#set` nodes by statically evaluating string values and concatenations (`+`), saving evaluated values into `contextVars`.
    - Update the index node check to verify if the index resolves to an unsafe string via the `contextVars` map.
2. Verify the changes using `npm run build` and tests.
3. Update `.jules/sentinel.md` with the new learning using `cat >> `.
4. Complete pre commit steps to ensure proper testing, verification, review, and reflection are done.
5. Submit the change using `submit_pr`.
