// Paid E2E helper: send one real offeringIncense transaction using the
// on-chain mintPrice as msg.value.
// Usage: npx hardhat run scripts/incense-e2e.js --network <network>
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const cfgAddress = (await deployments.get("CFG")).address;
  const cfg = await ethers.getContractAt("CyberFortuneGod", cfgAddress, deployer);

  const mintPrice = await cfg.mintPrice();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`mintPrice=${ethers.formatEther(mintPrice)} balance=${ethers.formatEther(balance)}`);
  if (balance < mintPrice) {
    throw new Error("Deployer balance is below mintPrice");
  }

  const tx = await cfg.offeringIncense({ value: mintPrice });
  const receipt = await tx.wait();
  console.log(`incense tx: ${tx.hash} block: ${receipt.blockNumber} logs: ${receipt.logs.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
