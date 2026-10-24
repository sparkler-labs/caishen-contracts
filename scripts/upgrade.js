const crypto = require("crypto");
const hre = require("hardhat");
const { deployments, ethers } = hre;

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

function requireAddress(value, name) {
  if (!ADDRESS_PATTERN.test(value || "") || value.toLowerCase() === ethers.ZeroAddress) {
    throw new Error(`${name} must be a non-zero EVM address`);
  }
  return value;
}

async function storageLayoutReport() {
  const buildInfo = await hre.artifacts.getBuildInfo("contracts/CyberFortuneGod.sol:CyberFortuneGod");
  const contracts = buildInfo?.output?.contracts || {};
  const contractOutput = Object.values(contracts)
    .map((sourceContracts) => sourceContracts.CyberFortuneGod)
    .find(Boolean);
  const layout = contractOutput?.storageLayout;
  if (!layout) {
    return { status: "unavailable", reason: "编译产物未包含 storageLayout" };
  }

  const serialized = JSON.stringify(layout);
  return {
    status: "manual_review_required",
    new_implementation_layout_hash: `sha256:${crypto.createHash("sha256").update(serialized).digest("hex")}`,
    new_implementation_slots: layout.storage?.length || 0,
    note: "必须将该布局与当前生产实现的已审阅布局逐槽位比较；脚本不会自动承诺存储兼容。"
  };
}

async function main() {
  const proxyAddress = requireAddress(
    process.env.CFG_PROXY_ADDRESS || (await deployments.get("CFG")).address,
    "CFG_PROXY_ADDRESS"
  );
  const proxyAdminAddress = requireAddress(
    process.env.PROXY_ADMIN_ADDRESS || (await deployments.get("ProxyAdmin")).address,
    "PROXY_ADMIN_ADDRESS"
  );
  const newImplementationAddress = requireAddress(process.env.NEW_IMPL_ADDRESS, "NEW_IMPL_ADDRESS");

  const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
  const proxyAdmin = ProxyAdmin.attach(proxyAdminAddress);
  const currentImplementationAddress = await proxyAdmin.getProxyImplementation(proxyAddress);
  const expectedCurrent = process.env.EXPECTED_IMPL_ADDRESS;
  if (expectedCurrent && currentImplementationAddress.toLowerCase() !== expectedCurrent.toLowerCase()) {
    throw new Error(
      `当前实现 ${currentImplementationAddress} 与 EXPECTED_IMPL_ADDRESS ${expectedCurrent} 不一致，已停止升级`
    );
  }
  if (currentImplementationAddress.toLowerCase() === newImplementationAddress.toLowerCase()) {
    console.log(JSON.stringify({ status: "already_current", proxyAddress, currentImplementationAddress }, null, 2));
    return;
  }

  const code = await ethers.provider.getCode(newImplementationAddress);
  if (code === "0x") {
    throw new Error(`NEW_IMPL_ADDRESS 没有合约代码：${newImplementationAddress}`);
  }

  const report = {
    status: "ready",
    chainId: Number(await hre.network.provider.send("eth_chainId")),
    proxyAddress,
    proxyAdminAddress,
    currentImplementationAddress,
    newImplementationAddress,
    storageCompatibility: await storageLayoutReport(),
    reason: process.env.UPGRADE_REASON || null
  };
  console.log(JSON.stringify(report, null, 2));
  if (process.env.CONFIRM_UPGRADE !== "true") {
    throw new Error("升级是显式操作；确认后设置 CONFIRM_UPGRADE=true 重试");
  }

  const tx = await proxyAdmin.upgrade(proxyAddress, newImplementationAddress);
  await tx.wait();
  const actualImplementationAddress = await proxyAdmin.getProxyImplementation(proxyAddress);
  if (actualImplementationAddress.toLowerCase() !== newImplementationAddress.toLowerCase()) {
    throw new Error(`升级读回失败：${actualImplementationAddress}`);
  }
  console.log(JSON.stringify({ ...report, status: "upgraded", transactionHash: tx.hash, actualImplementationAddress }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
