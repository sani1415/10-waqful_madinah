import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { due, slotFor, selected, retentionPlan, validateMarker, validateObjectPath, digestFile, hash, assertConfig, command, removeTempDirectory } from '../lib.mjs';
import { countCopyRows, verifyCounts } from '../verify.mjs';
import config from '../config.json' with { type: 'json' };
import { sealConfig, openConfig } from '../credential-state.mjs';
import { randomBytes } from 'node:crypto';
import { X509Certificate } from 'node:crypto';
import { connectionOptions } from '../database-connect.mjs';

test('database TLS trusts the vendor CA while retaining hostname verification', () => {
  const options = connectionOptions('postgresql://postgres:synthetic@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require');
  assert.equal(options.ssl.rejectUnauthorized, true);
  assert.equal(new URL(options.connectionString).searchParams.has('sslmode'), false);
  const ca = new X509Certificate(options.ssl.ca);
  assert.equal(ca.ca, true);
  assert.match(ca.subject, /Supabase Root 2021 CA/);
  assert.ok(Date.parse(ca.validTo) > Date.now());
});

test('rotated Microsoft credential state is authenticated and repository-bound', () => {
  const key = randomBytes(32).toString('base64'), plain = Buffer.from('synthetic OAuth fixture');
  const state = sealConfig(plain, key, 'owner/repo');
  assert.deepEqual(openConfig(state, key, 'owner/repo'), plain);
  assert.throws(() => openConfig(state, key, 'other/repo'));
  const changed = JSON.parse(state); changed.tag = randomBytes(16).toString('base64');
  assert.throws(() => openConfig(JSON.stringify(changed), key, 'owner/repo'));
});

test('three-day cadence crosses month/year boundaries without a day-of-month cron', () => {
  const last = { slot: '2026-12-30T20:17:00.000Z' };
  assert.equal(due(last, '2027-01-02T20:16:59Z', config), false);
  assert.equal(due(last, '2027-01-02T20:17:00Z', config), true);
  assert.equal(due(null, '2026-10-13T10:00:00Z', config), true);
  assert.equal(slotFor('2026-10-13T20:18:00Z', config), '2026-10-13T20:17:00.000Z');
  // A run finishing late must not silently turn a three-day interval into four days.
  assert.equal(due({ slot: '2026-10-13T20:17:00Z', completedAt: '2026-10-13T21:00:00Z' }, '2026-10-16T20:18:00Z', config), true);
});
test('application rows remain separated; all present/future mdr submodules are covered', () => {
  assertConfig(config);
  const [waqf, idarah] = config.projects;
  assert.equal(selected(waqf, 'public', 'mdr_shared_users'), false);
  assert.equal(selected(idarah, 'public', 'waqf_messages'), false);
  assert.equal(selected(idarah, 'public', 'mdr_dept_expenses'), true);
  assert.equal(selected(idarah, 'private', 'mdr_sessions'), true);
  assert.equal(selected(idarah, 'public', 'nt_notes'), false);
});
test('retention preserves shared blobs needed by any of the latest three snapshots', () => {
  const plan = retentionPlan([1,2,3,4].map(n => ({ completedAt: `2026-10-${String(n).padStart(2,'0')}T00:00:00Z`, folder: String(n), objects: [{ name: n === 1 || n === 3 ? 'shared.age' : `file${n}.age` }] })));
  assert.deepEqual(plan.remove.map(m => m.folder), ['1']);
  assert.equal(plan.referenced.has('shared.age'), true);
});
test('corrupt markers and traversal paths stop retention/extraction', () => {
  assert.throws(() => validateMarker({ format: 1 }, '../', 'waqf'));
  for (const name of ['../file','a/../../file','/file','a\\file','a//file']) assert.throws(() => validateObjectPath(name));
  assert.equal(validateObjectPath('documents/রাফি.pdf'), 'documents/রাফি.pdf');
});
test('SQL archive row verification counts escaped multiline text and rejects missing rows', async () => {
  const work = await mkdtemp(join(tmpdir(), 'backup-test-'));
  try {
    const file = join(work, 'data.sql');
    await writeFile(file, 'COPY public.waqf_messages (id, text) FROM stdin;\n1\ttext\\nsecond line\n2\t\\\\.\n\\.\n');
    const counts = await countCopyRows(file);
    verifyCounts({ 'public.waqf_messages': '2', 'public.waqf_students': '0' }, counts);
    assert.throws(() => verifyCounts({ 'public.waqf_messages': '3' }, counts));
    assert.throws(() => verifyCounts({}, counts));
    await writeFile(file, 'COPY public.waqf_messages (id) FROM stdin;\n1\n');
    await assert.rejects(() => countCopyRows(file));
  } finally { await removeTempDirectory(work, 'backup-test-'); }
});
test('byte verification detects corrupted uploads', async () => {
  const work = await mkdtemp(join(tmpdir(), 'backup-test-'));
  try {
    const file = join(work, 'object'); await writeFile(file, 'original');
    assert.equal((await digestFile(file)).sha256, hash('original'));
    await writeFile(file, 'modified'); assert.notEqual((await digestFile(file)).sha256, hash('original'));
  } finally { await removeTempDirectory(work, 'backup-test-'); }
});

const ageBinary = process.env.AGE_BIN || (process.platform === 'win32' ? join(process.env.LOCALAPPDATA || '', 'WaqfBackupTools', 'age.exe') : 'age');
test('real age encryption roundtrip and authenticated tamper rejection', { skip: process.platform === 'win32' && !existsSync(ageBinary) }, async () => {
  const work = await mkdtemp(join(tmpdir(), 'backup-crypto-test-'));
  try {
    const keygen = process.platform === 'win32' ? ageBinary.replace(/age\.exe$/, 'age-keygen.exe') : 'age-keygen';
    const key = join(work, 'key'), plain = join(work, 'plain'), encrypted = join(work, 'encrypted'), recovered = join(work, 'recovered');
    await command(keygen, ['-o', key]);
    const recipient = (await command(keygen, ['-y', key], { capture: true })).trim();
    await writeFile(plain, 'Synthetic Bengali backup fixture: পরীক্ষার মেসেজ');
    await command(ageBinary, ['-r', recipient, '-o', encrypted, plain]);
    await command(ageBinary, ['-d', '-i', key, '-o', recovered, encrypted]);
    assert.deepEqual(await digestFile(plain), await digestFile(recovered));
    const { readFile } = await import('node:fs/promises');
    const corrupted = await readFile(encrypted); corrupted[corrupted.length - 1] ^= 1;
    await writeFile(encrypted, corrupted); await rm(recovered);
    await assert.rejects(() => command(ageBinary, ['-d', '-i', key, '-o', recovered, encrypted]));
  } finally { await removeTempDirectory(work, 'backup-crypto-test-'); }
});
