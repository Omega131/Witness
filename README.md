# Witness: Zero-Trust Evidence Anchoring

Witness is a privacy-first, blockchain-anchored proof-of-existence protocol designed for activists, journalists, and human rights investigators. It allows anyone to cryptographically prove that a piece of evidence (photo, video, document, or testimony) existed at a specific point in time and has not been altered since, without relying on a centralized server.

## How It Works

Instead of uploading raw, vulnerable files to a centralized database, Witness ensures complete privacy and immutability through a decentralized architecture:

1. **On-Device Hashing & Encryption:** When you upload evidence, your browser generates a random AES-GCM 256-bit key. The file is hashed (SHA-256) and encrypted entirely **on your device**. The server never sees the raw file.
2. **Decentralized Storage:** The encrypted file is uploaded to IPFS (via Pinata) to ensure it cannot be censored or taken down by a single authority.
3. **Multi-Chain Smart Contract Anchoring:** The file's cryptographic hash and IPFS CID are anchored to a public blockchain (supporting **Celo Sepolia** and **Polygon Amoy**) via a smart contract. This provides an immutable timestamp.
4. **Key Management:** You are provided with a "Private Decryption Code" containing the AES key. Only people with this code can decrypt the evidence.

## Features

- **Multi-Chain Support:** Users can choose to anchor evidence securely on Celo Sepolia (paying gas in CELO) or Polygon Amoy (paying gas in POL).
- **Offline Sync:** If you are disconnected from the internet (e.g., in a conflict zone), the app encrypts and hashes your evidence locally. When you regain connection, it automatically syncs and anchors your records to the blockchain.
- **AI Detection Integration:** When viewing decrypted evidence in the Verify tab, users can scan text documents using the **Gemini 3.8 Flash** model to assess the likelihood that the evidence was AI-generated.

## Tech Stack

- **Frontend:** React (Vite)
- **Web3 Interface:** ethers.js (v6)
- **Smart Contracts:** Solidity, Hardhat
- **Storage:** IPFS (Pinata)
- **AI Integration:** Google Gemini API

## Project Structure

- contracts: Contains the Hardhat project and the `WitnessAnchor.sol` Solidity contract.
- Witness: Contains the Vite + React frontend application.
- src/App.jsx: The core React application containing the UI, web3 interactions, and on-device cryptography logic.
- src/utils/pinata.js: Helper functions for uploading encrypted blobs to IPFS.

## Local Development Setup

### 1. Prerequisites
- Node.js (v18+)
- A Coinbase Wallet or MetaMask extension installed in your browser.
- A Pinata API account (for IPFS uploads).
- A Google Gemini API key (for AI detection).

### 2. Frontend Setup
```bash
cd Witness
npm install
```

Create a .env file in the /Witness directory:
```bash
VITE_PINATA_JWT=your_pinata_jwt_here
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

Start the development server:
```bash
npm run dev
```

### 3. Smart Contract Setup
```bash
cd contracts
npm install
```

Create a .env file in the /contracts directory:
```bash
RPC_URL=https://forno.celo-sepolia.celo-testnet.org
PRIVATE_KEY=your_wallet_private_key
```

Deploy to Celo Sepolia:
```bash
npx hardhat run scripts/deploy.js --network testnet
```

## License
MIT License

## Demo
```
https://github.com/user-attachments/assets/a5dd2a68-bbc2-43a5-8e3d-8677ed6bb03e
```





