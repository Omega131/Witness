import React, { useState, useEffect, useRef } from "react";
import { ethers } from "ethers";
import { uploadToPinata } from "./utils/pinata.js";

const CONTRACT_ADDRESS = "0x28C82E2Cff9404A3e6818cc7b1f27374b9f90d48";
const CONTRACT_ABI = [
  "function anchor(bytes32 contentHash, string calldata ipfsCid) external",
  "function anchors(bytes32) view returns (uint256)",
  "event Anchored(bytes32 indexed contentHash, string ipfsCid, uint256 timestamp)"
];

const CELO_SEPOLIA_CHAIN_ID_HEX = "0xaa044c"; // 11142220
const CELO_SEPOLIA_CONFIG = {
  chainId: CELO_SEPOLIA_CHAIN_ID_HEX,
  chainName: "Celo Sepolia Testnet",
  nativeCurrency: {
    name: "CELO",
    symbol: "CELO",
    decimals: 18,
  },
  rpcUrls: ["https://celo-sepolia.drpc.org", "https://forno.celo-sepolia.celo-testnet.org"],
  blockExplorerUrls: ["https://celo-sepolia.blockscout.com"],
};

function getWeb3Provider() {
  if (typeof window === "undefined") return null;
  if (window.coinbaseWalletExtension) return window.coinbaseWalletExtension;
  if (window.ethereum?.providers?.length) {
    const cb = window.ethereum.providers.find((p) => p.isCoinbaseWallet);
    if (cb) return cb;
    return window.ethereum.providers[0];
  }
  if (window.ethereum) return window.ethereum;
  return null;
}

async function ensureCeloNetwork(rawProvider) {
  try {
    const currentChainId = await rawProvider.request({ method: "eth_chainId" });
    if (currentChainId === CELO_SEPOLIA_CHAIN_ID_HEX || parseInt(currentChainId, 16) === 11142220) {
      return;
    }
    await rawProvider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CELO_SEPOLIA_CHAIN_ID_HEX }],
    });
  } catch (err) {
    if (
      err.code === 4902 ||
      err?.data?.originalError?.code === 4902 ||
      err?.message?.includes("Unrecognized chain ID") ||
      err?.message?.includes("wallet_addEthereumChain") ||
      err?.message?.includes("4902")
    ) {
      await rawProvider.request({
        method: "wallet_addEthereumChain",
        params: [CELO_SEPOLIA_CONFIG],
      });
    } else {
      console.warn("Chain switch note:", err);
    }
  }
}

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
    /* demo storage is best-effort */
  }
}

const OFFLINE_CHAIN_KEY = "witness_offline_chain_v1";
function loadOfflineChain() {
  try {
    const raw = localStorage.getItem(OFFLINE_CHAIN_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
function saveOfflineChain(chain) {
  try {
    localStorage.setItem(OFFLINE_CHAIN_KEY, JSON.stringify(chain));
  } catch (e) {
    console.error("Local storage full!", e);
  }
}

// ---------------- UI atoms ----------------

function Badge({ children, tone = "cyan" }) {
  const toneStyle = {
    cyan: { color: "#00e5cc", borderColor: "rgba(0, 229, 204, 0.4)", background: "rgba(0, 229, 204, 0.1)" },
    good: { color: "#34d399", borderColor: "rgba(52, 211, 153, 0.4)", background: "rgba(52, 211, 153, 0.1)" },
    bad: { color: "#f87171", borderColor: "rgba(248, 113, 113, 0.4)", background: "rgba(248, 113, 113, 0.1)" },
    amber: { color: "#fbbf24", borderColor: "rgba(251, 191, 36, 0.4)", background: "rgba(251, 191, 36, 0.1)" }
  }[tone] || { color: "#00e5cc", borderColor: "rgba(0, 229, 204, 0.4)", background: "rgba(0, 229, 204, 0.1)" };

  return (
    <span className="w-badge" style={toneStyle}>
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
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="w-copyable">
      <span className="w-copyable-v">{text}</span>
      <button type="button" onClick={onCopy}>{copied ? "✓ Copied" : "Copy"}</button>
    </div>
  );
}

// ---------------- main views ----------------

function CaptureView({ onAnchored }) {
  const fileRef = useRef(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [textVal, setTextVal] = useState("");
  const [label, setLabel] = useState("");
  const [securingLocally, setSecuringLocally] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [pending, setPending] = useState(null);
  const [anchored, setAnchored] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileChange = (file) => {
    if (file) {
      setSelectedFileName(file.name);
      if (!label.trim()) {
        setLabel(file.name);
      }
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (fileRef.current) {
        const dt = new DataTransfer();
        dt.items.add(file);
        fileRef.current.files = dt.files;
      }
      handleFileChange(file);
    }
  };

  // Step 1: Purely local client-side security and hashing
  const doSecureLocally = async () => {
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
      return;
    }

    setSecuringLocally(true);
    try {
      const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes);
      const rawKey = await crypto.subtle.exportKey("raw", key);

      const encHash = await sha256Hex(encBuf);
      const encB64 = bufToB64(encBuf);
      const ivB64 = bufToB64(iv.buffer);
      const keyB64 = bufToB64(rawKey);

      const pendingItem = {
        label: lbl,
        hash: encHash,
        encB64,
        ivB64,
        keyB64,
        size: bytes.byteLength,
        mimeType,
        fileName,
        cid: null,
      };

      if (!navigator.onLine) {
         // Secure in local offline blockchain
         const chain = loadOfflineChain();
         const prevHash = chain.length > 0 ? chain[chain.length - 1].hash : "GENESIS";
         
         const offlineBlock = {
            ...pendingItem,
            prevHash,
            timestamp: new Date().toISOString()
         };
         chain.push(offlineBlock);
         saveOfflineChain(chain);
         
         alert("No WiFi detected! Evidence encrypted and added to the Local Offline Blockchain. It will automatically prompt to sync when connection is restored.");
         setSecuringLocally(false);
         if (onAnchored) onAnchored(); 
         return reset();
      }

      // Start Pinata IPFS upload immediately in background so it's already ready when Button 2 is clicked!
      const pinataJwt = import.meta.env.VITE_PINATA_JWT;
      if (pinataJwt) {
        const encBlob = new Blob([encBuf]);
        pendingItem.cidPromise = uploadToPinata(encBlob, pinataJwt)
          .then((cid) => {
            pendingItem.cid = cid;
            setPending((prev) => (prev ? { ...prev, cid } : prev));
            return cid;
          })
          .catch((err) => {
            console.warn("Background Pinata upload note:", err);
          });
      }

      setPending(pendingItem);
      setAnchored(null);
    } catch (e) {
      alert("Error securing evidence: " + e.message);
    } finally {
      setSecuringLocally(false);
    }
  };

  // Step 2: Separate action button to upload to IPFS and anchor on Celo Sepolia (opens Coinbase Wallet immediately on 1 click)
  const doUploadAndAnchor = async () => {
    if (!pending) return;

    const rawProvider = getWeb3Provider();
    if (!rawProvider) {
      alert("Please install Coinbase Wallet or MetaMask to anchor to the blockchain.");
      return;
    }

    try {
      setStatusMsg("Connecting Coinbase…");
      // Triggers Coinbase Wallet popup immediately on direct user click!
      await rawProvider.request({ method: "eth_requestAccounts" });
      await ensureCeloNetwork(rawProvider);

      const provider = new ethers.BrowserProvider(rawProvider);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      // Resolve IPFS CID (either already finished in background or awaits completion)
      let realCid = pending.cid;
      if (!realCid) {
        if (pending.cidPromise) {
          setStatusMsg("Finalizing IPFS…");
          realCid = await pending.cidPromise;
        }
        if (!realCid) {
          setStatusMsg("Uploading to IPFS…");
          const pinataJwt = import.meta.env.VITE_PINATA_JWT;
          if (!pinataJwt) {
            throw new Error("VITE_PINATA_JWT is not set in .env! Cannot upload to IPFS.");
          }
          const encBlob = new Blob([b64ToBuf(pending.encB64)]);
          realCid = await uploadToPinata(encBlob, pinataJwt);
        }
        pending.cid = realCid;
        setPending((prev) => (prev ? { ...prev, cid: realCid } : prev));
      }

      // Prompt on-chain confirmation in Coinbase Wallet with explicit gasLimit
      setStatusMsg("Confirm in Coinbase…");
      const tx = await contract.anchor("0x" + pending.hash, realCid, { gasLimit: 350000 });
      setStatusMsg("Waiting for Celo block…");
      const receipt = await tx.wait();

      const txHash = tx.hash;
      const block = receipt.blockNumber;
      const blockInfo = await provider.getBlock(block);
      let timestamp = new Date().toISOString();
      if (blockInfo && blockInfo.timestamp) {
        timestamp = new Date(Number(blockInfo.timestamp) * 1000).toISOString();
      }

      const record = {
        id: "w_" + Date.now(),
        label: pending.label,
        hash: pending.hash,
        cid: realCid,
        txHash,
        block,
        timestamp
      };

      const ledger = loadLedger();
      ledger.push(record);
      saveLedger(ledger);

      // 1. Generate Public Verification Code (Only contains CID)
      const verifyPayload = { c: realCid };
      const verifyCode = "WITNESS_PUBLIC." + btoa(JSON.stringify(verifyPayload));

      // 2. Generate Private Decryption Code (Contains Keys and Metadata)
      const decryptPayload = { k: pending.keyB64, i: pending.ivB64, m: pending.mimeType, f: pending.fileName };
      const decryptCode = "WITNESS_PRIVATE." + btoa(JSON.stringify(decryptPayload));

      setAnchored({ txHash, block, timestamp, verifyCode, decryptCode });
      onAnchored?.();
      setPending(null);
    } catch (e) {
      console.error(e);
      if (e.code === 4001 || e.message?.includes("rejected")) {
        alert("Transaction was cancelled in Coinbase Wallet.");
      } else {
        alert("Error anchoring: " + (e.reason || e.message));
      }
    } finally {
      setStatusMsg("");
    }
  };

  const reset = () => {
    if (fileRef.current) fileRef.current.value = "";
    setSelectedFileName("");
    setTextVal("");
    setLabel("");
    setSecuringLocally(false);
    setStatusMsg("");
    setPending(null);
    setAnchored(null);
  };

  return (
    <div className="w-form-flow">
      {/* Drag & Drop File Zone */}
      <div
        className={`w-dropzone ${isDragOver ? "dragover" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input
          type="file"
          ref={fileRef}
          style={{ display: "none" }}
          onChange={(e) => handleFileChange(e.target.files?.[0])}
        />
        <div className="w-drop-text">
          {selectedFileName ? (
            <span style={{ color: "#00e5cc", fontWeight: 600 }}>Selected: {selectedFileName}</span>
          ) : (
            <>
              Drag &amp; Drop File or <span className="w-browse-btn">Browse</span>
            </>
          )}
        </div>
      </div>

      {/* Testimony Input */}
      <div>
        <input
          type="text"
          placeholder="Testimony"
          value={textVal}
          onChange={(e) => setTextVal(e.target.value)}
          className="w-input"
        />
      </div>

      {/* Label Input */}
      <div>
        <input
          type="text"
          placeholder="Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-input"
        />
      </div>

      {/* Action Button 1: Secure & Anchor (Local Browser Encryption) */}
      <button className="w-btn-primary" onClick={doSecureLocally} disabled={securingLocally || Boolean(statusMsg) || pending || anchored}>
        {securingLocally ? "Securing Locally…" : "Secure & Anchor"}
      </button>
      
      {(textVal || selectedFileName || label || pending || anchored) && (
        <button className="w-btn-ghost" style={{ marginTop: "10px" }} onClick={reset}>
          Clear Input
        </button>
      )}

      {/* Pending Anchor Card */}
      {pending && (
        <div className="w-card" style={{ marginTop: "18px" }}>
          <div className="w-card-header">
            <span className="w-step">✓</span>
            <h2>Evidence Secured Locally</h2>
          </div>
          <div className="w-desc">Encrypted ciphertext and SHA-256 hash ready for on-chain anchoring.</div>
          <KV k="Encrypted SHA-256 Hash" v={"0x" + pending.hash} />
          <KV k="Encrypted Size" v={`${pending.size} bytes → ${Math.ceil(pending.encB64.length * 0.75)} bytes encrypted`} />

          {/* Action Button 2: Upload to IPFS and Anchor On-Chain via Coinbase */}
          <button className="w-btn-primary" style={{ marginTop: "16px" }} onClick={doUploadAndAnchor} disabled={Boolean(statusMsg)}>
            {statusMsg ? `⛓ ${statusMsg}` : "⛓ Upload to IPFS & Anchor"}
          </button>
        </div>
      )}

      {/* Anchored Confirmation Card */}
      {anchored && (
        <div className="w-card" style={{ marginTop: "18px" }}>
          <div className="w-card-header">
            <span style={{ fontSize: "18px" }}>✅</span>
            <h2 style={{ color: "#34d399" }}>Anchored Securely on Chain</h2>
          </div>
          <KV k="Tx Hash" v={anchored.txHash} />
          <KV k="Block Number" v={"#" + anchored.block} />
          <KV k="Timestamp" v={anchored.timestamp.replace("T", " ").slice(0, 19) + " UTC"} />
          <div className="w-divider" />
          
          <div className="w-desc" style={{ marginBottom: 6 }}>
            <strong style={{ color: "var(--cyan)" }}>1. Public Verification Code</strong><br />
            Share publicly to prove the file exists and is timestamped, without revealing the content.
          </div>
          <CopyField text={anchored.verifyCode} />

          <div className="w-desc" style={{ marginBottom: 6, marginTop: 16 }}>
            <strong style={{ color: "#fbbf24" }}>2. Private Decryption Key</strong><br />
            Share ONLY with authorized people to let them decrypt and view the file.
          </div>
          <CopyField text={anchored.decryptCode} />

          <button className="w-btn-ghost" style={{ marginTop: "18px" }} onClick={reset}>
            Anchor Another Item
          </button>
        </div>
      )}
    </div>
  );
}


function VerifyView() {
  const [verifyCode, setVerifyCode] = useState("");
  const [decryptCode, setDecryptCode] = useState("");
  
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [fetchedEncBuf, setFetchedEncBuf] = useState(null);
  
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptResult, setDecryptResult] = useState(null);
  const [lastBytes, setLastBytes] = useState(null);
  const [lastRecord, setLastRecord] = useState(null);
  const [preview, setPreview] = useState("");

  const doVerify = async () => {
    const trimmed = verifyCode.trim();
    setVerifyResult(null); setFetchedEncBuf(null); setDecryptResult(null); setLastBytes(null); setPreview("");
    if (!trimmed) return;

    setIsVerifying(true);
    try {
      if (!trimmed.startsWith("WITNESS_PUBLIC.")) throw new Error("Invalid Public Verification Code.");
      const payload = JSON.parse(atob(trimmed.slice("WITNESS_PUBLIC.".length)));

      // 1. Fetch encrypted blob from IPFS
      const res = await fetch("https://gateway.pinata.cloud/ipfs/" + payload.c);
      if (!res.ok) throw new Error("Failed to fetch encrypted file from IPFS.");
      const encBuf = await res.arrayBuffer();

      // 2. Hash the encrypted payload
      const encHash = await sha256Hex(encBuf);

      // 3. Verify on Blockchain (Public Read via Celo Sepolia)
      const provider = new ethers.JsonRpcProvider("https://forno.celo-sepolia.celo-testnet.org");
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      const onChainTimestamp = await contract.anchors("0x" + encHash);

      if (onChainTimestamp > 0n) {
        const dateStr = new Date(Number(onChainTimestamp) * 1000).toISOString().replace("T", " ").slice(0, 19);
        setVerifyResult({
          ok: true,
          message: `Encrypted payload verified! Matches exactly with Celo block timestamped at ${dateStr} UTC. (Contents are still encrypted).`
        });
        setFetchedEncBuf(encBuf);
      } else {
        setVerifyResult({
          ok: false,
          message: "The encrypted file's hash does NOT match the blockchain. It was altered or never anchored."
        });
      }
    } catch (e) {
      setVerifyResult({ ok: false, message: e.message });
    }
    setIsVerifying(false);
  };

  const [aiDetectionStatus, setAiDetectionStatus] = useState("idle");
  const [aiPercentage, setAiPercentage] = useState(null);

  const doDecrypt = async () => {
    const trimmed = decryptCode.trim();
    setDecryptResult(null); setLastBytes(null); setPreview("");
    setAiDetectionStatus("idle"); setAiPercentage(null);
    if (!trimmed || !fetchedEncBuf) return;

    setIsDecrypting(true);
    try {
      if (!trimmed.startsWith("WITNESS_PRIVATE.")) throw new Error("Invalid Private Decryption Code.");
      const payload = JSON.parse(atob(trimmed.slice("WITNESS_PRIVATE.".length)));

      const keyBuf = b64ToBuf(payload.k);
      const key = await crypto.subtle.importKey("raw", keyBuf, { name: "AES-GCM" }, false, ["decrypt"]);
      const iv = new Uint8Array(b64ToBuf(payload.i));
      const decBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, fetchedEncBuf);

      setLastBytes(decBuf);
      setLastRecord({ mimeType: payload.m, fileName: payload.f });

      setDecryptResult({
        ok: true,
        message: "Successfully decrypted the verified evidence."
      });
      setPreview(tryDecodeText(decBuf));
    } catch (e) {
      setDecryptResult({ ok: false, message: "Decryption failed: Incorrect key or corrupted data." });
    }
    setIsDecrypting(false);
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

  const doAIDetection = async () => {
    if (!preview || preview.startsWith("[binary content")) {
      alert("AI detection is currently only supported for text content.");
      return;
    }

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      alert("Please add VITE_GEMINI_API_KEY to your .env file to run real AI detection.");
      return;
    }

    setAiDetectionStatus("loading");
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Analyze the following text and determine the percentage likelihood that it was generated by AI. Respond ONLY with a number between 0 and 100 representing the percentage. Do not include a % sign or any other text.\n\nText: ${preview}`
            }]
          }]
        })
      });

      if (!response.ok) throw new Error("API request failed");
      const data = await response.json();
      const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      const percentage = parseInt(textOutput?.trim(), 10);
      if (isNaN(percentage)) {
         throw new Error("Invalid response from API");
      }
      
      setAiPercentage(percentage);
      setAiDetectionStatus("complete");
    } catch (e) {
      console.error(e);
      alert("Failed to analyze content: " + e.message);
      setAiDetectionStatus("idle");
    }
  };

  return (
    <div className="w-form-flow">
      {/* Step 1: Public Verification */}
      <div className="w-card">
        <div className="w-card-header">
          <h2>1. Public Verification (No Decryption)</h2>
        </div>
        <div className="w-desc">
          Paste a Public Verification Code to fetch the encrypted file from IPFS and verify its hash on the blockchain.
        </div>
        <input
          type="text"
          placeholder="Paste WITNESS_PUBLIC code here…"
          value={verifyCode}
          onChange={(e) => setVerifyCode(e.target.value)}
          className="w-input"
        />
        <button className="w-btn-primary" style={{ marginTop: "14px" }} onClick={doVerify} disabled={isVerifying}>
          {isVerifying ? "Fetching from IPFS & Verifying..." : "Verify Authenticity"}
        </button>
      </div>

      {/* Step 1 Result & Step 2 Decryption */}
      {verifyResult && (
        <div className="w-card" style={{ marginTop: "16px" }}>
          <div className="w-card-header">
            <h2>Verification Status</h2>
          </div>
          <div className={`w-result ${verifyResult.ok ? "w-result-good" : "w-result-bad"}`}>
            <Badge tone={verifyResult.ok ? "good" : "bad"}>{verifyResult.ok ? "VERIFIED IMMUTABLE" : "ERROR"}</Badge>
            <div style={{ marginTop: "6px" }}>{verifyResult.message}</div>
          </div>

          {verifyResult.ok && fetchedEncBuf && (
            <div style={{ marginTop: "20px" }}>
              <div className="w-divider" />
              <div className="w-card-header">
                <h2>2. Decrypt Evidence</h2>
              </div>
              <div className="w-desc">
                The encrypted file's on-chain authenticity is mathematically proven. If you are authorized, paste the Private Key below to decrypt and read it.
              </div>
              <input
                type="text"
                placeholder="Paste WITNESS_PRIVATE code here…"
                value={decryptCode}
                onChange={(e) => setDecryptCode(e.target.value)}
                className="w-input"
              />
              <button className="w-btn-primary" style={{ marginTop: "14px" }} onClick={doDecrypt} disabled={isDecrypting}>
                {isDecrypting ? "Decrypting…" : "Decrypt Evidence"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 2 Decrypted Output */}
      {decryptResult && (
        <div className="w-card" style={{ marginTop: "16px" }}>
          <div className="w-card-header">
            <h2>Decrypted Content</h2>
          </div>
          <div className={`w-result ${decryptResult.ok ? "w-result-good" : "w-result-bad"}`}>
            <Badge tone={decryptResult.ok ? "good" : "bad"}>{decryptResult.ok ? "UNLOCKED" : "ERROR"}</Badge>
            <div style={{ marginTop: "6px" }}>{decryptResult.message}</div>
          </div>
          {decryptResult.ok && (
            <>
              <div className="w-divider" />
              <div className="w-desc" style={{ marginBottom: 6 }}>Recovered Content Preview</div>
              <div className="w-preview">{preview}</div>
              
              <div style={{ marginTop: "16px", display: "flex", gap: "12px", flexDirection: "column" }}>
                <button className="w-btn-primary" onClick={doDownload}>
                  📥 Download Decrypted File
                </button>
                <button 
                  className="w-btn-ghost" 
                  onClick={doAIDetection} 
                  disabled={aiDetectionStatus === "loading"}
                >
                  {aiDetectionStatus === "loading" ? "Scanning for AI..." : "🤖 Analyze for AI Generation"}
                </button>
              </div>

              {aiDetectionStatus === "complete" && (
                 <div className="w-result" style={{ marginTop: "16px", background: "rgba(10, 26, 42, 0.75)", border: "1px solid rgba(0, 229, 204, 0.4)" }}>
                    <div style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
                       <span style={{ fontSize: "16px", marginRight: "8px" }}>🤖</span>
                       <h2 style={{ fontSize: "14px", margin: 0, color: "#fff" }}>AI Detection Analysis</h2>
                    </div>
                    <div>
                        <Badge tone={aiPercentage < 20 ? "good" : "amber"}>
                          {aiPercentage < 20 ? "LIKELY HUMAN" : "LIKELY AI"}
                        </Badge>
                        <div style={{ marginTop: "8px", fontSize: "13px", color: "#cbd5e1" }}>
                          Our detection model estimates this content is <strong style={{ color: "#fff" }}>{aiPercentage}%</strong> AI-generated.
                        </div>
                    </div>
                 </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}



// ---------------- Root Component ----------------

const TABS = [
  { id: "capture", label: "Capture" },
  { id: "verify", label: "Verify" }
];

export default function WitnessApp() {
  const [tab, setTab] = useState("capture");
  const [ledgerVersion, setLedgerVersion] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineChain, setOfflineChain] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setOfflineChain(loadOfflineChain());
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [tab, ledgerVersion]); // refresh offline chain on tab or ledger changes

  const syncOfflineItems = async () => {
    if (offlineChain.length === 0) return;
    const rawProvider = getWeb3Provider();
    if (!rawProvider) {
      alert("Please install Coinbase Wallet to sync.");
      return;
    }
    setIsSyncing(true);
    try {
      await rawProvider.request({ method: "eth_requestAccounts" });
      await ensureCeloNetwork(rawProvider);
      const provider = new ethers.BrowserProvider(rawProvider);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const pinataJwt = import.meta.env.VITE_PINATA_JWT;

      let successCount = 0;
      let newChain = [...offlineChain];

      for (let i = 0; i < offlineChain.length; i++) {
         const item = offlineChain[i];
         const confirmSync = confirm(`Syncing offline block ${i+1}/${offlineChain.length}: "${item.label}". Click OK to confirm transaction in wallet.`);
         if (!confirmSync) break; // User can pause sync
         
         const encBlob = new Blob([b64ToBuf(item.encB64)]);
         const realCid = await uploadToPinata(encBlob, pinataJwt);
         
         const tx = await contract.anchor("0x" + item.hash, realCid, { gasLimit: 350000 });
         const receipt = await tx.wait();
         
         const blockInfo = await provider.getBlock(receipt.blockNumber);
         let timestamp = new Date().toISOString();
         if (blockInfo && blockInfo.timestamp) {
            timestamp = new Date(Number(blockInfo.timestamp) * 1000).toISOString();
         }

         const record = {
            id: "w_sync_" + Date.now() + "_" + i,
            label: item.label + " (Offline Synced)",
            hash: item.hash,
            cid: realCid,
            txHash: tx.hash,
            block: receipt.blockNumber,
            timestamp
         };
         const ledger = loadLedger();
         ledger.push(record);
         saveLedger(ledger);

         // We must give the user their keys since they skipped the UI
         const verifyPayload = { c: realCid };
         const verifyCode = "WITNESS_PUBLIC." + btoa(JSON.stringify(verifyPayload));
         const decryptPayload = { k: item.keyB64, i: item.ivB64, m: item.mimeType, f: item.fileName };
         const decryptCode = "WITNESS_PRIVATE." + btoa(JSON.stringify(decryptPayload));
         
         const keyFileText = `Witness Offline Sync Recovery\n\nLabel: ${item.label}\nTime: ${timestamp}\n\nPublic Verify Code:\n${verifyCode}\n\nPrivate Decrypt Code:\n${decryptCode}\n`;
         const blobKey = new Blob([keyFileText], { type: "text/plain" });
         const url = URL.createObjectURL(blobKey);
         const a = document.createElement("a");
         a.href = url;
         a.download = `witness_keys_${item.hash.slice(0, 8)}.txt`;
         a.click();
         URL.revokeObjectURL(url);

         successCount++;
         newChain = newChain.filter(b => b.hash !== item.hash);
         saveOfflineChain(newChain);
         setOfflineChain(newChain);
      }
      
      if (successCount > 0) alert(`Successfully synced ${successCount} offline items to the blockchain! Your decryption keys were downloaded as text files to your computer.`);
      setLedgerVersion(v => v + 1);
    } catch (e) {
      alert("Sync interrupted: " + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="witness-root">
      <style>{CSS}</style>

      {/* Authentic Cybernetic Mesh Terrain Background from Mockup */}
      <div className="witness-mesh-bg" />

      <div className="witness-container">
        {!isOnline && (
          <div style={{ background: "#fbbf24", color: "#1a1006", padding: "10px", textAlign: "center", fontWeight: "bold", borderRadius: "8px", marginBottom: "16px" }}>
            ⚠ You are currently offline. Evidence will be secured in the Local Offline Chain.
          </div>
        )}
        {isOnline && offlineChain.length > 0 && (
          <div style={{ background: "rgba(0, 229, 204, 0.2)", border: "1px solid #00e5cc", color: "#fff", padding: "14px", textAlign: "center", borderRadius: "8px", marginBottom: "16px" }}>
            <div style={{ fontWeight: "bold", marginBottom: "8px" }}>📡 WiFi Restored! You have {offlineChain.length} offline blocks waiting to be synced.</div>
            <button className="w-btn-primary" onClick={syncOfflineItems} disabled={isSyncing}>
              {isSyncing ? "Syncing to Blockchain..." : "Sync Offline Chain Now"}
            </button>
          </div>
        )}

        {/* Hero Section: Truly transparent glowing eye, Orbitron title, tagline */}
        <header className="witness-hero">
          <div className="witness-eye-container">
            <img
              src="/logo_eye_transparent.png"
              alt="Witness Eye"
              className="witness-eye-img"
            />
          </div>
          <h1 className="witness-title">WITNESS</h1>
          <p className="witness-tagline">Immutable proof. Zero trust required.</p>
        </header>

        {/* Navigation Tabs with '|' separators and NO horizontal divider line */}
        <nav className="witness-tabs">
          <button
            className={`witness-tab-btn ${tab === "capture" ? "active" : ""}`}
            onClick={() => setTab("capture")}
          >
            Capture
          </button>
          <span className="witness-tab-pipe">|</span>
          <button
            className={`witness-tab-btn ${tab === "verify" ? "active" : ""}`}
            onClick={() => setTab("verify")}
          >
            Verify
          </button>
        </nav>

        {/* Main Floating Workspace */}
        <main className="witness-main">
          <div style={{ display: tab === "capture" ? "block" : "none" }}>
            <CaptureView onAnchored={() => setLedgerVersion((v) => v + 1)} />
          </div>
          <div style={{ display: tab === "verify" ? "block" : "none" }}>
            <VerifyView />
          </div>
        </main>
      </div>
    </div>
  );
}

// ---------------- Styles Matching Mockup Exactly ----------------

const CSS = `
.witness-root {
  position: relative;
  min-height: 100vh;
  background-color: #040810;
  color: #e2e8f0;
  overflow-x: hidden;
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
}

/* Atmospheric cyan radial glow behind the hero, matching the mockup */
.witness-root::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 520px;
  background: radial-gradient(circle at 50% 100px, rgba(0, 229, 204, 0.16) 0%, rgba(2, 28, 44, 0.28) 45%, rgba(4, 8, 16, 0) 80%);
  pointer-events: none;
  z-index: 1;
}

/* Authentic 3D cybernetic mesh landscape background from the mockup */
.witness-mesh-bg {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 65vh;
  background-image: url('/clean_mesh.jpg?v=3');
  background-position: center bottom;
  background-size: cover;
  background-repeat: no-repeat;
  pointer-events: none;
  z-index: 1;
  mask-image: linear-gradient(to top, rgba(0,0,0,1) 60%, rgba(0,0,0,0) 100%);
  -webkit-mask-image: linear-gradient(to top, rgba(0,0,0,1) 60%, rgba(0,0,0,0) 100%);
}

.witness-container {
  position: relative;
  z-index: 10;
  max-width: 680px;
  width: 100%;
  margin: 0 auto;
  padding: 32px 20px 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Hero Section */
.witness-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 26px;
}

.witness-eye-container {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
  background: transparent !important;
}

.witness-eye-img {
  width: 175px;
  height: auto;
  display: block;
  filter: drop-shadow(0 0 28px rgba(0, 229, 204, 0.8));
  background: transparent !important;
}

.witness-title {
  margin: 2px 0 0;
  font-family: 'Orbitron', 'Plus Jakarta Sans', sans-serif;
  font-size: 42px;
  font-weight: 800;
  letter-spacing: 5px;
  color: #ffffff;
  text-transform: uppercase;
  text-shadow: 0 0 30px rgba(0, 229, 204, 0.45);
}

.witness-tagline {
  margin: 8px 0 0;
  font-size: 14px;
  color: #64748b;
  letter-spacing: 0.8px;
  font-weight: 400;
}

/* Tabs: Separated with '|' and NO horizontal divider line */
.witness-tabs {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-bottom: 28px;
  width: 100%;
}

.witness-tab-btn {
  position: relative;
  background: transparent;
  border: none;
  color: #8da4be;
  font-size: 15px;
  font-weight: 600;
  padding: 6px 4px;
  cursor: pointer;
  transition: all 0.25s ease;
}

.witness-tab-btn:hover {
  color: #00e5cc;
}

.witness-tab-btn.active {
  color: #ffffff;
}

.witness-tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: -2px;
  right: -2px;
  height: 3px;
  background: #00e5cc;
  border-radius: 9999px;
  box-shadow: 0 0 14px #00e5cc, 0 0 24px rgba(0, 229, 204, 0.9);
}

.witness-tab-pipe {
  color: rgba(255, 255, 255, 0.16);
  font-weight: 300;
  font-size: 15px;
  user-select: none;
}

/* Workspace: Form Elements Floating Directly Over Mesh */
.witness-main {
  width: 100%;
  max-width: 540px;
}

.w-form-flow {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

/* Dropzone matching Mockup */
.w-dropzone {
  background: rgba(8, 20, 32, 0.5);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1.5px dashed rgba(0, 229, 204, 0.38);
  border-radius: 14px;
  padding: 24px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.25s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.w-dropzone:hover, .w-dropzone.dragover {
  border-color: #00e5cc;
  background: rgba(10, 28, 44, 0.7);
  box-shadow: 0 0 25px rgba(0, 229, 204, 0.25);
}

.w-drop-text {
  font-size: 14px;
  font-weight: 500;
  color: #cbd5e1;
}

.w-browse-btn {
  color: #00e5cc;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

/* Pill-shaped Capsule Inputs matching Mockup */
.w-input {
  width: 100%;
  background: rgba(8, 20, 32, 0.5);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(0, 229, 204, 0.22);
  border-radius: 9999px;
  padding: 13px 22px;
  font-size: 13.5px;
  color: #e2e8f0;
  outline: none;
  transition: all 0.2s ease;
  font-family: inherit;
}

.w-input::placeholder {
  color: #64748b;
}

.w-input:focus {
  border-color: #00e5cc;
  box-shadow: 0 0 16px rgba(0, 229, 204, 0.35);
  background: rgba(10, 26, 42, 0.75);
}

/* Glowing Pill Button matching Mockup */
.w-btn-primary {
  width: 100%;
  background: linear-gradient(90deg, #00e5cc 0%, #00f5d4 100%);
  color: #03080e;
  font-weight: 700;
  font-size: 14.5px;
  letter-spacing: 0.5px;
  padding: 14px 24px;
  border-radius: 9999px;
  border: none;
  cursor: pointer;
  box-shadow: 0 0 30px rgba(0, 229, 204, 0.6);
  transition: all 0.25s ease;
  margin-top: 4px;
}

.w-btn-primary:hover:not(:disabled) {
  box-shadow: 0 0 42px rgba(0, 229, 204, 0.9);
  transform: translateY(-1px);
}

.w-btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.w-btn-ghost {
  width: 100%;
  background: transparent;
  color: #94a3b8;
  border: 1px solid rgba(0, 229, 204, 0.25);
  padding: 11px;
  border-radius: 9999px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.w-btn-ghost:hover {
  color: #ffffff;
  border-color: #00e5cc;
}

.w-btn-danger {
  width: 100%;
  background: transparent;
  color: #ef4444;
  border: 1px solid #ef4444;
  padding: 10px;
  border-radius: 9999px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

/* Sub-cards for Pending, Anchored, Ledger, and Verify */
.w-card {
  background: rgba(8, 20, 32, 0.6);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(0, 229, 204, 0.22);
  border-radius: 16px;
  padding: 20px;
}

.w-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.w-card-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #ffffff;
}

.w-step {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(0, 229, 204, 0.15);
  color: #00e5cc;
  font-size: 11px;
  font-weight: bold;
  border: 1px solid #00e5cc;
}

.w-desc {
  color: #94a3b8;
  font-size: 12.5px;
  margin-bottom: 12px;
  line-height: 1.5;
}

.w-kv {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(0, 229, 204, 0.1);
  font-size: 12px;
}

.w-kv:last-child {
  border-bottom: none;
}

.w-kv-k {
  color: #94a3b8;
  flex-shrink: 0;
}

.w-kv-v {
  text-align: right;
  word-break: break-all;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 11.5px;
  color: #e0f2fe;
}

.w-copyable {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(4, 9, 15, 0.7);
  border: 1px solid rgba(0, 229, 204, 0.25);
  border-radius: 8px;
  padding: 8px 12px;
}

.w-copyable-v {
  flex: 1;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 11px;
  word-break: break-all;
  color: #00e5cc;
}

.w-copyable button {
  background: rgba(0, 229, 204, 0.15);
  color: #00e5cc;
  border: 1px solid rgba(0, 229, 204, 0.35);
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.w-copyable button:hover {
  background: #00e5cc;
  color: #040810;
}

.w-badge {
  display: inline-block;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid;
  margin-right: 6px;
}

.w-ledger-item {
  border: 1px solid rgba(0, 229, 204, 0.15);
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 10px;
  background: rgba(6, 12, 20, 0.5);
}

.w-ledger-lbl {
  font-weight: 700;
  font-size: 13.5px;
  color: #ffffff;
  margin-bottom: 6px;
}

.w-empty {
  text-align: center;
  color: #64748b;
  font-size: 13px;
  padding: 28px 10px;
}

.w-result {
  border-radius: 10px;
  padding: 12px;
  margin-top: 10px;
  font-size: 13px;
}

.w-result-good {
  background: rgba(52, 211, 153, 0.1);
  border: 1px solid rgba(52, 211, 153, 0.4);
  color: #a7f3d0;
}

.w-result-bad {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #fca5a5;
}

.w-preview {
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 11.5px;
  background: rgba(4, 9, 15, 0.7);
  border: 1px solid rgba(0, 229, 204, 0.2);
  border-radius: 8px;
  padding: 10px;
  max-height: 160px;
  overflow: auto;
  white-space: pre-wrap;
  color: #e2e8f0;
}

.w-divider {
  height: 1px;
  background: rgba(0, 229, 204, 0.15);
  margin: 14px 0;
}
`;