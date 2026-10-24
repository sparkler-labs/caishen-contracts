// Local E2E helper: approve and draw one fortune stick from the deployer account.
// Usage: npx hardhat run scripts/draw-e2e.js --network localhost
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const cfgAddress = (await deployments.get("CFG")).address;
  const meritAddress = (await deployments.get("MeritCoin")).address;
  const cfg = await ethers.getContractAt("CyberFortuneGod", cfgAddress, deployer);
  const merit = await ethers.getContractAt("MeritCoin", meritAddress, deployer);

  const balance = await merit.balanceOf(deployer.address);
  if (balance < ethers.parseEther("8")) {
    const mintPrice = await cfg.mintPrice();
    const incense = await cfg.offeringIncense({ value: mintPrice });
    await incense.wait();
    console.log(`[e2e] offeringIncense tx: ${incense.hash}`);
  }

  const allowance = await merit.allowance(deployer.address, cfgAddress);
  if (allowance < ethers.parseEther("8")) {
    const approve = await merit.approve(cfgAddress, ethers.parseEther("8"));
    await approve.wait();
    console.log(`[e2e] approve tx: ${approve.hash}`);
  }

  const draw = await cfg.drawFortune();
  const receipt = await draw.wait();
  console.log(`[e2e] drawFortune tx: ${draw.hash} block: ${receipt.blockNumber} logs: ${receipt.logs.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
