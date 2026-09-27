# Firestore tenant isolation

Runnable rules, shim, and tests for *Don't Teach Agents. Constrain Them.*

The article argues that a tenant boundary should hold whatever the client code does. This repo checks that claim against the Firestore and Storage emulators: every test in `firestore-*.test.ts` and `storage.test.ts` uses the raw SDK, no shim.

## What's here

| Path | What it is |
| --- | --- |
| `rules/firestore.claims.rules` | The one-rule version. Tenants from a custom claim, tenant on every document, tenant prefix on every new id. |
| `rules/firestore.index.rules` | The access-index version. Membership and per-app permissions from a server-written `access_index/{uid}`. |
| `rules/storage.rules` | Files, with the tenant as the first path segment under `tenants/`. |
| `src/tenant-firestore.ts` | The shim. Stamps the tenant on writes, filters reads, tags ids. |
| `test/` | One suite per file above. |

## Run it

Needs Node 22.18+ and Java 21 (the emulators run on the JVM).

```bash
npm install
npm test
```

`npm test` starts the Firestore and Storage emulators, runs every suite, and shuts them down. Nothing touches a real project.

## What the tests prove

**Claims rule.** You can read, query, and update only your own tenant. Unfiltered queries and collection group queries fail instead of returning other tenants. Missing documents read as denied. A two-tenant user can't move a document across. New ids have to start with your tenant, so `settings/globex__main` can't be squatted from Acme.

**Access index.** Permissions narrow inside a tenant: read-only means read-only. A suspended user is locked out everywhere. A client can't create an `access_index` document, even on an id the tag check would accept.

**Storage.** Reads, writes, and listing stop at your tenant's folder. Anything outside `tenants/` matches nothing.

**Shim.** Two tenants write `settings/main` and neither sees the other. `addDoc` followed by `doc(db, 'notes', ref.id)` finds the same document. An unfiltered `getDocs` returns only your tenant.

## Using the shim

Point the SDK import at the wrapper with a build alias:

```ts
// vite.config.ts
resolve: { alias: [
  { find: /^firebase\/firestore$/, replacement: '/src/tenant-firestore.ts' },
] }
```

List `@firebase/firestore` as a direct dependency so the wrapper can import the real SDK. The shim here covers what the article shows plus `setDoc` and bare-collection `getDocs`. Batches, transactions, `onSnapshot`, and single-segment paths like `doc(db, 'notes/main')` are left out.
