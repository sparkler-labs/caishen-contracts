const { ethers } = require("hardhat");
const { parameter } = require("./params");

function parseTimestamp(value, name) {
    const timestamp = Number.parseInt(value, 10);
    if (!Number.isSafeInteger(timestamp) || timestamp < 0) {
        throw new Error(`${name} must be a non-negative integer timestamp`);
    }
    return timestamp.toString();
}

const startTime = parseTimestamp(parameter("CFG_START_TIME", "1719698400"), "CFG_START_TIME");
const decreaseCoefficient = ethers.parseEther(parameter("CFG_DECREASE_COEFFICIENT", "1.04491013"));
const totalSupplyByDay = ethers.parseEther(parameter("CFG_TOTAL_SUPPLY_BY_DAY", "888"));
const mintPrice = ethers.parseEther(parameter("CFG_MINT_PRICE", "88"));

if (decreaseCoefficient <= 0n || totalSupplyByDay <= 0n || mintPrice < 0n) {
    throw new Error("CFG economic parameters must be positive (mint price may be zero)");
}

module.exports = [startTime, decreaseCoefficient, totalSupplyByDay, mintPrice];
