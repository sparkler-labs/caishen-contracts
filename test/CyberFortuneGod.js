const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

describe("CyberFortuneGod business flow", function () {
  async function deployFixture() {
    const [owner, firstUser, secondUser, thirdUser, fourthUser, other] = await ethers.getSigners();
    const now = await time.latest();
    const startTime = now - 1;
    const coefficient = ethers.parseEther("1.04491013");
    const dailySupply = ethers.parseEther("888");
    const mintPrice = ethers.parseEther("88");

    const CyberFortuneGod = await ethers.getContractFactory("CyberFortuneGod");
    const cfd = await CyberFortuneGod.deploy(startTime, coefficient, dailySupply, mintPrice);
    const MeritCoin = await ethers.getContractFactory("MeritCoin");
    const merit = await MeritCoin.deploy(cfd.target);
    const FortuneStick = await ethers.getContractFactory("FortuneStick");
    const fortuneStick = await FortuneStick.deploy(cfd.target, "https://metadata.example/nst");

    await cfd.initMeritCoin(merit.target);
    await cfd.initFortuneStick(fortuneStick.target);

    return {
      cfd,
      merit,
      fortuneStick,
      owner,
      firstUser,
      secondUser,
      thirdUser,
      fourthUser,
      other,
      mintPrice,
      dailySupply
    };
  }

  it("mints 88/66/36/30 MERIT in order and enforces three calls per wallet", async function () {
    const { cfd, merit, owner, firstUser, secondUser, thirdUser, fourthUser, mintPrice, dailySupply } =
      await loadFixture(deployFixture);

    const users = [firstUser, secondUser, thirdUser, fourthUser];
    const expected = [88n, 66n, 36n, 30n];
    for (let index = 0; index < users.length; index += 1) {
      await expect(cfd.connect(users[index]).offeringIncense({ value: mintPrice }))
        .to.emit(cfd, "OfferingIncense")
        .withArgs(users[index].address, ethers.parseEther(expected[index].toString()));
      expect(await merit.balanceOf(users[index].address)).to.equal(ethers.parseEther(expected[index].toString()));
    }

    expect(await cfd.remainingSupply()).to.equal(dailySupply - ethers.parseEther("220"));
    await expect(cfd.connect(owner).offeringIncense({ value: mintPrice })).to.emit(cfd, "OfferingIncense");
    await expect(cfd.connect(owner).offeringIncense({ value: mintPrice })).to.emit(cfd, "OfferingIncense");
    await expect(cfd.connect(owner).offeringIncense({ value: mintPrice })).to.emit(cfd, "OfferingIncense");
    await expect(cfd.connect(owner).offeringIncense({ value: mintPrice })).to.be.revertedWith(
      "CyberFortuneGod: Mint up to three times a day"
    );
  });

  it("rejects an insufficient native payment", async function () {
    const { cfd, firstUser, mintPrice } = await loadFixture(deployFixture);

    await expect(cfd.connect(firstUser).offeringIncense({ value: mintPrice - 1n })).to.be.revertedWith(
      "CyberFortuneGod: payment amount is insufficient"
    );
  });

  it("mints no initial supply at deployment", async function () {
    const { merit, owner } = await loadFixture(deployFixture);

    expect(await merit.totalSupply()).to.equal(0n);
    expect(await merit.balanceOf(owner.address)).to.equal(0n);
  });

  it("charges exactly 8 MERIT, mints an NFT and records the original drawer", async function () {
    const { cfd, merit, fortuneStick, owner, firstUser, mintPrice } = await loadFixture(deployFixture);
    const drawCost = ethers.parseEther("8");

    await cfd.offeringIncense({ value: mintPrice });
    await merit.approve(cfd.target, drawCost);
    await expect(cfd.drawFortune())
      .to.emit(cfd, "DrawFortune")
      .withArgs(owner.address, 0n, anyValue);
    const [, stickNo] = await fortuneStick.getStickNo(0);
    const expectedStickNo =
      (BigInt(
        ethers.keccak256(
          ethers.solidityPacked(
            ["address", "string", "address", "string"],
            [await fortuneStick.getAddress(), "0", owner.address, (await fortuneStick.mintTime(0)).toString()]
          )
        )
      ) %
        60n) +
      1n;
    expect(stickNo).to.equal(expectedStickNo);
    expect(stickNo >= 1n && stickNo <= 60n).to.equal(true);
    expect(await merit.balanceOf(owner.address)).to.equal(ethers.parseEther("80"));
    expect(await fortuneStick.ownerOf(0)).to.equal(owner.address);
    expect(await fortuneStick.tokenMinter(0)).to.equal(owner.address);
    expect(await fortuneStick.tokenURI(0)).to.match(/^https:\/\/metadata\.example\/nst\/0\//);

    await expect(fortuneStick.connect(owner).transferFrom(owner.address, firstUser.address, 0n))
      .to.emit(fortuneStick, "Transfer")
      .withArgs(owner.address, firstUser.address, 0n);
    expect(await fortuneStick.ownerOf(0)).to.equal(firstUser.address);
    expect(await fortuneStick.tokenMinter(0)).to.equal(owner.address);
  });

  it("rejects allowance below 8 MERIT and direct NFT minting by non-minters", async function () {
    const { cfd, merit, fortuneStick, owner, other } = await loadFixture(deployFixture);

    await merit.approve(cfd.target, ethers.parseEther("7.99"));
    await expect(cfd.drawFortune()).to.be.revertedWith(
      "CyberFortuneGod: Requires 8 Merit Coin to draw fortune stick"
    );
    await expect(fortuneStick.connect(other).draw(other.address)).to.be.revertedWith(
      "DrawFortuneStick: You are not minter"
    );
    await expect(cfd.connect(other).setMintPrice(1n)).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(cfd.connect(owner).initMeritCoin(other.address)).to.be.revertedWith(
      "CyberFortuneGod: meritCoin has been set"
    );
  });

  it("keeps the configured price and base URI behind owner-only controls", async function () {
    const { cfd, fortuneStick, owner, other } = await loadFixture(deployFixture);
    const nextPrice = ethers.parseEther("89");
    const nextBaseURI = "https://metadata.example/nst-v2";

    await expect(cfd.setMintPrice(nextPrice)).to.emit(cfd, "SetMintPrice").withArgs(owner.address, ethers.parseEther("88"), nextPrice);
    expect(await cfd.mintPrice()).to.equal(nextPrice);
    await expect(fortuneStick.setBaseURI(nextBaseURI)).to.emit(fortuneStick, "SetBaseURI");
    expect(await fortuneStick.baseURI()).to.equal(nextBaseURI);
    await expect(fortuneStick.connect(other).setBaseURI("https://invalid.example")).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
  });
});
