# **Witness Hackathon Work Plan**

[https://gemini.google.com/app/60e649806adc3b4d](https://gemini.google.com/app/60e649806adc3b4d)

*User prompt: So this is the app we're building, Witness — a blockchain-anchored proof-of-existence protocol for evidence integrity Problem statement Activists, journalists, human rights investigators, and disaster/conflict victims routinely need to prove that a piece of evidence — a photo, video, document, or testimony — existed at a specific point in time and hasn't been altered since. Right now they have two bad options: upload it to a centralized platform (which can be censored, taken down, subpoenaed, or hacked, and puts the uploader at risk of being identified and targeted by hostile regimes), or keep it privately (where it has no evidentiary weight — anyone can claim a file was edited or backdated later). This gap has real consequences: war crimes go undocumented in a court-admissible way, whistleblower evidence gets dismissed as "could've been fabricated," and disaster victims can't prove damage claims to insurers or aid agencies after records are destroyed. Selected track: Web3 And Privacy For Billions Proposed solution Witness is a mobile-first app that lets someone capture or upload evidence, and: Hashes the file on-device (SHA-256) — the raw content never leaves the device at this stage Encrypts the file and stores it off-chain (IPFS, or even just locally/on a personal device until the owner chooses to distribute it) — the chain never holds sensitive content, only proof Anchors the hash \+ timestamp on a public blockchain — this is now an immutable, publicly verifiable record that "this exact file existed at this exact time," without revealing what the file contains Lets the owner prove possession later using a zero-knowledge proof — they can prove "I hold the file matching this hash" without decrypting or revealing it, useful for establishing chain-of-custody without premature disclosure (e.g. before it's safe to go public, or before a specific court/journalist is ready to receive it) Supports selective, verified reveal — when the owner is ready, they share the decryption key with a specific recipient (a journalist, court, NGO), who can then verify the decrypted content matches the on-chain hash exactly — proving zero tampering since capture Key features On-device hashing \+ encryption (content never touches a server unencrypted) Public blockchain timestamp anchoring (Ethereum/Polygon testnet for demo — a low-cost L2 makes this realistic even at scale) Off-chain encrypted storage via IPFS (decentralized, censorship-resistant — no single company can take it down) Zero-knowledge proof of possession (prove you have it without revealing it) Selective disclosure/reveal flow with recipient verification Optional "dead man's switch"-style scheduled auto-reveal (if the owner doesn't check in, evidence auto-publishes to a preset recipient — protects against the owner being silenced) Target users Primary: journalists, human rights investigators, whistleblowers, activists in low-press-freedom regions. Secondary: disaster victims needing tamper-proof damage documentation for insurance/aid claims; conflict-zone civilians documenting war crimes for future accountability processes. Tech stack Frontend: React Native or a mobile-responsive web app (camera/file capture, on-device hashing via Web Crypto API or a JS SHA-256 lib) Storage: IPFS (via a service like web3.storage or Pinata for the demo) for encrypted file blobs Blockchain: a smart contract on Polygon (or any low-fee testnet) that stores hash → timestamp records, emits an event on anchor ZK layer: for a 24h demo, a simplified commit-reveal or a lightweight ZK library (e.g. snarkjs with a pre-built circuit for "hash preimage knowledge") rather than building custom circuits from scratch Backend: minimal — mostly client \+ smart contract \+ IPFS, which keeps your demo honest to the "no trusted server" pitch Innovation and scalability The core creative move — content stays fully private and off-chain, while the chain only ever holds a hash — means this scales to any use case needing "prove it existed, reveal it when ready": legal evidence, journalism, insurance claims, research data integrity, even NFT-adjacent authenticity proofs. It's also jurisdiction-agnostic: no government or company can unilaterally delete a public blockchain record, which is the whole point for users in hostile environments. Why blockchain (the one-sentence answer judges will probe for) A centralized timestamp server could be pressured, hacked, or compelled to falsify records by exactly the actors this tool is meant to protect against — a public blockchain removes that single point of coercion entirely. Expected impact Gives people in the highest-risk, lowest-trust environments a way to create evidence that survives even if they don't — directly serving the "trust" and "digital ownership" goals of the track, at a scale (press freedom, disaster accountability, conflict documentation) that's globally significant. 24-hour demo plan (what to actually build to make this convincing): Simple app screen: capture/upload a file → show the SHA-256 hash generated instantly on-device "Anchor" button → calls your smart contract, stores hash+timestamp, shows the resulting transaction on a block explorer (this is your money shot — real, verifiable, on a real testnet) A second screen simulating the "recipient" side: paste a hash \+ upload the original file → app confirms "hash matches, verified untampered since \[timestamp\]" Skip building real ZK circuits live — instead, have one working "proof of possession" demo using a simplified commit-reveal, and explain how a production version would use full ZK-SNARKs (judges care that you understand the cryptography, not that you built a production-grade circuit in 24h) One slide showing the dead-man's-switch concept as a roadmap item, not something you need working live The live app (published above) — walk through the full flow yourself: Capture & Anchor — pick a file or type a testimony. It computes a real SHA-256 hash and does real AES-GCM encryption, right there in your browser (Web Crypto API, nothing fake about that part). Anchor to chain — writes the hash \+ timestamp to a simulated public ledger (stored locally so the whole demo works offline, no wallet or gas needed for judging day). Ledger tab — see every anchor as an append-only public record, block number and all. Verify & Reveal — paste a reveal code and it decrypts the content client-side, recomputes the hash, and checks it against the chain record. There's also a "simulate tampering" button that flips a byte and shows the mismatch get caught instantly — this is the moment to lean on in your demo. How It Works — the architecture diagram and an honest breakdown of what's real crypto vs. simulated chain/IPFS in this build. Now based on the 24 hour demo plan and some extra features that you think will be useful for the project, suggest a proper plan to split the work between 4 ppl*

Response: To turn the current prototype into a competitive 24-hour hackathon submission, divide your team into four distinct roles: Smart Contract & Storage, Frontend & Web3 Integration, Cryptography & ZK Commit-Reveal, and Product, Pitch & Threat Modeling.

### **High-Impact Extra Features for Hackathon Judges**

> * **Dual-Mode Network Switch (Live Testnet \+ Offline Demo Mode):** Keep your current localStorage mock active via a toggle switch so that network congestion or testnet RPC rate limits do not break your live stage demo.  
> * **On-Chain Event Listener & Explorer Link:** When a transaction finishes on Polygon Amoy or Sepolia, display an interactive modal with direct links to Polygonscan and IPFS gateway previews.  
> * **Merkle Batching Concept / Micro-proof:** Instead of paying gas per single file, present an architecture where files are committed into a local Merkle tree, anchoring only the Merkle root to the chain.  
> * **Metadata Stripping / Sanitizer:** Automatically strip EXIF and GPS tags from images client-side before computing the hash, showing deep user-privacy awareness for activists operating under hostile surveillance.

### **4-Person Role Division & Deliverables**

| Teammate | Focus Area | Core Responsibilities | Key Deliverables (24h) |
| :---- | :---- | :---- | :---- |
| **Person 1** | **Smart Contracts & Decentralized Storage** | Solidity anchoring contract, testnet deployment, Pinata/Web3.Storage integration. | • WitnessAnchor.sol deployed on Polygon Amoy/Arbitrum Sepolia. • IPFS pin script uploading encrypted buffers. • Verified contract on block explorer. |
| **Person 2** | **Frontend UI & Web3 Connection** | Ethers.js/Viem hooks, wallet connect, mobile-responsive layout, tamper toggle. | • Polished React interface upgraded from the prototype. • Wallet connect modal (RainbowKit or simple browser-injected provider). • Real-time verification badge & byte-tamper button. |
| **Person 3** | **Client Cryptography & ZK Flow** | Native Web Crypto API hardening, commit-reveal proof, metadata stripper. | • EXIF data stripper for photos prior to SHA-256. • Working commit-reveal possession proof (hash(preimage \+ secretSalt)). • Technical circuit diagram illustrating production Groth16/SnarkJS flow. |
| **Person 4** | **Product, Threat Model & Pitch** | Presentation deck, live demo orchestration, judge Q\&A defense, UX copy. | • 3-minute pitch deck emphasizing the "Why Blockchain" value proposition. • Live demo script walking through Capture → Anchor → Tamper → Verify. • Threat model slide (censorship resistance, legal admissibility). |

### **Detailed Workstream Tasks**

**Person 1: Smart Contracts & IPFS Storage**

> * Write a clean, minimal WitnessAnchor.sol:  
>   `contract WitnessAnchor {`  
>       `event Anchored(bytes32 indexed contentHash, string ipfsCid, uint256 timestamp);`  
>       `mapping(bytes32 => uint256) public anchors;`

>       `function anchor(bytes32 contentHash, string calldata ipfsCid) external {`  
>           `require(anchors[contentHash] == 0, "Already anchored");`  
>           `anchors[contentHash] = block.timestamp;`  
>           `emit Anchored(contentHash, ipfsCid, block.timestamp);`  
>       `}`  
>   `}`

> * Deploy and verify on Polygon Amoy or Arbitrum Sepolia using Hardhat/Foundry.  
> * Hook up a client-side Pinata/Infura upload helper that receives the AES-GCM encrypted payload from Person 3 and returns a legitimate bafy... CID.

**Person 2: Frontend & Blockchain Integration**

> * Expand WitnessApp.jsx to consume ethers.js or viem.  
> * Replace randomHexTxHash() with actual contract interaction via contract.anchor(hashBytes, cid).  
> * Implement a network fallback: if a wallet is not connected, default seamlessly to the offline loadLedger() mock without throwing fatal UI errors.  
> * Build the receipt card that includes the transaction hash linked out to the active testnet block explorer.

**Person 3: Cryptography & ZK Commit-Reveal Layer**

> * Package the AES-GCM key and IV safely inside the serialized WITNESS1. string.  
> * Add an on-device privacy filter that strips EXIF metadata from uploaded images before hashing.  
> * Build the lightweight Proof of Possession tab:  
  * Owner computes a commitment: *C*\=SHA-256(SHA-256(file)∥secretSalt).  
  * Owner publishes *C*.  
  * Later, recipient issues a one-time challenge *R*; owner returns *S*\=HMAC(secretSalt,*R*).  
  * Explain in UI: *"In production, this step is replaced by a zk-SNARK preimage circuit to guarantee zero metadata leakage."*

**Person 4: Pitch Strategy & Demo Coordination**

> * Prepare the live demonstration sequence:  
  1. Capture a controversial/urgent piece of text or an image.  
  2. Anchor to testnet, open transaction on Polygonscan to prove immutability.  
  3. Send the reveal code to the "recipient" panel and verify.  
  4. Press the "Simulate Tampering" button to demonstrate an explicit hash mismatch.  
> * Build slides answering hard technical questions: gas costs at scale (L2/L3 rollups vs. Merkle batching), sybil-resistance, and evidence admissibility frameworks.

### **24-Hour Timeline Milestones**

> * **Hours 0–4 (Foundation):** Person 1 writes and deploys the contract to testnet; Person 2 stubs the React integration hooks; Person 3 standardizes file-reading, sanitization, and encryption buffers; Person 4 defines the exact pitch narrative and slide structure.  
> * **Hours 4–12 (Core Integration):** Person 1 and Person 2 integrate live contract calls and Pinata uploads with the UI; Person 3 completes the tamper-proof commit-reveal mechanism; Person 4 stress-tests edge cases and drafts the slide deck.  
> * **Hours 12–18 (Feature Lock & Polishing):** Lock all new code. Connect the UI toggle for "Live Chain / Local Demo Backup." Implement clear loading states and block explorer redirect links.  
> * **Hours 18–22 (Rehearsal & Threat Modeling):** Dry-run the live demo three times. Test deliberate failure modes (tampered byte, duplicate hash submission, network drop).  
> * **Hours 22–24 (Submission Readiness):** Record a 2-minute backup demo video, publish the repository with an updated README, and deploy the frontend to Vercel.

---

*User prompt: explain in detail what each person has to do*

## **Response: Person 1: Smart Contracts & Decentralized Storage**

This role is the backbone of the decentralized infrastructure. This person ensures the chain and storage layers are robust, deployed, and ready for the frontend to call.

> * **Contract Development:** Write the WitnessAnchor.sol contract. It needs to be extremely simple to minimize gas costs and audit surface area—essentially a mapping of bytes32 (the SHA-256 hash) to a struct containing the timestamp and the IPFS CID.  
> * **Testnet Deployment & Verification:** Deploy the contract to a low-fee testnet like Polygon Amoy or Arbitrum Sepolia. Crucially, they must verify the contract on the block explorer (e.g., Polygonscan) so judges can read the source code directly on-chain during the demo.  
> * **IPFS Integration:** Set up an account with Pinata or web3.storage. Write the exact JavaScript/TypeScript utility function that takes the encrypted blob generated by the browser, pushes it to the IPFS gateway, and returns the immutable CID (bafy...).  
> * **Backend Integration Handoff:** Provide Person 2 with the deployed contract ABI, the contract address, and the IPFS upload helper function.

## **Person 2: Frontend & Web3 Integration**

This role bridges the gap between the user interface and the blockchain. They will take the standalone WitnessApp.jsx prototype and wire it up to real decentralized networks.

> * **Wallet Integration:** Add a wallet connection library (like RainbowKit or Wagmi) to the React app so the user can sign the anchor transaction.  
> * **Upgrade the Anchor Function:** Replace the simulated doAnchor logic (which currently writes to localStorage) with an ethers.js or viem contract call to the live WitnessAnchor.sol contract.  
> * **Live Ledger Implementation:** Update the LedgerView component. Instead of reading from the simulated STORAGE\_KEY, set up an event listener or subgraph that fetches actual Anchored events from the smart contract to display the public ledger.  
> * **Failsafe Toggle:** Build a "Demo Mode" toggle that switches the app back to the original localStorage behavior if the testnet RPC endpoint goes down or gets congested during the live pitch.  
> * **Block Explorer UX:** Ensure that when a user anchors a file, the resulting success screen provides a clickable, real-world link to the transaction on the block explorer rather than just a generated string.

## **Person 3: Client Cryptography & ZK Flow**

This person focuses on the on-device security, ensuring no unencrypted data ever leaks, and building the cryptographic proofs that make the app special.

> * **Metadata Sanitizer:** Write a client-side function that strips EXIF data (GPS coordinates, device models, timestamps) from image and video files *before* they are passed to the hashing and encryption functions. This is a massive selling point for protecting activists.  
> * **Hardening Web Crypto:** Review and finalize the doHash function. Ensure the AES-GCM encryption and IV generation are handled perfectly, and that the resulting WITNESS1. payload is seamlessly packaging the decryption keys for the recipient.  
> * **Commit-Reveal Proof of Possession:** Build the lightweight demo version of the Zero-Knowledge proof. Create a flow where a user hashes their file with a secret salt (the commitment), and later reveals just the salt to prove they have the file, without revealing the file itself.  
> * **Architecture Diagramming:** Create a technical diagram illustrating how the lightweight commit-reveal step would be replaced by a production-grade zk-SNARK (e.g., using SnarkJS) in the future.

## **Person 4: Product, Pitch & Threat Modeling**

This role is responsible for the narrative. A hackathon is won on the pitch, the user experience, and the team's ability to defend their technical choices against judges' questions.

> * **Pitch Deck Creation:** Build a 3-minute presentation that immediately establishes the high-stakes problem (e.g., centralized servers can be subpoenaed or hacked; local files lack evidentiary weight). Answer the specific "Why Blockchain?" question clearly.  
> * **Live Demo Scripting:** Choreograph exactly what will happen on stage. Script the flow: upload a file, strip metadata, anchor to testnet, switch to the "Verify" tab, paste the reveal code, and use the "Simulate tampering" button to show the hash mismatch fail-state.  
> * **Threat Model Defense:** Prepare a cheat sheet for judge Q\&A. Anticipate questions on sybil attacks, gas costs at scale, legal admissibility of blockchain timestamps, and what happens if a user loses their private key.  
> * **UX Copywriting:** Polish the inline text in the app. Ensure the "How It Works" tab (AboutView) clearly explains what is real cryptography versus what is simulated, keeping the project perfectly honest.

---

*User prompt: we're planning to build with anti gravity, so wont it cause problems while integrating parts from each person, what parts should be built by a single person and what can be built by different people without any problems in integration later*

Response: Building with Google Antigravity shifts your hackathon bottleneck from writing code to orchestrating it. Because Antigravity is an agent-first IDE that allows autonomous sub-agents to execute tasks and rewrite files in the background, having four team members (and their respective AI agents) touching the exact same files simultaneously is a fast track to integration hell and endless merge conflicts.

To prevent your agents from overwriting each other's work, you must define strict boundaries. Treat your 4-person team like a microservices architecture, where each person's Antigravity workspace only communicates with the others through agreed-upon interfaces.

### **Strictly Single-Person Domains (Do Not Overlap)**

These components are highly stateful or security-critical. If multiple developers (and their agents) try to edit these concurrently, the logic will break.

> * **The Smart Contract:** Person 1 must own the Solidity development entirely. Smart contracts require absolute precision. Assign an Antigravity agent in "Planning Mode" to draft, test, and deploy the code in a completely isolated folder. Once deployed, Person 1 exports the ABI (Application Binary Interface) and contract address to the rest of the team.  
> * **Core Cryptography & ZK Logic:** Person 3 must own the on-device Web Crypto API hardening and the commit-reveal proof. Antigravity agents can easily break AES-GCM encryption buffers or hash sequence logic if another agent tries to "refactor" it for UI purposes. Keep this logic in a dedicated /crypto-utils folder that no one else's agent is allowed to modify.

### **Safe for Parallel Development**

These areas are modular enough that multiple people can leverage Antigravity's agents on them simultaneously, provided they are working in separate directories.

> * **Frontend UI vs. Web3 Hooks:** Person 2 can have an agent building out visual React components like CaptureView and VerifyView, while another team member uses an agent to write the ethers.js or viem integration hooks. Because Antigravity agents can use the integrated browser for visual testing, Person 2 can have their agent verify the UI against the existing simulated localStorage mock until the real smart contract is ready.  
> * **IPFS/Storage Scripts:** While Person 1 builds the smart contract, they can simultaneously spin up a background sub-agent to write the Pinata/web3.storage upload script. This script takes an encrypted buffer and returns a string (the CID), meaning it is purely functional and plugs easily into the frontend later.  
> * **Documentation & Threat Modeling:** Person 4 can use Antigravity's web research capabilities in a completely separate Project workspace to generate technical documentation, architecture diagrams, and the pitch deck without ever touching the source code.

### **How to Prevent Integration Nightmares**

> * **Agree on Data Structures First:** Before anyone types a prompt, agree on the exact JSON shapes and function signatures. If Person 3's crypto function is expected to output a payload matching the prototype's state like { hash, encB64, ivB64, keyB64, cid }, Person 2's UI agent can mock that exact object while Person 3 actually builds the hardened version.  
> * **Isolate Workspaces:** Use Antigravity's native Project grouping to keep your conversations and agent contexts scoped. Use a monorepo structure with distinct packages/ (e.g., packages/contracts, packages/frontend) so agents don't accidentally wander into the wrong domain.  
> * **Rely on Artifacts for Handoffs:** Instead of manually merging code, use Antigravity's Artifacts. When Person 1 finishes the smart contract, they can generate an Artifact containing the ABI and deployment address, and hand that directly to Person 2's agent to ingest.

Are you planning to use Antigravity's integrated browser to have the agents visually test the React components, or will your team test the UI manually?

---

*User prompt: also all the features u told right now arent added and have to be added right?*

Response: Yes, exactly. The WitnessApp.jsx file you provided is a self-contained, offline prototype.

Right now, the app only has the foundational client-side cryptography built-in: it does real SHA-256 hashing and real AES-GCM encryption using the browser's native Web Crypto API.

Everything else in that file is currently simulated so the UI can be tested offline:

> * **The Blockchain:** It saves records to your browser's localStorage instead of a real smart contract.  
> * **The Network:** Transaction hashes are just randomly generated strings.  
> * **Storage:** The IPFS CID is just a fake string derived from the hash, not a real upload.  
> * **Privacy:** There is no EXIF metadata stripping yet before the hash is generated.  
> * **ZK Proofs:** It clearly notes that Zero-Knowledge proofs are a roadmap item, not in the current build.

The features discussed for the 4-person team—writing the actual Solidity contract, deploying to a testnet, uploading to real IPFS (Pinata), stripping image metadata, and integrating a real crypto wallet—are exactly the tasks your team needs to build during the 24 hours to turn this prototype into a winning Web3 submission.

---

