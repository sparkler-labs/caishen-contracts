require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require('hardhat-deploy');
require('dotenv').config();

const privateKey = process.env.PRIVATE_KEY ?? "NO_PRIVATE_KEY";
// hardhat-verify 2.1.x uses the Etherscan V2 API when a single key is supplied.
// The same key covers BSC and the other Etherscan-family chains.
const scanKey = process.env.ETHERSCAN_API_KEY || "ETHERSCAN_API_KEY";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: process.env.LOCAL_RPC_URL || "http://127.0.0.1:8545",
      chainId: 31337,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
      accounts: [`${privateKey}`],
      chainId: 11155111,
    },
    // BSC mainnet: gasPrice is pinned to 1 gwei in this config.
    bsc: {
      url: process.env.BSC_RPC_URL || "https://bsc-dataseed.bnbchain.org",
      accounts: [`${privateKey}`],
      chainId: 56,
      gasPrice: 1000000000,
    },
    "bsc-test": {
      url: process.env.BSC_TEST_RPC_URL || "https://bsc-testnet-rpc.publicnode.com",
      accounts: [`${privateKey}`],
      chainId: 97,
    },
    arb: {
      url: process.env.ARB_RPC_URL || "https://arb1.arbitrum.io/rpc",
      accounts: [`${privateKey}`],
      chainId: 42161,
    },
    "arb-test": {
      url: process.env.ARB_TEST_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
      accounts: [`${privateKey}`],
      chainId: 421614,
    },
    robinhood: {
      url: process.env.ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com",
      accounts: [`${privateKey}`],
      chainId: 4663,
    },
    "robinhood-test": {
      url: process.env.ROBINHOOD_TEST_RPC_URL || "https://rpc.testnet.chain.robinhood.com",
      accounts: [`${privateKey}`],
      chainId: 46630,
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          // Pin the EVM target so the same bytecode can be deployed on chains
          // without PUSH0. Verify opcode compatibility before changing it.
          evmVersion: "paris",
          optimizer: {
            enabled: true,
            runs: 200,
          },
          outputSelection: {
            "*": {
              "*": ["storageLayout"],
            },
          },
        },
      },
    ],
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
    deploy: "./deploy",
    deployments: "./deployments",
  },
  namedAccounts: {
    deployer: 0
  },
  etherscan: {
    apiKey: scanKey,
  },
  // Sourcify's hardhat-verify integration still calls the removed v1 API (404).
  // Re-enable after upgrading to a plugin version that supports the v2 API.
  sourcify: {
    enabled: false
  },
};
