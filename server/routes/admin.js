import { Router } from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { requireAdmin } from '../lib/auth.js';
import { factoryReset } from '../seed.js';
import { broadcast } from '../lib/broadcast.js';
import { getFullState } from '../lib/state.js';
import { db } from '../db.js';

const router = Router();

router.post('/factory-reset', requireAdmin, (req, res) => {
  factoryReset();
  broadcast('state', getFullState());
  res.json({ ok: true });
});

// Streams a consistent snapshot of the SQLite DB as a download.
// Uses better-sqlite3's backup API (safe under WAL, unlike a raw file copy).
router.get('/backup', requireAdmin, async (req, res) => {
  const stamp = new Date().toISOString().slice(0, 10);
  const dest = path.join(os.tmpdir(), `bbh-backup-${Date.now()}.db`);
  try {
    await db.backup(dest);
    res.download(dest, `transy-scramble-${stamp}.db`, () => {
      fs.unlink(dest, () => {});
    });
  } catch (e) {
    fs.unlink(dest, () => {});
    res.status(500).json({ error: 'backup failed' });
  }
});

export default router;
