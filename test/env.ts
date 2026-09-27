import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

// Each suite gets its own project id, so different rule files can share one emulator.
export const firestoreEnv = (projectId: string, rulesFile: string) =>
  initializeTestEnvironment({
    projectId,
    firestore: { host: '127.0.0.1', port: 8181, rules: readFileSync(rulesFile, 'utf8') },
  });

export const storageEnv = (projectId: string) =>
  initializeTestEnvironment({
    projectId,
    storage: { host: '127.0.0.1', port: 9199, rules: readFileSync('rules/storage.rules', 'utf8') },
  });
