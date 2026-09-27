// The shim against the real rules: ordinary SDK calls land in the right tenant.
import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, addDoc, setDoc, getDoc, getDocs, query, where } from '../src/tenant-firestore.ts';
import { setActiveTenant } from '../src/session.ts';
import { firestoreEnv } from './env.ts';

let env: RulesTestEnvironment;
before(async () => { env = await firestoreEnv('demo-shim', 'rules/firestore.claims.rules'); });
after(() => env.cleanup());
afterEach(() => setActiveTenant(null));

const as = (tenant: string) => {
  setActiveTenant(tenant);
  return env.authenticatedContext(`${tenant}-user`, { tenants: [tenant] }).firestore();
};

test('two tenants write settings/main, both succeed, neither sees the other', async () => {
  await setDoc(doc(as('acme'), 'settings', 'main'), { theme: 'dark' });
  await setDoc(doc(as('globex'), 'settings', 'main'), { theme: 'light' });

  const a = await getDoc(doc(as('acme'), 'settings', 'main'));
  const g = await getDoc(doc(as('globex'), 'settings', 'main'));
  assert.equal(a.data()?.theme, 'dark');
  assert.equal(g.data()?.theme, 'light');
});

test('addDoc, then doc(id) finds the same document', async () => {
  const db = as('acme');
  const ref = await addDoc(collection(db, 'notes'), { title: 'hello' });
  assert.match(ref.id, /^acme__/);
  const snap = await getDoc(doc(db, 'notes', ref.id));
  assert.equal(snap.data()?.title, 'hello');
});

test('an unfiltered getDocs only returns your tenant', async () => {
  await addDoc(collection(as('globex'), 'notes'), { title: 'theirs' });
  const db = as('acme');
  await addDoc(collection(db, 'notes'), { title: 'pinned', pinned: true });
  const all = await getDocs(collection(db, 'notes'));
  assert.ok(all.size > 0);
  assert.ok(all.docs.every((d) => d.data().tenantId === 'acme'));
  const pinned = await getDocs(query(collection(db, 'notes'), where('pinned', '==', true)));
  assert.equal(pinned.size, 1);
});
