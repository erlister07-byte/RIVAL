# Supabase Schema Drift

When a new optional profile field is added in code before the manual SQL is applied:

1. Add the SQL migration first and keep it safe to re-run.
2. Treat the new field as optional in profile mappers.
3. Centralize the field in one select-string helper.
4. Retry the query without that field if PostgREST returns `42703`.
5. Use a sensible frontend fallback so Home/Profile/Discovery still render.

For this codebase, `availability_status` is the reference pattern in:
- [userService.ts](/Users/evanlister/rival/src/services/userService.ts)
- [schemaDrift.ts](/Users/evanlister/rival/src/shared/lib/schemaDrift.ts)
