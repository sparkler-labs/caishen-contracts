const { ethers } = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const CFG = await ethers.getContractFactory('CyberFortuneGod');
    const cfdAddress = (await deployments.get('CFG')).address;
    const cfd = CFG.attach(cfdAddress);

    // 部署不铸造任何初始供应，MERIT 只能经 CFG offeringIncense 增发。
    const meritCoin = await deploy('MeritCoin', {
        from: deployer,
        args: [cfdAddress],
        log: true,
        skipIfAlreadyDeployed: true,
    });

    const getMeritCoin = await cfd.meritCoin();
    if (getMeritCoin === ethers.ZeroAddress) {
        await cfd.initMeritCoin(meritCoin.address)
        console.log("init MeritCoin done");
    } else if (getMeritCoin.toLowerCase() !== meritCoin.address.toLowerCase()) {
        throw new Error(`CFG meritCoin is initialized to ${getMeritCoin}, expected ${meritCoin.address}`);
    }

};
module.exports.tags = ['MeritCoin'];
