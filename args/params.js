const { network } = require("hardhat");

const LOCAL_NETWORKS = new Set(["hardhat", "localhost"]);

// Networks with a prefix read only <PREFIX>_... variables. This keeps
// economic parameters isolated per chain instead of reusing one chain's values.
const PREFIXED_NETWORKS = {
    sepolia: "SEPOLIA",
    bsc: "BSC",
    "bsc-test": "BSC_TEST",
    arb: "ARB",
    "arb-test": "ARB_TEST",
    robinhood: "ROBINHOOD",
    "robinhood-test": "ROBINHOOD_TEST",
};

function prefixFor(networkName) {
    return PREFIXED_NETWORKS[networkName] || null;
}

function isLocalNetwork(networkName) {
    return LOCAL_NETWORKS.has(networkName);
}

/**
 * 读取部署参数：
 * 1. 带前缀网络（bsc/bsc-test）只认 `${PREFIX}_${name}`；
 * 2. 其他网络读 `${name}`；
 * 3. 本地网络在环境变量缺失时回落 localDefault。
 * 缺少必需参数时在任何部署交易发出之前抛出。
 */
function parameter(name, localDefault) {
    const prefix = prefixFor(network.name);
    const prefixed = prefix && process.env[`${prefix}_${name}`]?.trim();
    if (prefixed) {
        return prefixed;
    }
    if (!prefix) {
        const generic = process.env[name]?.trim();
        if (generic) {
            return generic;
        }
    }
    if (isLocalNetwork(network.name) && localDefault !== undefined) {
        return localDefault;
    }
    const scope = prefix ? `${prefix}_${name}` : name;
    throw new Error(`${scope} is required before deploying to ${network.name}`);
}

/** 与 parameter 类似，但允许缺失（返回 undefined），用于有派生默认值的可选参数。 */
function optionalParameter(name) {
    const prefix = prefixFor(network.name);
    const prefixed = prefix && process.env[`${prefix}_${name}`]?.trim();
    if (prefixed) {
        return prefixed;
    }
    if (!prefix) {
        return process.env[name]?.trim();
    }
    return undefined;
}

module.exports = { parameter, optionalParameter, prefixFor, isLocalNetwork };
