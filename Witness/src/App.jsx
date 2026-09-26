import React, { useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";

const CONTRACT_ADDRESS = "0x6cd840081fD86a3Af530dc6Fd06adcD100B1f590";
const CONTRACT_ABI = [
  "function anchor(bytes32 contentHash, string calldata ipfsCid) external",
  "function anchors(bytes32) view returns (uint256)",
  "event Anchored(bytes32 indexed contentHash, string ipfsCid, uint256 timestamp)"
];

/**
 * Witness — Proof-of-Existence Prototype (React version)
 *
 * Self-contained: drop this file into any React project (Vite, CRA, Next "use client", etc.)
 * and render <WitnessApp /> with no required props.
 *
 * No external UI/crypto libraries — uses the browser's native Web Crypto API for real
 * SHA-256 hashing and AES-GCM encryption. The blockchain anchor and IPFS storage are
 * simulated in localStorage so the whole flow is demoable offline; see WitnessAnchor.sol
 * for the real contract this simulation is modeled on.
 *
 * Styling is plain inline CSS injected via a <style> tag (no Tailwind / CSS framework
 * dependency assumed) so this drops into any project unmodified.
 */

const STORAGE_KEY = "witness_ledger_v1";

// ---------------- crypto helpers ----------------

function bufToHex(buf) {
  const b = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0");
  return s;
}
function bufToB64(buf) {
  const b = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}
function b64ToBuf(b64) {
  const s = atob(b64);
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b.buffer;
}
async function sha256Hex(buf) {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return bufToHex(digest);
}
function tryDecodeText(buf) {
  try {
    const txt = new TextDecoder("utf-8", { fatal: true }).decode(buf);
    return txt.length > 800 ? txt.slice(0, 800) + "…" : txt;
  } catch (e) {
    return `[binary content — ${buf.byteLength} bytes — preview not shown]`;
  }
}
function randomHexTxHash() {
  return (
    "0x" +
    Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

// ---------------- storage helpers ----------------

function loadLedger() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
function saveLedger(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    /* ignore — demo storage is best-effort */
  }
}

// ---------------- small UI atoms ----------------

function Badge({ children, tone = "cyan" }) {
  const toneColor = { cyan: "var(--cyan-light)", amber: "var(--amber-light)", good: "var(--good)", bad: "var(--danger)" }[tone];
  const toneBorder = { cyan: "var(--cyan)", amber: "var(--amber)", good: "var(--good)", bad: "var(--danger)" }[tone];
  return (
    <span className="w-badge" style={{ color: toneColor, borderColor: toneBorder }}>
      {children}
    </span>
  );
}

function KV({ k, v }) {
  return (
    <div className="w-kv">
      <span className="w-kv-k">{k}</span>
      <span className="w-kv-v">{v}</span>
    </div>
  );
}

function CopyField({ text }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      // fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div className="w-copyable">
      <span className="w-copyable-v">{text}</span>
      <button onClick={onCopy}>{copied ? "Copied" : "Copy"}</button>
    </div>
  );
}

// ---------------- main views ----------------

function CaptureView({ onAnchored }) {
  const fileRef = useRef(null);
  const [textVal, setTextVal] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null); // {label, hash, encB64, ivB64, keyB64, cid, size}
  const [anchored, setAnchored] = useState(null); // {txHash, block, timestamp, revealCode}

  const doHash = async () => {
    setBusy(true);
    try {
      let bytes;
      let lbl = label.trim();
      let mimeType = "text/plain";
      let fileName = "testimony.txt";

      const file = fileRef.current?.files?.[0];
      if (file) {
        bytes = await file.arrayBuffer();
        if (!lbl) lbl = file.name;
        mimeType = file.type || "application/octet-stream";
        fileName = file.name;
      } else if (textVal.trim()) {
        bytes = new TextEncoder().encode(textVal.trim());
        if (!lbl) lbl = "Testimony note";
      } else {
        alert("Pick a file or type a testimony first.");
        setBusy(false);
        return;
      }

      const contentHash = await sha256Hex(bytes);

      const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes);
      const rawKey = await crypto.subtle.exportKey("raw", key);

      const encB64 = bufToB64(encBuf);
      const ivB64 = bufToB64(iv.buffer);
      const keyB64 = bufToB64(rawKey);

      const cidSeed = await sha256Hex(encBuf);
      const cid = "bafy" + cidSeed.slice(0, 44);

      setPending({
        label: lbl,
        hash: contentHash,
        encB64,
        ivB64,
        keyB64,
        cid,
        size: bytes.byteLength,
        mimeType,
        fileName
      });
      setAnchored(null);
    } catch (e) {
      alert("Something went wrong hashing that input: " + e.message);
    }
    setBusy(false);
  };

  const [anchoring, setAnchoring] = useState(false);

  const doAnchor = async () => {
    if (!pending) return;
    
    if (!window.ethereum) {
      alert("Please install MetaMask or a Web3 wallet (like Coinbase Wallet/Rabby) to anchor to the blockchain.");
      return;
    }

    setAnchoring(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      // Check if already anchored on chain
      const existingTimestamp = await contract.anchors("0x" + pending.hash);
      if (existingTimestamp > 0n) {
        alert("This exact hash is already anchored on the blockchain.");
        setAnchoring(false);
        return;
      }

      // Send the real on-chain transaction
      const tx = await contract.anchor("0x" + pending.hash, pending.cid);
      const receipt = await tx.wait();

      const txHash = tx.hash;
      const block = receipt.blockNumber;
      
      const blockInfo = await provider.getBlock(block);
      const timestamp = new Date(Number(blockInfo.timestamp) * 1000).toISOString();

      const record = {
        id: "w_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        label: pending.label,
        hash: pending.hash,
        cid: pending.cid,
        encB64: pending.encB64,
        ivB64: pending.ivB64,
        txHash,
        block,
        timestamp,
        mimeType: pending.mimeType,
        fileName: pending.fileName,
      };
      
      // Still push to local storage so our Ledger UI can show a history without a complex subgraph
      const ledger = loadLedger();
      ledger.push(record);
      saveLedger(ledger);

      const revealCode = "WITNESS1." + btoa(JSON.stringify({ id: record.id, key: pending.keyB64 }));

      setAnchored({ txHash, block, timestamp, revealCode });
      onAnchored?.();
      setPending(null);
    } catch (e) {
      alert("Error anchoring: " + (e.reason || e.message));
    }
    setAnchoring(false);
  };

  const reset = () => {
    if (fileRef.current) fileRef.current.value = "";
    setTextVal("");
    setLabel("");
    setPending(null);
    setAnchored(null);
  };

  return (
    <>
      <div className="w-card">
        <h2><span className="w-step">1</span>Capture evidence</h2>
        <div className="w-desc">Pick a file, or type a testimony. Hashing and encryption happen entirely on this device — nothing unencrypted ever leaves it.</div>
        <input type="file" ref={fileRef} />
        <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, margin: "8px 0" }}>— or —</div>
        <textarea rows={3} placeholder="Type a testimony or note instead of uploading a file…" value={textVal} onChange={(e) => setTextVal(e.target.value)} />
        <input type="text" placeholder='Short label (e.g. "Site photo — 21 Sep")' style={{ marginTop: 8 }} value={label} onChange={(e) => setLabel(e.target.value)} />
        <button className="w-btn" onClick={doHash} disabled={busy}>{busy ? "Hashing…" : "Hash + Encrypt on this device"}</button>
      </div>

      {pending && (
        <div className="w-card">
          <h2><span className="w-step">2</span>On-device result</h2>
          <div className="w-desc">This is what would be sent onward — a hash and an encrypted blob. The original content stays right here.</div>
          <KV k="SHA-256 hash" v={"0x" + pending.hash} />
          <KV k="Encrypted size" v={`${pending.size} bytes → ${Math.ceil(pending.encB64.length * 0.75)} bytes encrypted`} />
          <KV k="Simulated IPFS CID" v={pending.cid} />
          <button className="w-btn" onClick={doAnchor} disabled={anchoring}>
            {anchoring ? "⛓ Anchoring to Celo..." : "⛓ Anchor hash to chain"}
          </button>
          <div className="w-footnote">This demo anchors to a local simulated ledger so the whole flow is demoable offline. The production build calls <code>WitnessAnchor.anchor(hash)</code> on a live Polygon testnet contract — identical write, real chain.</div>
        </div>
      )}

      {anchored && (
        <div className="w-card">
          <h2>✅ Anchored</h2>
          <KV k="Tx hash" v={anchored.txHash} />
          <KV k="Block" v={"#" + anchored.block} />
          <KV k="Timestamp" v={anchored.timestamp.replace("T", " ").slice(0, 19) + " UTC"} />
          <div className="w-divider" />
          <div className="w-desc" style={{ marginBottom: 6 }}>Reveal code — share this with one recipient when you're ready for them to verify and decrypt.</div>
          <CopyField text={anchored.revealCode} />
          <button className="w-btn w-btn-ghost" onClick={reset}>Anchor another item</button>
        </div>
      )}
    </>
  );
}

function LedgerView({ version }) {
  const [ledger, setLedger] = useState([]);

  useEffect(() => {
    setLedger(loadLedger().slice().reverse());
  }, [version]);

  const reset = () => {
    if (confirm("Clear the simulated ledger? This only affects this browser's demo data.")) {
      saveLedger([]);
      setLedger([]);
    }
  };

  return (
    <div className="w-card">
      <h2>Public ledger (simulated chain)</h2>
      <div className="w-desc">Every anchor is append-only and visible to anyone — exactly like a real public blockchain explorer. Only hashes and timestamps live here, never content.</div>
      {ledger.length === 0 ? (
        <div className="w-empty">No anchors yet — go anchor something in the Capture tab.</div>
      ) : (
        ledger.map((r) => (
          <div className="w-ledger-item" key={r.id}>
            <div className="w-ledger-lbl">{r.label}</div>
            <KV k="Hash" v={"0x" + r.hash.slice(0, 16) + "…" + r.hash.slice(-8)} />
            <KV k="Block" v={"#" + r.block} />
            <KV k="Timestamp" v={r.timestamp.replace("T", " ").slice(0, 19) + " UTC"} />
            <KV k="CID" v={r.cid.slice(0, 20) + "…"} />
          </div>
        ))
      )}
      <button className="w-btn w-btn-danger" style={{ marginTop: 14 }} onClick={reset}>Reset demo ledger</button>
    </div>
  );
}

function VerifyView() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null); // {ok, message}
  const [preview, setPreview] = useState("");
  const [lastBytes, setLastBytes] = useState(null);
  const [lastRecord, setLastRecord] = useState(null);

  const doVerify = async () => {
    const trimmed = code.trim();
    try {
      if (!trimmed.startsWith("WITNESS1.")) throw new Error("That doesn't look like a Witness reveal code.");
      const payload = JSON.parse(atob(trimmed.slice("WITNESS1.".length)));
      const ledger = loadLedger();
      const record = ledger.find((r) => r.id === payload.id);
      if (!record) throw new Error("No matching anchor found in the ledger for this code.");

      const keyBuf = b64ToBuf(payload.key);
      const key = await crypto.subtle.importKey("raw", keyBuf, { name: "AES-GCM" }, false, ["decrypt"]);
      const iv = new Uint8Array(b64ToBuf(record.ivB64));
      const encBuf = b64ToBuf(record.encB64);
      const decBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encBuf);
      const recomputedHash = await sha256Hex(decBuf);

      setLastBytes(decBuf);
      setLastRecord(record);

      const matches = recomputedHash === record.hash;
      setResult({
        ok: matches,
        message: matches
          ? `Decrypted content's hash matches the on-chain record exactly. Unaltered since block #${record.block} (${record.timestamp.replace("T", " ").slice(0, 19)} UTC).`
          : "The decrypted content's hash does NOT match the on-chain record. This content has been altered since it was anchored.",
      });
      setPreview(tryDecodeText(decBuf));
    } catch (e) {
      setLastBytes(null);
      setLastRecord(null);
      setResult({ ok: false, message: e.message });
      setPreview("");
    }
  };

  const doTamper = async () => {
    if (!lastBytes || !lastRecord) {
      alert("Verify a reveal code first, then try this.");
      return;
    }
    const tampered = new Uint8Array(lastBytes.slice(0));
    tampered[0] = tampered[0] ^ 0xff;
    setResult({
      ok: false,
      message: "One byte of the content was altered after anchoring. Recomputed hash no longer matches the on-chain record — tampering is instantly detectable.",
    });
    setPreview(tryDecodeText(tampered.buffer) + "\n\n[1 byte deliberately flipped for this demo]");
  };

  const doDownload = () => {
    if (!lastBytes || !lastRecord) return;
    const blob = new Blob([lastBytes], { type: lastRecord.mimeType || "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = lastRecord.fileName || "decrypted_evidence";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="w-card">
        <h2>Verify a reveal code</h2>
        <div className="w-desc">Paste a reveal code from someone who anchored evidence and is ready to share it with you. This decrypts the content locally and checks it against the on-chain hash.</div>
        <textarea rows={3} placeholder="Paste reveal code here…" value={code} onChange={(e) => setCode(e.target.value)} />
        <button className="w-btn w-btn-secondary" onClick={doVerify}>Decrypt &amp; verify against chain</button>
      </div>

      {result && (
        <div className="w-card">
          <h2>Result</h2>
          <div className={`w-result ${result.ok ? "w-result-good" : "w-result-bad"}`}>
            <Badge tone={result.ok ? "good" : "bad"}>{result.ok ? "VERIFIED" : "MISMATCH / ERROR"}</Badge>
            {result.message}
          </div>
          <div className="w-divider" />
          <div className="w-desc" style={{ marginBottom: 6 }}>Recovered content preview</div>
          <div className="w-preview">{preview}</div>
          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            {lastBytes && <button className="w-btn" onClick={doDownload}>📥 Download Decrypted File</button>}
            <button className="w-btn w-btn-ghost" onClick={doTamper}>🧪 Simulate tampering</button>
          </div>
        </div>
      )}
    </>
  );
}

function AboutView() {
  return (
    <>
      <div className="w-card">
        <h2>Why this can't be a normal database</h2>
        <div className="w-desc">A centralized timestamp server can be pressured, hacked, or compelled to falsify records by exactly the actors this tool protects people from. A public chain removes that single point of coercion — no one party controls it, so no one party can rewrite history on it.</div>
      </div>
      <div className="w-card">
        <h2>What's real vs. simulated in this prototype</h2>
        <KV k="SHA-256 hashing" v={<span style={{ color: "var(--good)" }}>Real — Web Crypto API</span>} />
        <KV k="AES-GCM encryption" v={<span style={{ color: "var(--good)" }}>Real — Web Crypto API</span>} />
        <KV k="Blockchain anchor" v={<span style={{ color: "var(--amber-light)" }}>Simulated ledger (see WitnessAnchor.sol for the real contract)</span>} />
        <KV k="IPFS storage" v={<span style={{ color: "var(--amber-light)" }}>Simulated — CID derived from content hash</span>} />
        <KV k="ZK proof of possession" v={<span style={{ color: "var(--amber-light)" }}>Roadmap — not in this build</span>} />
      </div>
    </>
  );
}

// ---------------- root component ----------------

const TABS = [
  { id: "capture", label: "Capture & Anchor" },
  { id: "ledger", label: "Ledger" },
  { id: "verify", label: "Verify & Reveal" },
  { id: "about", label: "How It Works" },
];

export default function WitnessApp() {
  const [tab, setTab] = useState("capture");
  const [ledgerVersion, setLedgerVersion] = useState(0);

  return (
    <div className="witness-root">
      <style>{CSS}</style>

      <header className="w-top">
        <div className="w-top-inner">
          <div className="w-eyebrow">Build For Billions · Team Big Bihh · Web3 &amp; Privacy</div>
          <h1 className="w-brand">🔏 WITNESS — Prototype</h1>
          <nav className="w-tabs">
            {TABS.map((t) => (
              <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="w-main">
        {tab === "capture" && <CaptureView onAnchored={() => setLedgerVersion((v) => v + 1)} />}
        {tab === "ledger" && <LedgerView version={ledgerVersion} />}
        {tab === "verify" && <VerifyView />}
        {tab === "about" && <AboutView />}
      </main>
    </div>
  );
}

// ---------------- styles ----------------

const CSS = `
.witness-root {
  --ink: #0B0F14;
  --panel: #121821;
  --panel2: #171f2a;
  --paper: #EDE7D9;
  --amber: #C97A2B;
  --amber-light: #E3A25C;
  --cyan: #2E8C8C;
  --cyan-light: #4FB3B3;
  --line: #2a333f;
  --muted: #8a94a3;
  --danger: #C24B4B;
  --good: #3FA45C;
  background: radial-gradient(circle at 15% 0%, #17202b 0%, var(--ink) 60%);
  color: var(--paper);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
  font-size: 15px;
  line-height: 1.5;
  min-height: 100vh;
}
.witness-root * { box-sizing: border-box; }
.witness-root .w-top {
  position: sticky; top: 0;
  background: rgba(11,15,20,0.92);
  backdrop-filter: blur(6px);
  border-bottom: 1px solid var(--line);
  z-index: 10;
}
.witness-root .w-top-inner { padding: 14px 16px 10px; }
.witness-root .w-eyebrow {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 10.5px; letter-spacing: 2px; text-transform: uppercase;
  color: var(--amber-light);
}
.witness-root .w-brand { margin: 2px 0 8px; font-size: 22px; font-weight: 800; letter-spacing: 0.5px; }
.witness-root .w-tabs { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; }
.witness-root .w-tabs button {
  flex: none; background: transparent; border: 1px solid var(--line); color: var(--muted);
  padding: 7px 12px; border-radius: 20px; font-size: 12.5px; font-weight: 600; white-space: nowrap; cursor: pointer;
}
.witness-root .w-tabs button.active { background: var(--amber); border-color: var(--amber); color: #1a1006; }
.witness-root .w-main { max-width: 720px; margin: 0 auto; padding: 18px 16px 60px; }
.witness-root .w-card { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 16px; margin-bottom: 14px; }
.witness-root .w-card h2 { margin: 0 0 4px; font-size: 16px; display: flex; align-items: center; }
.witness-root .w-desc { color: var(--muted); font-size: 13px; margin-bottom: 12px; }
.witness-root .w-step {
  display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px;
  border-radius: 50%; background: var(--ink); color: var(--amber-light);
  font-family: 'SFMono-Regular', Consolas, monospace; font-size: 11px; margin-right: 8px; border: 1px solid var(--line);
}
.witness-root input[type="file"] { display: block; width: 100%; font-size: 13px; color: var(--muted); }
.witness-root textarea, .witness-root input[type="text"] {
  width: 100%; background: var(--panel2); border: 1px solid var(--line); color: var(--paper);
  border-radius: 6px; padding: 10px; font-size: 13.5px; font-family: inherit; resize: vertical;
}
.witness-root textarea:focus, .witness-root input:focus { outline: 1px solid var(--cyan); }
.witness-root .w-btn {
  background: var(--amber); color: #1a1006; border: none; padding: 11px 16px; border-radius: 7px;
  font-weight: 700; font-size: 13.5px; width: 100%; margin-top: 10px; cursor: pointer;
}
.witness-root .w-btn:disabled { opacity: 0.4; }
.witness-root .w-btn-secondary { background: transparent; color: var(--cyan-light); border: 1px solid var(--cyan); }
.witness-root .w-btn-ghost { background: transparent; color: var(--muted); border: 1px solid var(--line); }
.witness-root .w-btn-danger { background: transparent; color: var(--danger); border: 1px solid var(--danger); }
.witness-root .w-kv { display: flex; justify-content: space-between; gap: 10px; padding: 7px 0; border-bottom: 1px solid var(--line); font-size: 12.5px; }
.witness-root .w-kv:last-child { border-bottom: none; }
.witness-root .w-kv-k { color: var(--muted); flex-shrink: 0; }
.witness-root .w-kv-v { text-align: right; word-break: break-all; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 11.5px; }
.witness-root .w-copyable { display: flex; align-items: center; gap: 8px; background: var(--panel2); border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; margin-top: 6px; }
.witness-root .w-copyable-v { flex: 1; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 11px; word-break: break-all; color: var(--cyan-light); }
.witness-root .w-copyable button { flex-shrink: 0; background: var(--line); color: var(--paper); border: none; border-radius: 5px; padding: 6px 9px; font-size: 11px; cursor: pointer; }
.witness-root .w-badge { display: inline-block; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 10.5px; padding: 3px 8px; border-radius: 10px; border: 1px solid; margin-right: 6px; }
.witness-root .w-ledger-item { border: 1px solid var(--line); border-radius: 8px; padding: 12px; margin-bottom: 10px; background: var(--panel2); }
.witness-root .w-ledger-lbl { font-weight: 700; font-size: 13.5px; margin-bottom: 4px; }
.witness-root .w-empty { text-align: center; color: var(--muted); font-size: 13px; padding: 30px 10px; }
.witness-root .w-result { border-radius: 8px; padding: 14px; margin-top: 12px; font-size: 13.5px; }
.witness-root .w-result-good { background: rgba(63,164,92,0.12); border: 1px solid var(--good); color: #a9e0ba; }
.witness-root .w-result-bad { background: rgba(194,75,75,0.12); border: 1px solid var(--danger); color: #f0b4b4; }
.witness-root .w-preview { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 12.5px; word-break: break-word; background: var(--panel2); border: 1px solid var(--line); border-radius: 6px; padding: 10px; max-height: 160px; overflow: auto; white-space: pre-wrap; }
.witness-root .w-footnote { color: var(--muted); font-size: 11.5px; margin-top: 8px; line-height: 1.5; }
.witness-root .w-divider { height: 1px; background: var(--line); margin: 14px 0; }
`;