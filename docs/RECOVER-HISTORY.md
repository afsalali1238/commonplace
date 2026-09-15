# Recovering the original git history

This repo was re-squashed into a single commit when it was renamed and
re-imported (it was previously `afsalali1238/unknown`). The **complete original
history** was preserved as `docs/capital-map.bundle` (a `git bundle`, 370 KB,
branch `master` @ `6912c50` — verified with `git bundle verify`).

To browse or mine the old history:

```bash
git clone docs/capital-map.bundle ../commonplace-history
cd ../commonplace-history && git log --oneline | head
```

Or fetch individual old commits/branches into this repo without touching the
current lineage:

```bash
git fetch docs/capital-map.bundle master:refs/archive/master
git log --oneline refs/archive/master | head
```

Do not merge the archived history into `main` — the two lineages are unrelated
(squash re-import); use it for archaeology, `git blame`-style lookups, and
recovering any files dropped in the re-import.
