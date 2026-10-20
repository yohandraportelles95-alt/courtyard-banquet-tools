import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

export const TERMS = [
  'Rooms may only be reserved by calling hotel direct: 972 446 0001.',
  'Certificate must be presented at check in.',
  'All bookings are subject to availability, and blackout dates may apply.',
  'Redeemable for weekend stays only.',
  'Valid only for Courtyard Carrollton, 1201 Raiford Road, Carrollton, TX 75007.',
  'Certificate cannot be redeemed for cash.'
].join('\n');
export class AppError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date()); }
export function text(value, label, max = 300, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new AppError(`Check ${label}.`);
  return value.trim();
}
export function date(value, label, required = true) {
  if (!value && !required) return '';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new AppError(`Check ${label}.`);
  return value;
}
export function number(value) {
  const match = String(value ?? '').trim().match(/^(\d{4})\s*[--]\s*(\d{1,6})$/);
  if (!match || +match[2] < 1) throw new AppError('Use a certificate number such as 2026-04.');
  return `${match[1]}-${String(+match[2]).padStart(2, '0')}`;
}
function entry(input, legacy = false) {
  const issuedDate = date(input.issuedDate, 'issue date', !legacy);
  const expires = date(input.expires, 'expiration date', !legacy);
  if (issuedDate && expires && expires < issuedDate) throw new AppError('Expiration cannot be before the issue date.');
  return {
    recipient: text(input.recipient ?? '', 'recipient', 200),
    organization: text(input.organization ?? '', 'organization', 200),
    benefit: text(input.benefit ?? 'One night complimentary stay', 'certificate benefit', 300, true),
    issuedBy: text(input.issuedBy ?? '', 'issued by', 150, !legacy),
    issuedDate, expires,
    terms: text(input.terms ?? TERMS, 'terms', 4000, true),
    notes: text(input.notes ?? '', 'notes', 3000),
  };
}
export function openStore(filename = ':memory:') {
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), ready INTEGER NOT NULL DEFAULT 0);
    INSERT OR IGNORE INTO settings(id) VALUES(1);
    CREATE TABLE IF NOT EXISTS counters(year INTEGER PRIMARY KEY, last INTEGER NOT NULL CHECK(last>=0));
    CREATE TABLE IF NOT EXISTS certificates (
      id TEXT PRIMARY KEY, number TEXT UNIQUE NOT NULL, recipient TEXT NOT NULL, organization TEXT NOT NULL,
      benefit TEXT NOT NULL, issuedBy TEXT NOT NULL, issuedDate TEXT NOT NULL, expires TEXT NOT NULL,
      terms TEXT NOT NULL, notes TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN('issued','redeemed','void')),
      redeemedDate TEXT NOT NULL DEFAULT '', redeemedBy TEXT NOT NULL DEFAULT '', confirmation TEXT NOT NULL DEFAULT '',
      legacy INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, certificateId TEXT, action TEXT NOT NULL, details TEXT NOT NULL, at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS issue_requests (requestKey TEXT PRIMARY KEY, certificateId TEXT NOT NULL, payload TEXT NOT NULL);
  `);
  function transaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function log(id, action, details) { db.prepare('INSERT INTO audit VALUES(?,?,?,?,?)').run(randomUUID(), id, action, JSON.stringify(details), new Date().toISOString()); }
  function get(id) { const row = db.prepare('SELECT * FROM certificates WHERE id=?').get(id); if (!row) throw new AppError('Certificate not found.', 404); return row; }
  function insert(row, no, legacy, state = 'issued') {
    const id = randomUUID(), now = new Date().toISOString();
    db.prepare(`INSERT INTO certificates(id,number,recipient,organization,benefit,issuedBy,issuedDate,expires,terms,notes,state,legacy,createdAt,updatedAt)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,no,row.recipient,row.organization,row.benefit,row.issuedBy,row.issuedDate,row.expires,row.terms,row.notes,state,legacy?1:0,now,now);
    const [year, seq] = no.split('-').map(Number);
    db.prepare('INSERT INTO counters(year,last) VALUES(?,?) ON CONFLICT(year) DO UPDATE SET last=max(last,excluded.last)').run(year, seq);
    return get(id);
  }
  return {
    db,
    list() { return db.prepare('SELECT * FROM certificates ORDER BY substr(number,1,4) DESC, CAST(substr(number,6) AS INTEGER) DESC').all(); },
    settings() { return { ready: !!db.prepare('SELECT ready FROM settings WHERE id=1').get().ready, today: today(), terms: TERMS }; },
    issue(input) {
      const row = entry(input);
      const requestKey = text(input.requestKey, 'request identifier', 100, true);
      if (!row.recipient && !row.organization) throw new AppError('Enter a recipient or organization.');
      if (row.issuedDate > today()) throw new AppError('Issue date cannot be in the future.');
      if (row.expires < today()) throw new AppError('A new certificate must not already be expired.');
      return transaction(() => {
        const prior = db.prepare('SELECT * FROM issue_requests WHERE requestKey=?').get(requestKey);
        if (prior) {
          if (prior.payload !== JSON.stringify(row)) throw new AppError('This save request was already used with different details. Close and reopen the form.',409);
          return get(prior.certificateId);
        }
        if (!this.settings().ready) throw new AppError('Import and verify the existing log before issuing certificates.', 409);
        const year = Number(row.issuedDate.slice(0,4));
        const last = db.prepare('SELECT last FROM counters WHERE year=?').get(year)?.last ?? 0;
        const saved = insert(row, `${year}-${String(last + 1).padStart(2,'0')}`, false);
        db.prepare('INSERT INTO issue_requests VALUES(?,?,?)').run(requestKey,saved.id,JSON.stringify(row));
        log(saved.id,'issued',{number:saved.number,issuedBy:row.issuedBy}); return saved;
      });
    },
    importRows(rows, confirmComplete) {
      if (!Array.isArray(rows) || rows.length < 1 || rows.length > 5000) throw new AppError('Import between 1 and 5,000 rows.');
      if (confirmComplete !== true) throw new AppError('Confirm that this is the complete historical certificate log.');
      const seen = new Set();
      const parsed = rows.map((input, index) => {
        try {
          const no = number(input.number), row = entry(input,true);
          if (seen.has(no)) throw new AppError(`Duplicate number ${no} in the import.`);
          seen.add(no);
          const state = input.state || 'issued';
          if (!['issued','redeemed','void'].includes(state)) throw new AppError('Check redemption status.');
          const redeemedDate = date(input.redeemedDate,'redemption date',false);
          if (redeemedDate && state !== 'redeemed') throw new AppError('A redemption date requires redeemed status.');
          if (redeemedDate && redeemedDate > today()) throw new AppError('Redemption date cannot be in the future.');
          return {no,row,state,redeemedDate};
        } catch (e) { throw new AppError(`Row ${index+1}: ${e.message}`); }
      });
      return transaction(() => {
        let added = 0, skipped = 0;
        for (const {no,row,state,redeemedDate} of parsed) {
          const existing = db.prepare('SELECT * FROM certificates WHERE number=?').get(no);
          if (existing) {
            if (Object.keys(row).some(key => existing[key] !== row[key]) || existing.state !== state || existing.redeemedDate !== redeemedDate) throw new AppError(`Number ${no} already exists with different details. Nothing was imported.`,409);
            skipped++; continue;
          }
          const saved = insert(row,no,true,state);
          if (redeemedDate) db.prepare('UPDATE certificates SET redeemedDate=? WHERE id=?').run(redeemedDate,saved.id);
          log(saved.id,'imported',{number:no}); added++;
        }
        db.prepare('UPDATE settings SET ready=1 WHERE id=1').run();
        log(null,'log_verified',{added,skipped}); return {added,skipped};
      });
    },
    redeem(id,input) {
      const redeemedDate = date(input.redeemedDate,'redemption date');
      const redeemedBy = text(input.redeemedBy,'redeemed by',150,true);
      const confirmation = text(input.confirmation ?? '', 'confirmation number',150);
      if (redeemedDate > today()) throw new AppError('Redemption date cannot be in the future.');
      return transaction(() => {
        const row = get(id);
        if (row.state !== 'issued') throw new AppError('This certificate has already been redeemed or voided.',409);
        if (row.issuedDate && redeemedDate < row.issuedDate) throw new AppError('Redemption cannot be before the issue date.');
        if (row.expires && redeemedDate > row.expires) throw new AppError('This certificate was expired on the redemption date.');
        db.prepare("UPDATE certificates SET state='redeemed',redeemedDate=?,redeemedBy=?,confirmation=?,updatedAt=? WHERE id=?").run(redeemedDate,redeemedBy,confirmation,new Date().toISOString(),id);
        log(id,'redeemed',{redeemedDate,redeemedBy,confirmation}); return get(id);
      });
    },
    void(id,input) {
      const reason = text(input.reason,'void reason',1000,true);
      return transaction(() => {
        const row = get(id);
        if (row.state !== 'issued') throw new AppError('Only an unredeemed certificate can be voided.',409);
        db.prepare("UPDATE certificates SET state='void',updatedAt=? WHERE id=?").run(new Date().toISOString(),id);
        log(id,'voided',{reason}); return get(id);
      });
    },
    history(id) { get(id); return db.prepare('SELECT * FROM audit WHERE certificateId=? ORDER BY at').all(id); },
    close() { db.close(); }
  };
}
