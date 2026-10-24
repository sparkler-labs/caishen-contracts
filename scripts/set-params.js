// Operational script: update the on-chain mintPrice for one network.
// Usage: SET_MINT_PRICE=<native amount, e.g. 0.002> npx hardhat run scripts/set-params.js --network <network>
// CFG_PROXY_ADDRESS optionally overrides the target proxy (defaults to deployments/<network>/CFG.json).
// Flow: owner check -> read current value (skip if unchanged) -> setMintPrice -> read back -> JSON report.
const hre = require("hardhat");
const { deployments, ethers } = hre;

async function main() {
  const requested = process.env.SET_MINT_PRICE;
  if (!requested || !/^\d+(\.\d+)?$/.test(requested.trim())) {
    throw new Error("Set SET_MINT_PRICE in native currency units (e.g. 88 or 0.05)");
  }
  const targetPrice = ethers.parseEther(requested.trim());

  let proxyAddress = process.env.CFG_PROXY_ADDRESS;
  if (!proxyAddress) {
    proxyAddress = (await deployments.get("CFG")).address;
  }
  const cfg = await ethers.getContractAt("CyberFortuneGod", proxyAddress);
  const [signer] = await ethers.getSigners();
  const chainId = await hre.getChainId();

  const owner = await cfg.owner();
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(`Signer ${signer.address} is not CFG proxy owner ${owner}`);
  }

  const oldPrice = await cfg.mintPrice();
  let transactionHash = null;
  let status = "skipped";
  if (oldPrice === targetPrice) {
    console.log(`mintPrice already ${ethers.formatEther(oldPrice)}, nothing to do`);
  } else {
    const tx = await cfg.setMintPrice(targetPrice);
    const receipt = await tx.wait();
    transactionHash = receipt.hash;
    status = "updated";
  }

  const newPrice = await cfg.mintPrice();
  if (newPrice !== targetPrice) {
    throw new Error(`CFG mintPrice readback failed: expected ${targetPrice}, got ${newPrice}`);
  }
  console.log(
    JSON.stringify(
      {
        chainId,
        proxy: proxyAddress,
        oldMintPrice: oldPrice.toString(),
        newMintPrice: newPrice.toString(),
        oldMintPriceEther: ethers.formatEther(oldPrice),
        newMintPriceEther: ethers.formatEther(newPrice),
        transactionHash,
        status,
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
