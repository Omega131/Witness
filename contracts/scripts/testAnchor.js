const hre = require("hardhat");

async function main() {
  const contractAddress = "0x6cd840081fD86a3Af530dc6Fd06adcD100B1f590";
  
  console.log(`Connecting to WitnessAnchor at ${contractAddress}...`);
  const witness = await hre.ethers.getContractAt("WitnessAnchor", contractAddress);

  // Create a dummy SHA-256 hash (simulating what the frontend will do)
  const dummyHash = hre.ethers.id("Hello Hackathon Judges!");
  const dummyCid = "bafy_fake_ipfs_cid_for_testing";

  console.log(`\nAnchoring Evidence:`);
  console.log(`- Hash: ${dummyHash}`);
  console.log(`- CID: ${dummyCid}`);
  
  console.log(`\nSending transaction to Celo Sepolia...`);
  const tx = await witness.anchor(dummyHash, dummyCid);
  console.log(`Transaction Hash: ${tx.hash}`);
  
  console.log(`Waiting for block confirmation...`);
  await tx.wait();
  
  console.log(`\nSuccess! Evidence Anchored.`);
  
  // Verify by reading it back from the blockchain
  const timestamp = await witness.anchors(dummyHash);
  console.log(`\nVerified on-chain: Hash exists with timestamp ${timestamp}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
