// Point `firebase/firestore` at this file with a build alias (see README).
import * as fs from '@firebase/firestore';
export * from '@firebase/firestore';
import { activeTenant } from './session.ts';

// Idempotent: an id read off a snapshot can go straight back in.
const tag = (id: string) => {
  const p = activeTenant() + '__';
  return id.startsWith(p) ? id : p + id;
};

// 'settings', 'main' → 'settings', 'acme__main'. Ids sit at odd positions.
export const doc = (db: any, ...path: string[]) =>
  fs.doc(db, ...path.map((s, i) => (i % 2 ? tag(s) : s)));

// The SDK picks the id, so tag it before writing.
export const addDoc = async (ref: any, data: any) => {
  const d = fs.doc(ref, tag(fs.doc(ref).id));
  await fs.setDoc(d, { ...data, tenantId: activeTenant() });
  return d;
};

export const setDoc = (ref: any, data: any, options?: any) =>
  fs.setDoc(ref, { ...data, tenantId: activeTenant() }, options);

export const query = (ref: any, ...clauses: any[]) =>
  fs.query(ref, fs.where('tenantId', '==', activeTenant()), ...clauses);

// A bare collection routes through query.
export const getDocs = (ref: any) =>
  fs.getDocs(ref.type === 'collection' ? query(ref) : ref);
