const hre = require("hardhat");
const { deployments, ethers } = hre;

async function main() {
  const FortuneStick = await hre.ethers.getContractFactory("FortuneStick");
  const address = (await deployments.get('FortuneStick')).address;
  const fortuneStick = FortuneStick.attach(address);
  const [signer] = await ethers.getSigners();
  const chainId = await hre.getChainId();
  const requestedBaseURI = process.env.FORTUNE_STICK_FINAL_BASE_URI || process.env.FORTUNE_STICK_BASE_URI;
  if (!requestedBaseURI) {
    throw new Error("Set FORTUNE_STICK_FINAL_BASE_URI (or FORTUNE_STICK_BASE_URI) explicitly");
  }
  const baseURI = requestedBaseURI.replace('{FORTUNE_STICK_ADDRESS}', address).replace(/\/$/, '');
  if (!/^https?:\/\//i.test(baseURI)) {
    throw new Error(`Base URI must be an HTTP(S) URL: ${baseURI}`);
  }
  const owner = await fortuneStick.owner();
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(`Signer ${signer.address} is not FortuneStick owner ${owner}`);
  }

  if (await fortuneStick.baseURI() !== baseURI) {
    const tx = await fortuneStick.setBaseURI(baseURI);
    await tx.wait();
  }
  const actual = await fortuneStick.baseURI();
  if (actual !== baseURI) {
    throw new Error(`FortuneStick baseURI readback failed: ${actual}`);
  }
  const totalSupply = await fortuneStick.totalSupply();
  if (totalSupply > 0n) {
    const tokenURI = await fortuneStick.tokenURI(0);
    if (!tokenURI.startsWith(`${baseURI}/`)) {
      throw new Error(`FortuneStick tokenURI verification failed on chain ${chainId}: ${tokenURI}`);
    }
  }
  console.log(JSON.stringify({ chainId, address, baseURI, totalSupply: totalSupply.toString() }, null, 2));

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
