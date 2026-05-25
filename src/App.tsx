import { useEffect, useState } from 'react';
import { Terminal, File, HardDrive, GitCommit, GitMerge, FileText, Database, Plus, Save, Trash, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Types
interface GitObject {
  hash: string;
  type: string;
  size: string;
}

interface IndexEntry {
  path: string;
  hash: string;
  mode: string;
}

interface Status {
  repoExists: boolean;
  workspaceFiles: string[];
  index: IndexEntry[];
  objects: GitObject[];
  head: string | null;
  masterHash: string | null;
  headTarget: string | null;
}

export default function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [commitMsg, setCommitMsg] = useState<string>('');
  const [selectedObjectHash, setSelectedObjectHash] = useState<string | null>(null);
  const [objectView, setObjectView] = useState<{type: string, content: any} | null>(null);

  const fetchStatus = async () => {
    const res = await fetch('/api/status');
    const data = await res.json();
    setStatus(data);
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const initRepo = async () => {
    await fetch('/api/init', { method: 'POST' });
    fetchStatus();
  };

  const loadFile = async (name: string) => {
    const res = await fetch(`/api/file/${name}`);
    if (res.ok) {
      const data = await res.json();
      setFileContent(data.content);
      setSelectedFile(name);
    }
  };

  const saveFile = async () => {
    if (!selectedFile) return;
    await fetch('/api/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: selectedFile, content: fileContent })
    });
    fetchStatus();
  };

  const deleteFile = async (name: string) => {
    await fetch(`/api/file/${name}`, { method: 'DELETE' });
    if (selectedFile === name) {
      setSelectedFile(null);
      setFileContent('');
    }
    fetchStatus();
  };

  const gitAdd = async (filename: string) => {
    await fetch('/api/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    });
    fetchStatus();
  };

  const gitCommit = async () => {
    if (!commitMsg) return;
    await fetch('/api/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: commitMsg })
    });
    setCommitMsg('');
    fetchStatus();
  };

  const loadObject = async (hash: string) => {
    const res = await fetch(`/api/object/${hash}`);
    if (res.ok) {
      const data = await res.json();
      setObjectView({ type: data.type, content: data.content });
      setSelectedObjectHash(hash);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-200 font-sans flex flex-col overflow-hidden">
      {/* Mesh Gradient Background Decorations */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-600/30 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute top-1/2 -right-24 w-80 h-80 bg-cyan-600/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute -bottom-24 left-1/3 w-[500px] h-64 bg-fuchsia-600/20 rounded-full blur-[120px] pointer-events-none"></div>

      <header className="relative z-10 flex items-center justify-between m-6 px-6 py-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Terminal className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Git Engine Explorer</h1>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Status</div>
            <div className="font-mono text-sm bg-slate-900/50 px-2 py-1 rounded border border-white/5 flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${status?.repoExists ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
              {status?.repoExists ? 'Initialized' : 'Not Initialized'}
            </div>
          </div>
          {!status?.repoExists && (
            <>
              <div className="h-10 w-px bg-white/10"></div>
              <button onClick={initRepo} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-indigo-500/20">
                git init
              </button>
            </>
          )}
        </div>
      </header>

      <main className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-6 flex-grow overflow-hidden px-6 pb-6">
        
        {/* Workspace Panel */}
        <section className="flex flex-col bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-xl shadow-black/20">
          <div className="p-4 border-b border-white/10 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-200 uppercase tracking-wider text-xs">Workspace</h2>
          </div>
          <div className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col">
            <div className="space-y-2 mb-6">
              {status?.workspaceFiles.length === 0 && <div className="text-sm text-slate-500 italic">Workspace is empty.</div>}
              {status?.workspaceFiles.map(f => (
                <div key={f} className="flex items-center justify-between group p-3 bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/5 rounded-xl transition-colors">
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => loadFile(f)}>
                    <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400">
                      <FileText className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium text-white">{f}</span>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => gitAdd(f)} className="px-3 py-1.5 bg-white/10 hover:bg-indigo-600 rounded-lg text-xs text-white transition-colors" title="git add">
                      <Plus className="w-3 h-3" />
                    </button>
                    <button onClick={() => deleteFile(f)} className="px-3 py-1.5 bg-white/10 hover:bg-red-600 rounded-lg text-xs text-white transition-colors" title="delete">
                      <Trash className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="bg-slate-900/40 p-4 rounded-xl border border-white/5 mt-auto">
              <h3 className="text-[10px] font-bold uppercase text-slate-500 mb-3">Editor</h3>
              <input 
                type="text" 
                placeholder="Filename (e.g., hello.txt)"
                className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 mb-3 focus:border-indigo-500 outline-none"
                value={selectedFile || ''}
                onChange={e => setSelectedFile(e.target.value)}
              />
              <textarea 
                className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 h-32 focus:border-indigo-500 outline-none font-mono resize-none custom-scrollbar"
                placeholder="File content..."
                value={fileContent}
                onChange={e => setFileContent(e.target.value)}
              />
              <button onClick={saveFile} className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-bold text-white transition-colors shadow-lg shadow-indigo-500/20">
                <Save className="w-4 h-4" /> Save to Workspace
              </button>
            </div>
          </div>
        </section>

        {/* Index & Commit Panel */}
        <section className="flex flex-col bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-200 uppercase tracking-wider text-xs">Staging Area (Index)</h2>
          </div>
          <div className="flex-1 p-4 overflow-y-auto border-white/10 custom-scrollbar flex flex-col">
            <div className="flex flex-col gap-3 mb-6">
              {status?.index.length === 0 && (
                <div className="text-sm text-slate-500 italic p-3 bg-white/5 rounded-xl border border-white/5">No files staged.</div>
              )}
              {status?.index.map(entry => (
                <div key={entry.path} className="group relative bg-white/5 hover:bg-white/10 rounded-xl p-3 border border-emerald-500/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-500/20 rounded flex items-center justify-center text-emerald-400">
                      <File className="w-4 h-4" />
                    </div>
                    <div className="flex-grow">
                      <div className="text-sm font-medium text-white">{entry.path}</div>
                      <div className="text-[10px] text-slate-500 font-mono" title={entry.hash}>{entry.hash.substring(0, 8)}...</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-slate-900/40 p-4 rounded-xl border border-white/5 mt-auto mb-4">
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2 flex items-center gap-2">
                <GitCommit className="w-4 h-4" /> Commit Message
              </label>
              <textarea 
                className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 mb-3 focus:border-indigo-500 outline-none h-16 resize-none"
                placeholder="Describe the snapshot changes..."
                value={commitMsg}
                onChange={e => setCommitMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && gitCommit()}
              />
              <button 
                onClick={gitCommit}
                disabled={status?.index.length === 0 || !commitMsg}
                className="w-full py-3 bg-white hover:bg-slate-200 text-slate-950 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors shadow-xl shadow-white/10"
              >
                EXECUTE SNAPSHOT
              </button>
              <p className="mt-3 text-center text-[10px] text-slate-500 italic">
                Creates new Commit, Tree, and Blob objects in the Merkle store.
              </p>
            </div>
            
            <div className="pt-4 border-t border-white/10">
              <h3 className="text-[10px] font-bold uppercase text-slate-500 mb-2">Refs</h3>
              <div className="text-xs font-mono space-y-2">
                <div className="flex gap-2">
                  <span className="text-slate-400">HEAD:</span>
                  <span className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">{status?.head || 'none'}</span>
                </div>
                {status?.masterHash && (
                  <div className="flex gap-2">
                    <span className="text-slate-400">master:</span>
                    <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">{status.masterHash.substring(0,8)}...</span>
                  </div>
                )}
              </div>
            </div>

          </div>
        </section>

        {/* Object Database Panel */}
        <section className="flex flex-col bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">
           <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-400" />
              <h2 className="font-semibold text-slate-200 uppercase tracking-wider text-xs">Object Store (CAS)</h2>
            </div>
            <button onClick={fetchStatus} className="text-slate-400 hover:text-white transition-colors" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-4">
            
            <div className="grid grid-cols-2 lg:grid-cols-2 gap-3">
              {status?.objects.map(obj => (
                <div 
                  key={obj.hash}
                  onClick={() => loadObject(obj.hash)}
                  className={`cursor-pointer rounded-xl p-3 flex flex-col gap-2 transition-all shadow-lg ${selectedObjectHash === obj.hash ? 'bg-white/10 border border-indigo-500/50 shadow-indigo-500/20' : 'bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10'}`}
                >
                  <div className="flex justify-between items-start">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${obj.type === 'commit' ? 'bg-amber-500/20 text-amber-400' : obj.type === 'tree' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                      {obj.type}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{obj.hash.substring(0,6)}</span>
                  </div>
                  <div className="mt-auto pt-2 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[9px] text-slate-500">{obj.size} bytes</span>
                  </div>
                </div>
              ))}
              {status?.objects.length === 0 && <span className="text-sm text-slate-500 italic col-span-2">No objects found.</span>}
            </div>

            <AnimatePresence>
              {objectView && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 mt-auto shadow-2xl"
                >
                  <h3 className="text-[10px] font-bold uppercase text-slate-400 mb-3 flex items-center justify-between">
                    Object Content
                    <span className="text-[9px] bg-slate-800 border border-white/5 px-2 py-1 rounded text-slate-300 font-mono">Inflated via zlib</span>
                  </h3>
                  {objectView.type === 'blob' && (
                    <pre className="font-mono text-[10px] xl:text-xs text-amber-200 whitespace-pre-wrap bg-slate-950/50 p-3 rounded-xl border border-white/5 custom-scrollbar max-h-48 overflow-y-auto">{objectView.content}</pre>
                  )}
                  {objectView.type === 'tree' && (
                    <div className="space-y-1 bg-slate-950/50 p-2 rounded-xl border border-white/5 max-h-48 overflow-y-auto custom-scrollbar">
                      {objectView.content.map((ent: any, i: number) => (
                        <div key={i} className="flex gap-3 font-mono text-[10px] xl:text-xs bg-white/5 p-2 rounded-lg items-center text-slate-300">
                          <span className="text-slate-500">{ent.mode}</span>
                          <span className="text-emerald-300 truncate max-w-[100px]">{ent.name}</span>
                          <span className="text-slate-400 ml-auto whitespace-nowrap">{ent.hash.substring(0,8)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {objectView.type === 'commit' && (
                    <pre className="font-mono text-[10px] xl:text-xs text-purple-300 whitespace-pre-wrap bg-slate-950/50 p-3 rounded-xl border border-white/5 custom-scrollbar max-h-48 overflow-y-auto">{objectView.content}</pre>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </section>
      </main>
    </div>
  );
}
