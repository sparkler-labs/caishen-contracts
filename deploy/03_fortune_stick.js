const { ethers } = require("hardhat");
const { parameter, optionalParameter } = require("../args/params");
const baseURI = parameter("FORTUNE_STICK_BASE_URI", "http://127.0.0.1:3000");

module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const CFG = await ethers.getContractFactory('CyberFortuneGod');
    const cfdAddress = (await deployments.get('CFG')).address;
    const cfd = CFG.attach(cfdAddress);

    const fortuneStick = await deploy('FortuneStick', {
        from: deployer,
        args: [cfdAddress, baseURI],
        log: true,
        skipIfAlreadyDeployed: true,
    });
    const FortuneStick = await ethers.getContractFactory('FortuneStick');
    const fortuneStickContract = FortuneStick.attach(fortuneStick.address);

    const getFortuneStick = await cfd.fortuneStick();
    if (getFortuneStick === ethers.ZeroAddress) {
        await cfd.initFortuneStick(fortuneStick.address)
        console.log("init FortuneStick done");
    } else if (getFortuneStick.toLowerCase() !== fortuneStick.address.toLowerCase()) {
        throw new Error(`CFG fortuneStick is initialized to ${getFortuneStick}, expected ${fortuneStick.address}`);
    }

    const chainId = await getChainId();
    const finalBaseURI = (optionalParameter("FORTUNE_STICK_FINAL_BASE_URI") || `${baseURI.replace(/\/$/, '')}/api/v2/chains/${chainId}/nfts/${fortuneStick.address}/metadata`).replace('{FORTUNE_STICK_ADDRESS}', fortuneStick.address);
    if (!/^https?:\/\//i.test(finalBaseURI)) {
        throw new Error(`FORTUNE_STICK_FINAL_BASE_URI must be an HTTP(S) URL: ${finalBaseURI}`);
    }
    const owner = await fortuneStickContract.owner();
    if (owner.toLowerCase() !== deployer.toLowerCase()) {
        throw new Error(`FortuneStick owner mismatch: expected deployer ${deployer}, got ${owner}`);
    }
    const minter = await fortuneStickContract.minter();
    if (minter.toLowerCase() !== cfdAddress.toLowerCase()) {
        throw new Error(`FortuneStick minter mismatch: expected CFG ${cfdAddress}, got ${minter}`);
    }
    const currentBaseURI = await fortuneStickContract.baseURI();
    if (currentBaseURI !== finalBaseURI) {
        const tx = await fortuneStickContract.setBaseURI(finalBaseURI);
        await tx.wait();
        console.log(`set final FortuneStick baseURI: ${finalBaseURI}`);
    }

    const verifiedBaseURI = await fortuneStickContract.baseURI();
    if (verifiedBaseURI !== finalBaseURI) {
        throw new Error(`FortuneStick baseURI readback failed: ${verifiedBaseURI}`);
    }
    const totalSupply = await fortuneStickContract.totalSupply();
    if (totalSupply > 0n) {
        const tokenURI = await fortuneStickContract.tokenURI(0);
        if (!tokenURI.startsWith(finalBaseURI)) {
            throw new Error(`FortuneStick tokenURI verification failed: ${tokenURI}`);
        }
    }

};
module.exports.tags = ['FortuneStick'];
