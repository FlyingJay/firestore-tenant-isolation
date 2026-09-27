// Files: the tenant is the first path segment under tenants/.
import { test, before, after } from 'node:test';
import { assertSucceeds, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { storageEnv } from './env.ts';

let env: RulesTestEnvironment;
before(async () => {
  env = await storageEnv('demo-storage');
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const t of ['acme', 'globex'])
      await ctx.storage().ref(`tenants/${t}/notes/a.txt`).putString(t);
    await ctx.storage().ref('loose/b.txt').putString('x');
  });
});
after(() => env.cleanup());

const acme = () => env.authenticatedContext('alice', { tenants: ['acme'] }).storage();
const anon = () => env.unauthenticatedContext().storage();

test('reads a file in your tenant', () =>
  assertSucceeds(acme().ref('tenants/acme/notes/a.txt').getMetadata()));
test('cannot read a file in another tenant', () =>
  assertFails(acme().ref('tenants/globex/notes/a.txt').getMetadata()));
test('writes a file in your tenant', () =>
  assertSucceeds(acme().ref('tenants/acme/notes/new.txt').putString('x')));
test('cannot write a file in another tenant', () =>
  assertFails(acme().ref('tenants/globex/notes/new.txt').putString('x')));
test('lists your own tenant folder', () =>
  assertSucceeds(acme().ref('tenants/acme').listAll()));
test('cannot list another tenant\'s folder', () =>
  assertFails(acme().ref('tenants/globex').listAll()));
test('cannot list across tenants from tenants/', () =>
  assertFails(acme().ref('tenants').listAll()));
test('anything outside tenants/ matches nothing', () =>
  assertFails(acme().ref('loose/b.txt').getMetadata()));
test('an unauthenticated caller reads nothing', () =>
  assertFails(anon().ref('tenants/acme/notes/a.txt').getMetadata()));
