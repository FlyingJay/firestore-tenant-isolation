// The one-rule version: membership from a custom claim, tenant on every document,
// tenant prefix on every new id. Raw SDK, no shim.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { assertSucceeds, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, updateDoc, collection, collectionGroup, query, where } from 'firebase/firestore';
import { firestoreEnv } from './env.ts';

let env: RulesTestEnvironment;
before(async () => {
  env = await firestoreEnv('demo-claims', 'rules/firestore.claims.rules');
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const t of ['acme', 'globex']) {
      await setDoc(doc(db, 'notes', `${t}__n1`), { tenantId: t, title: t });
      await setDoc(doc(db, 'notes', `${t}__n1`, 'comments', `${t}__c1`), { tenantId: t, body: t });
    }
  });
});
after(() => env.cleanup());

const acme = () => env.authenticatedContext('alice', { tenants: ['acme'] }).firestore();
const both = () => env.authenticatedContext('bob', { tenants: ['acme', 'globex'] }).firestore();
const noClaim = () => env.authenticatedContext('carol').firestore();
const anon = () => env.unauthenticatedContext().firestore();

// Reads
test('reads a document in your tenant', () =>
  assertSucceeds(getDoc(doc(acme(), 'notes', 'acme__n1'))));
test('cannot read a document in another tenant', () =>
  assertFails(getDoc(doc(acme(), 'notes', 'globex__n1'))));
test('a missing document reads as denied, so ids cannot be probed', () =>
  assertFails(getDoc(doc(acme(), 'notes', 'acme__nope'))));
test('a caller with no tenants claim reads nothing', () =>
  assertFails(getDoc(doc(noClaim(), 'notes', 'acme__n1'))));
test('an unauthenticated caller reads nothing', () =>
  assertFails(getDoc(doc(anon(), 'notes', 'acme__n1'))));

// Queries
test('a query filtered to your tenant is allowed', async () => {
  const snap = await assertSucceeds(getDocs(query(collection(acme(), 'notes'), where('tenantId', '==', 'acme'))));
  assert.equal(snap.size, 1);
});
test('an unfiltered query fails instead of returning other tenants', () =>
  assertFails(getDocs(collection(acme(), 'notes'))));
test('a query filtered to another tenant fails', () =>
  assertFails(getDocs(query(collection(acme(), 'notes'), where('tenantId', '==', 'globex')))));
test('a two-tenant user can query both with `in`', () =>
  assertSucceeds(getDocs(query(collection(both(), 'notes'), where('tenantId', 'in', ['acme', 'globex'])))));

// Collection group queries
test('a collection group query filtered to your tenant is allowed', async () => {
  const snap = await assertSucceeds(getDocs(query(collectionGroup(acme(), 'comments'), where('tenantId', '==', 'acme'))));
  assert.equal(snap.size, 1);
});
test('an unfiltered collection group query fails', () =>
  assertFails(getDocs(collectionGroup(acme(), 'comments'))));
test('a collection group query filtered to another tenant fails', () =>
  assertFails(getDocs(query(collectionGroup(acme(), 'comments'), where('tenantId', '==', 'globex')))));

// Creates and the id prefix
test('creates on an id tagged with your tenant', () =>
  assertSucceeds(setDoc(doc(acme(), 'settings', 'acme__main'), { tenantId: 'acme' })));
test('cannot squat an id tagged with another tenant', () =>
  assertFails(setDoc(doc(acme(), 'settings', 'globex__main'), { tenantId: 'acme' })));
test('cannot create on an untagged id', () =>
  assertFails(setDoc(doc(acme(), 'settings', 'main'), { tenantId: 'acme' })));
test('cannot create with another tenant on the payload', () =>
  assertFails(setDoc(doc(acme(), 'settings', 'globex__x'), { tenantId: 'globex' })));
test('cannot create without a tenant on the payload', () =>
  assertFails(setDoc(doc(acme(), 'settings', 'acme__y'), { title: 'x' })));
test('the separator is required: tenant acme cannot write acme-2__x', () =>
  assertFails(setDoc(doc(acme(), 'settings', 'acme-2__x'), { tenantId: 'acme' })));
test('the prefix alone is not an id', () =>
  assertFails(setDoc(doc(acme(), 'settings', 'acme__'), { tenantId: 'acme' })));

// Updates
test('updates a document in your tenant', () =>
  assertSucceeds(updateDoc(doc(acme(), 'notes', 'acme__n1'), { title: 'edited' })));
test('a two-tenant user cannot move a document across tenants', () =>
  assertFails(updateDoc(doc(both(), 'notes', 'acme__n1'), { tenantId: 'globex' })));
