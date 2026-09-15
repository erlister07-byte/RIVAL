# RIVAL migration archive

> **AUDIT ONLY — DO NOT REPLAY**

This directory preserves the pre-baseline migration history for forensic review. Files under `original/` are the 38 SQL files that were active at the Loop 3 baseline checkpoint and are retained byte-for-byte. Files under `recovered/` are historical artifacts recovered from Git but intentionally excluded from the active migration chain.

- Baseline date: 2026-09-14
- Baseline checkpoint: `18e1a8e32722ad9e12ec20e135c3d268bcb1202e`
- Production project reference: `rgquxhkburgpzghwslbd`
- Replacement baseline: `../migrations/20260914000000_rival_current_schema_baseline.sql`

## Why this archive exists

The old directory contains several files sharing the same migration version. Supabase migration history identifies versions, so those duplicate-version files cannot be mapped back to remote history without ambiguity. In addition, the following Loop 3 migrations were applied to production through isolated direct SQL execution but are absent from remote migration metadata:

- `20260902051619`
- `20260906023712`
- `20260908233948`

The recovered per-sport rating migration is stored at `recovered/20260819_loop3_phase1_sport_ratings.sql`. It came from Git blob `24583a9de1bc3e8ba756c4fd1b40c0e172323968` and has SHA-256 `4676395f53ed2e727b100594a9ba13ac62312c5803179e75d8f719f85a600c44`.

Old Firebase identity migrations, global-rating migrations, compatibility RPCs, and other superseded definitions are historical evidence only. They are not part of the canonical fresh-database design.

## Rules

1. Never pass this archive to normal `supabase db push`, reset, or migration replay workflows.
2. Never rename or edit archived SQL files. Verify their hashes against `manifest.csv` after copying or transport.
3. Do not infer production migration metadata from filenames alone; consult the manifest and a fresh read-only metadata audit.
4. Git history remains authoritative for all pre-baseline source provenance.
5. The active baseline is for a fresh compatible Supabase database. It is not a production convergence migration and must not be applied to the existing production project.

Deterministic reference data is separated into `../seeds/reference.sql`. Development fixtures remain in `../seeds/local_seed.sql` and are not canonical data.
