// The access-index version: membership and per-app permissions from a server-written
// access_index/{uid} document, read once per request.
import { test, before, after } from 'node:test';
import { assertSucceeds, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, updateDoc, collectionGroup, query, where } from 'firebase/firestore';
import { firestoreEnv } from './env.ts';

let env: RulesTestEnvironment;
before(async () => {
  env = await firestoreEnv('demo-index', 'rules/firestore.index.rules');
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'access_index', 'alice'), {
      status: 'active', tenants: ['acme'],
      permissions: { acme: { notes: ['read', 'create', 'update'], billing: ['read'] } },
    });
    await setDoc(doc(db, 'access_index', 'dave'), {
      status: 'suspended', tenants: ['acme'],
      permissions: { acme: { notes: ['read', 'create', 'update'] } },
    });
    for (const t of ['acme', 'globex']) {
      await setDoc(doc(db, 'notes', `${t}__n1`), { tenantId: t, appId: 'notes' });
      await setDoc(doc(db, 'notes', `${t}__n1`, 'comments', `${t}__c1`), { tenantId: t, appId: 'notes' });
    }
    await setDoc(doc(db, 'billing', 'acme__b1'), { tenantId: 'acme', appId: 'billing' });
  });
});
after(() => env.cleanup());

const alice = () => env.authenticatedContext('alice').firestore();
const dave = () => env.authenticatedContext('dave').firestore();
const nobody = () => env.authenticatedContext('erin').firestore();

// Permissions narrow inside a tenant
test('reads an app you have read on', () =>
  assertSucceeds(getDoc(doc(alice(), 'billing', 'acme__b1'))));
test('cannot update an app you only have read on', () =>
  assertFails(updateDoc(doc(alice(), 'billing', 'acme__b1'), { x: 1 })));
test('cannot create in an app you have no create on', () =>
  assertFails(setDoc(doc(alice(), 'billing', 'acme__b2'), { tenantId: 'acme', appId: 'billing' })));
test('cannot read another tenant', () =>
  assertFails(getDoc(doc(alice(), 'notes', 'globex__n1'))));
test('cannot change a document\'s app', () =>
  assertFails(updateDoc(doc(alice(), 'notes', 'acme__n1'), { appId: 'billing' })));

// Status
test('a suspended user is locked out everywhere', () =>
  assertFails(getDoc(doc(dave(), 'notes', 'acme__n1'))));
test('a user with no index is locked out', () =>
  assertFails(getDoc(doc(nobody(), 'notes', 'acme__n1'))));

// The id prefix still applies
test('creates on an id tagged with your tenant', () =>
  assertSucceeds(setDoc(doc(alice(), 'notes', 'acme__n2'), { tenantId: 'acme', appId: 'notes' })));
test('cannot squat an id tagged with another tenant', () =>
  assertFails(setDoc(doc(alice(), 'notes', 'globex__n2'), { tenantId: 'acme', appId: 'notes' })));

// Collection group queries
test('a collection group query filtered to your tenant and app is allowed', () =>
  assertSucceeds(getDocs(query(collectionGroup(alice(), 'comments'),
    where('tenantId', '==', 'acme'), where('appId', '==', 'notes')))));
test('an unfiltered collection group query fails', () =>
  assertFails(getDocs(collectionGroup(alice(), 'comments'))));

// Clients cannot seed an access index
const forged = {
  tenantId: 'acme', appId: 'notes', status: 'active', tenants: ['acme', 'globex'],
  permissions: { globex: { notes: ['read', 'create', 'update', 'delete'] } },
};
test('control: the same payload is accepted in an ordinary collection', () =>
  assertSucceeds(setDoc(doc(alice(), 'notes', 'acme__forged'), forged)));
test('cannot create an access index, even on an id the tag check would accept', () =>
  assertFails(setDoc(doc(alice(), 'access_index', 'acme__forged'), forged)));
test('cannot create an access index for a second account', () =>
  assertFails(setDoc(doc(alice(), 'access_index', 'mallory'), forged)));
test('cannot read your own access index', () =>
  assertFails(getDoc(doc(alice(), 'access_index', 'alice'))));
