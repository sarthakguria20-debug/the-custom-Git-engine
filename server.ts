import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import { createServer as createViteServer } from 'vite';

const REPO_DIR = path.join(process.cwd(), '.git-sandbox');

function getMgitDir() {
  return path.join(REPO_DIR, '.mgit');
}

// Reset workspace entirely on server start for clean sandbox
if (fs.existsSync(REPO_DIR)) {
  fs.rmSync(REPO_DIR, { recursive: true, force: true });
}
fs.mkdirSync(REPO_DIR, { recursive: true });

function createObject(type: string, content: Buffer) {
  const header = `${type} ${content.length}\0`;
  const store = Buffer.concat([Buffer.from(header), content]);
  const hash = crypto.createHash('sha1').update(store).digest('hex');
  const compressed = zlib.deflateSync(store);

  const objDir = path.join(getMgitDir(), 'objects', hash.substring(0, 2));
  const objFile = path.join(objDir, hash.substring(2));
  if (!fs.existsSync(objDir)) fs.mkdirSync(objDir, { recursive: true });
  if (!fs.existsSync(objFile)) fs.writeFileSync(objFile, compressed);

  return hash;
}

function createTree(entries: { mode: string; path: string; hash: string }[]) {
  // Sort entries by path name for consistency
  const sortedEntries = [...entries].sort((a, b) => a.path.localeCompare(b.path));
  const buffers = sortedEntries.map((entry) => {
    return Buffer.concat([
      Buffer.from(`${entry.mode} ${entry.path}\0`),
      Buffer.from(entry.hash, 'hex'),
    ]);
  });
  const treeContent = Buffer.concat(buffers);
  return createObject('tree', treeContent);
}

// --- EXPRESS APP SETUP ---

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Init Git Repository
  app.post('/api/init', (req, res) => {
    const mgitDir = getMgitDir();
    if (fs.existsSync(mgitDir)) return res.status(400).json({ error: 'Already initialized' });
    
    fs.mkdirSync(mgitDir, { recursive: true });
    fs.mkdirSync(path.join(mgitDir, 'objects'));
    fs.mkdirSync(path.join(mgitDir, 'refs', 'heads'), { recursive: true });
    fs.writeFileSync(path.join(mgitDir, 'HEAD'), 'ref: refs/heads/master\n');
    fs.writeFileSync(path.join(mgitDir, 'index'), JSON.stringify([]));

    res.json({ success: true, message: 'Initialized empty Git repository in .mgit/' });
  });

  // Write file to Workspace
  app.post('/api/file', (req, res) => {
    const { filename, content } = req.body;
    if (!filename || typeof content !== 'string') return res.status(400).json({ error: 'Invalid body' });
    fs.writeFileSync(path.join(REPO_DIR, filename), content);
    res.json({ success: true, message: `File ${filename} updated.` });
  });

  // Delete file from workspace
  app.delete('/api/file/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(REPO_DIR, filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
    res.json({ success: true });
  });

  // Read file from workspace
  app.get('/api/file/:filename', (req, res) => {
    const { filename } = req.params;
    const filepath = path.join(REPO_DIR, filename);
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Not found' });
    const content = fs.readFileSync(filepath, 'utf8');
    res.json({ content });
  });

  // Git Add
  app.post('/api/add', (req, res) => {
    try {
      const { filename } = req.body;
      const filepath = path.join(REPO_DIR, filename);
      if (!fs.existsSync(filepath)) return res.status(400).json({ error: 'File not found' });
      
      const content = fs.readFileSync(filepath);
      const hash = createObject('blob', content);

      const indexFile = path.join(getMgitDir(), 'index');
      if (!fs.existsSync(indexFile)) throw new Error('Repository not initialized');
      let index: any[] = JSON.parse(fs.readFileSync(indexFile, 'utf8'));

      const existing = index.find((e) => e.path === filename);
      if (existing) {
        existing.hash = hash;
      } else {
        index.push({ path: filename, hash: hash, mode: '100644' });
      }

      fs.writeFileSync(indexFile, JSON.stringify(index, null, 2));
      res.json({ success: true, hash, message: `Added ${filename} to index.` });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Git Commit
  app.post('/api/commit', (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: 'Commit message required' });

      const indexFile = path.join(getMgitDir(), 'index');
      if (!fs.existsSync(indexFile)) return res.status(400).json({ error: 'Repository not initialized' });
      const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
      
      if (index.length === 0) return res.status(400).json({ error: 'Nothing to commit (index is empty)' });

      const treeHash = createTree(index);

      let parentHash = null;
      const headContent = fs.readFileSync(path.join(getMgitDir(), 'HEAD'), 'utf8').trim();
      const refMatch = headContent.match(/ref: (.*)/);
      let refPath = '';
      if (refMatch) {
         refPath = refMatch[1];
         const refPathFull = path.join(getMgitDir(), refPath);
         if (fs.existsSync(refPathFull)) {
           parentHash = fs.readFileSync(refPathFull, 'utf8').trim();
         }
      } else {
        // detached HEAD maybe? For this scope, let's keep it simple.
        parentHash = headContent; 
      }

      let commitContent = `tree ${treeHash}\n`;
      if (parentHash) commitContent += `parent ${parentHash}\n`;
      commitContent += `author SDE Challenger <challenge@example.com> ${Math.floor(Date.now() / 1000)} +0000\n`;
      commitContent += `committer SDE Challenger <challenge@example.com> ${Math.floor(Date.now() / 1000)} +0000\n\n`;
      commitContent += message + '\n';

      const commitHash = createObject('commit', Buffer.from(commitContent));

      // Update refs
      if (refPath) {
        fs.writeFileSync(path.join(getMgitDir(), refPath), commitHash + '\n');
      } else {
        fs.writeFileSync(path.join(getMgitDir(), 'HEAD'), commitHash + '\n');
      }

      res.json({ success: true, hash: commitHash, message: `Created commit ${commitHash}` });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Status/Inspect
  app.get('/api/status', (req, res) => {
    const mgitDir = getMgitDir();
    const repoExists = fs.existsSync(mgitDir);

    let workspaceFiles = [];
    if (fs.existsSync(REPO_DIR)) {
      workspaceFiles = fs.readdirSync(REPO_DIR).filter((f) => f !== '.mgit');
    }

    let index = [];
    if (repoExists && fs.existsSync(path.join(mgitDir, 'index'))) {
      index = JSON.parse(fs.readFileSync(path.join(mgitDir, 'index'), 'utf8'));
    }

    let objects: { hash: string, type: string, size: string }[] = [];
    if (repoExists) {
      const objRoot = path.join(mgitDir, 'objects');
      if (fs.existsSync(objRoot)) {
        const dirs = fs.readdirSync(objRoot);
        for (const dir of dirs) {
          if (dir.length !== 2) continue;
          const files = fs.readdirSync(path.join(objRoot, dir));
          for (const file of files) {
            const hash = dir + file;
            // Peek at type and size safely
            try {
              const objFile = path.join(objRoot, dir, file);
              const compressed = fs.readFileSync(objFile);
              const store = zlib.inflateSync(compressed);
              const nullIdx = store.indexOf(0);
              const header = store.subarray(0, nullIdx).toString('utf8');
              const [type, size] = header.split(' ');
              objects.push({ hash, type, size });
            } catch (e) {
               // ignore corrupted objects
            }
          }
        }
      }
    }

    let head = null;
    let masterHash = null;
    let headTarget = null;
    if (repoExists) {
      const headContent = fs.readFileSync(path.join(mgitDir, 'HEAD'), 'utf8').trim();
      head = headContent;
      if (headContent.startsWith('ref: ')) {
         headTarget = headContent.split(': ')[1];
         const rPath = path.join(mgitDir, headTarget);
         if (fs.existsSync(rPath)) {
            masterHash = fs.readFileSync(rPath, 'utf8').trim();
         }
      }
    }

    res.json({ repoExists, workspaceFiles, index, objects, head, masterHash, headTarget });
  });

  // Get Object Contents
  app.get('/api/object/:hash', (req, res) => {
    const hash = req.params.hash;
    if (!hash || hash.length < 40) return res.status(400).json({ error: 'Invalid hash' });
    const objFile = path.join(getMgitDir(), 'objects', hash.substring(0, 2), hash.substring(2));
    if (!fs.existsSync(objFile)) return res.status(404).json({ error: 'Object not found' });

    try {
      const compressed = fs.readFileSync(objFile);
      const store = zlib.inflateSync(compressed);
      const nullIdx = store.indexOf(0);
      const header = store.subarray(0, nullIdx).toString('utf8');
      const [type, size] = header.split(' ');
      const contentBytes = store.subarray(nullIdx + 1);

      let content;
      if (type === 'blob' || type === 'commit') {
        content = contentBytes.toString('utf8');
      } else if (type === 'tree') {
        const entries = [];
        let i = 0;
        while (i < contentBytes.length) {
          const spaceIdx = contentBytes.indexOf(0x20, i);
          const nullIdxEnt = contentBytes.indexOf(0, spaceIdx);
          const mode = contentBytes.subarray(i, spaceIdx).toString('utf8');
          const name = contentBytes.subarray(spaceIdx + 1, nullIdxEnt).toString('utf8');
          const entryHash = contentBytes.subarray(nullIdxEnt + 1, nullIdxEnt + 21).toString('hex');
          entries.push({ mode, name, hash: entryHash });
          i = nullIdxEnt + 21;
        }
        content = entries;
      }

      res.json({ type, size, content });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
