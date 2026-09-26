const hre = require("hardhat");

async function main() {
  const WitnessAnchor = await hre.ethers.getContractFactory("WitnessAnchor");
  const witness = await WitnessAnchor.deploy();

  await witness.waitForDeployment();

  console.log(`WitnessAnchor deployed to: ${await witness.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
