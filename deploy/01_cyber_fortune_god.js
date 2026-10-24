const { ethers } = require("hardhat");
const params = require('../args/cfg');

module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const impl = await deploy('Impl', {
        from: deployer,
        contract: 'CyberFortuneGod',
        args: params,
        log: true,
        skipIfAlreadyDeployed: true,
    });

    const CFG = await ethers.getContractFactory('CyberFortuneGod');
    const cfdImpl = CFG.attach(impl.address);

    const fragment = CFG.interface.getFunction('initialize(uint256, uint256, uint256, uint256)');
    const cfdProxyData = cfdImpl.interface.encodeFunctionData(fragment, params);
    console.log('proxy data', cfdProxyData);

    const proxyAdminAddress = (await deployments.get('ProxyAdmin')).address;
    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    const proxyAdmin = ProxyAdmin.attach(proxyAdminAddress);

    const proxy = await deploy('CFG', {
        from: deployer,
        contract: 'MyTransparentUpgradeableProxy',
        args: [impl.address, proxyAdminAddress, cfdProxyData],
        log: true,
        skipIfAlreadyDeployed: true,
    });

    const proxyAddress = proxy.address;
    const currentImplAddress = await proxyAdmin.getProxyImplementation(proxyAddress);
    if (currentImplAddress !== ethers.ZeroAddress && currentImplAddress.toLowerCase() !== impl.address.toLowerCase()) {
        throw new Error(
            `CFG proxy ${proxyAddress} uses implementation ${currentImplAddress}; ` +
            `normal deployment will not upgrade it. Run NEW_IMPL_ADDRESS=${impl.address} ` +
            `npx hardhat run scripts/upgrade.js --network <network>.`
        );
    }

    const cfd = CFG.attach(proxyAddress);
    const initialized = [
        [ "startTime", params[0].toString(), (await cfd.startTime()).toString() ],
        [ "decreaseCoefficient", params[1].toString(), (await cfd.decreaseCoefficient()).toString() ],
        [ "totalSupplyByDay", params[2].toString(), (await cfd.totalSupplyByDay()).toString() ],
        [ "mintPrice", params[3].toString(), (await cfd.mintPrice()).toString() ]
    ];
    const mismatches = initialized.filter(([, expected, actual]) => expected !== actual);
    if (mismatches.length > 0) {
        throw new Error(`CFG initialized parameters do not match deployment: ${JSON.stringify(mismatches)}`);
    }

    const proxyAdminOnChain = await proxyAdmin.getProxyAdmin(proxyAddress);
    if (proxyAdminOnChain.toLowerCase() !== proxyAdminAddress.toLowerCase()) {
        throw new Error(`CFG proxy admin mismatch: expected ${proxyAdminAddress}, got ${proxyAdminOnChain}`);
    }
    console.log(`CFG ready on chain ${await getChainId()}: proxy=${proxyAddress}, implementation=${currentImplAddress}`);
};
module.exports.tags = ['CyberFortuneGod'];
