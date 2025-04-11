const { ethers } = require("ethers");
const schedule = require("node-schedule");
const chalk = require("chalk");
const inquirer = require("inquirer");
const clear = require("clear");
const fs = require("fs");
require("dotenv").config();

// Constants
const PROJECT_NAME = "Citrus Swap";
const CREATOR_NAME = "aetrna";
const RPC_URL = "https://rpc.testnet.citrea.xyz";
const ROUTER_ADDRESS = "0xb45670f668EE53E62b5F170B5B1d3C6701C8d03A";
const USDT_ADDRESS = "0xb669dC8cC6D044307Ba45366C0c836eC3c7e31AA";
const PAIR_ADDRESS = "0x2252998B8281ba168Ab11b620b562035dC34EAE0";

// Load all private keys from .env
const PRIVATE_KEYS = Object.keys(process.env)
  .filter((key) => key.startsWith("PRIVATE_KEY_"))
  .map((key) => process.env[key]);

// Contract ABIs
const routerAbi = [
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function WETH() external pure returns (address)",
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)"
];

const pairAbi = [
  "function getReserves() external view returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)"
];

const usdtAbi = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function balanceOf(address account) public view returns (uint256)",
  "function decimals() public view returns (uint8)"
];

const colors = [
  chalk.red,
  chalk.yellow,
  chalk.green,
  chalk.cyan,
  chalk.blue,
  chalk.magenta,
];

// ASCII art
const asciiArt = [
  "..%%%%...%%%%%%..%%%%%%..%%%%%...%%..%%...%%%%..",
  ".%%..%%..%%........%%....%%..%%..%%%.%%..%%..%%.",
  ".%%%%%%..%%%%......%%....%%%%%...%%.%%%..%%%%%%.",
  ".%%..%%..%%........%%....%%..%%..%%..%%..%%..%%.",
  ".%%..%%..%%%%%%....%%....%%..%%..%%..%%..%%..%%.",
  "................................................",
];

function displayInterface() {
  clear();
  console.log(chalk.magenta(`================ ${PROJECT_NAME} Auto-bot ====================`));
  console.log("");
  asciiArt.forEach((line, index) => console.log(colors[index](line)));
  console.log("");
  console.log(chalk.magenta(`================= Created by: ${CREATOR_NAME} ====================`));
  console.log("");
}

async function getPrivateKeys() {
  if (PRIVATE_KEYS.length === 0) {
    displayInterface();
    const privateKeys = [];
    let walletIndex = 1;

    while (true) {
      const { pk } = await inquirer.prompt([
        {
          type: "input",
          name: "pk",
          message: chalk.cyan(`Private key ${walletIndex} (without 0x, or Enter to finish): `),
          validate: (input) => input === "" || /^[0-9a-fA-F]{64}$/.test(input) || "Invalid private key!"
        },
      ]);

      if (pk === "") break;
      privateKeys.push(pk);
      walletIndex++;
    }

    if (privateKeys.length === 0) throw new Error("No private keys provided!");

    const envContent = privateKeys
      .map((key, index) => `PRIVATE_KEY_${index + 1}=${key}`)
      .join("\n") + "\n";
    fs.writeFileSync(".env", envContent, { flag: "w" });
    console.log(chalk.green(`✅ ${privateKeys.length} private key(s) saved!`));

    privateKeys.forEach((key, index) => {
      process.env[`PRIVATE_KEY_${index + 1}`] = key;
    });
    PRIVATE_KEYS.push(...privateKeys);
  }
}

async function initializeWallet() {
  await getPrivateKeys();
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  await provider.getBlockNumber()
    .then((block) => console.log(chalk.blue(`🤖 Connected to RPC, block: ${block}`)))
    .catch((err) => console.error(chalk.red(`❌ RPC Connection failed: ${err.message}`)));
  
  const randomIndex = Math.floor(Math.random() * PRIVATE_KEYS.length);
  const selectedKey = PRIVATE_KEYS[randomIndex];
  console.log(chalk.blue(`🤖 Using wallet ${randomIndex + 1}`));
  
  const wallet = new ethers.Wallet(selectedKey, provider);
  console.log(chalk.blue(`🤖 Wallet address: ${wallet.address}`));
  
  const balance = await provider.getBalance(wallet.address);
  console.log(chalk.blue(`🤖 cBTC Balance: ${ethers.formatEther(balance)}`));
  
  return wallet;
}

async function initializeSpecificWallet(accountNumber) {
  await getPrivateKeys();
  const index = accountNumber - 1;
  if (index < 0 || index >= PRIVATE_KEYS.length) {
    throw new Error(`Invalid account number! Must be between 1 and ${PRIVATE_KEYS.length}`);
  }
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  await provider.getBlockNumber()
    .then((block) => console.log(chalk.blue(`🤖 Connected to RPC, block: ${block}`)))
    .catch((err) => console.error(chalk.red(`❌ RPC Connection failed: ${err.message}`)));
  
  console.log(chalk.blue(`🤖 Using wallet ${accountNumber}`));
  const wallet = new ethers.Wallet(PRIVATE_KEYS[index], provider);
  console.log(chalk.blue(`🤖 Wallet address: ${wallet.address}`));
  
  const balance = await provider.getBalance(wallet.address);
  console.log(chalk.blue(`🤖 cBTC Balance: ${ethers.formatEther(balance)}`));
  
  return wallet;
}

async function initializeAllWallets() {
  await getPrivateKeys();
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  await provider.getBlockNumber()
    .then((block) => console.log(chalk.blue(`🤖 Connected to RPC, block: ${block}`)))
    .catch((err) => console.error(chalk.red(`❌ RPC Connection failed: ${err.message}`)));

  return PRIVATE_KEYS.map((key, index) => {
    console.log(chalk.blue(`🤖 Initialized wallet ${index + 1}`));
    const wallet = new ethers.Wallet(key, provider);
    console.log(chalk.blue(`🤖 Wallet address ${index + 1}: ${wallet.address}`));
    return wallet;
  });
}

const getRandomAmount = () => {
  const min = 0.00001;
  const max = 0.001;
  return ethers.parseEther((Math.random() * (max - min) + min).toFixed(18));
};

async function swapCBTCtoUSDT(wallet, routerContract, cbtcAmount) {
  console.log(chalk.blue(`🤖 Starting cBTC → USDT swap...`));
  
  try {
    const wethAddress = await routerContract.WETH();
    const path = [wethAddress, USDT_ADDRESS];
    
    console.log(chalk.blue(`🔹 Path: [${path.join(" → ")}]`));
    console.log(chalk.blue(`🔹 Amount: ${ethers.formatEther(cbtcAmount)} cBTC`));

    const amountsOut = await routerContract.getAmountsOut(cbtcAmount, path);
    const expectedUSDT = amountsOut[1];
    console.log(chalk.blue(`🔹 Expected USDT: ${ethers.formatUnits(expectedUSDT, 6)}`));

    const amountOutMin = expectedUSDT.mul(95).div(100); // 5% slippage
    const tx = await routerContract.swapExactETHForTokens(
      amountOutMin,
      path,
      wallet.address,
      Math.floor(Date.now() / 1000) + 60 * 20,
      { value: cbtcAmount, gasLimit: 300000 }
    );

    console.log(chalk.blue(`🔹 Tx sent: ${tx.hash}`));
    const receipt = await tx.wait();
    
    if (receipt.status === 0) throw new Error("Transaction reverted");
    
    console.log(chalk.green(`✅ cBTC → USDT successful!`));
    console.log(chalk.green(`   Tx: ${tx.hash}`));
    
    return expectedUSDT;
  } catch (error) {
    console.error(chalk.red(`❌ cBTC → USDT failed: ${error.message}`));
    throw error;
  }
}

async function swapUSDTtoCBTC(wallet, routerContract, pairContract, usdtAmount) {
  console.log(chalk.blue(`🤖 Starting USDT → cBTC swap...`));
  
  try {
    const usdtContract = new ethers.Contract(USDT_ADDRESS, usdtAbi, wallet);
    const usdtBalance = await usdtContract.balanceOf(wallet.address);
    
    if (usdtBalance < usdtAmount) {
      throw new Error(`Insufficient USDT: ${ethers.formatUnits(usdtBalance, 6)} < ${ethers.formatUnits(usdtAmount, 6)}`);
    }

    const allowance = await usdtContract.allowance(wallet.address, ROUTER_ADDRESS);
    if (allowance < usdtAmount) {
      console.log(chalk.blue(`🔹 Approving USDT...`));
      const approveTx = await usdtContract.approve(ROUTER_ADDRESS, usdtAmount);
      await approveTx.wait();
    }

    const wethAddress = await routerContract.WETH();
    const path = [USDT_ADDRESS, wethAddress];
    console.log(chalk.blue(`🔹 Path: [${path.join(" → ")}]`));

    const amountsOut = await routerContract.getAmountsOut(usdtAmount, path);
    const expectedCBTC = amountsOut[1];
    console.log(chalk.blue(`🔹 Expected cBTC: ${ethers.formatEther(expectedCBTC)}`));

    // Debug pair info
    const [reserve0, reserve1] = await pairContract.getReserves();
    const token0 = await pairContract.token0();
    console.log(chalk.blue(`🔹 Pair reserves: ${ethers.formatUnits(reserve0, 6)} ${token0 === USDT_ADDRESS ? "USDT" : "WETH"} / ${ethers.formatEther(reserve1)} ${token0 === USDT_ADDRESS ? "WETH" : "USDT"}`));

    const amountOutMin = expectedCBTC.mul(95).div(100); // 5% slippage
    const tx = await routerContract.swapExactTokensForETH(
      usdtAmount,
      amountOutMin,
      path,
      wallet.address,
      Math.floor(Date.now() / 1000) + 60 * 20,
      { gasLimit: 300000 }
    );

    console.log(chalk.blue(`🔹 Tx sent: ${tx.hash}`));
    const receipt = await tx.wait();
    
    if (receipt.status === 0) throw new Error("Transaction reverted");
    
    console.log(chalk.green(`✅ USDT → cBTC successful!`));
    console.log(chalk.green(`   Tx: ${tx.hash}`));
    
    return expectedCBTC;
  } catch (error) {
    console.error(chalk.red(`❌ USDT → cBTC failed: ${error.message}`));
    
    if (error.code === "CALL_EXCEPTION") {
      console.error(chalk.red(`🔍 Debug info:`));
      console.error(chalk.red(`   - Check USDT balance and allowance`));
      console.error(chalk.red(`   - Verify pair liquidity`));
      console.error(chalk.red(`   - Check token order in pair`));
    }
    
    throw error;
  }
}

async function performSwapCycle(wallet, cbtcAmount) {
  console.log(chalk.blue(`🤖 Starting swap cycle...`));
  
  try {
    const routerContract = new ethers.Contract(ROUTER_ADDRESS, routerAbi, wallet);
    const pairContract = new ethers.Contract(PAIR_ADDRESS, pairAbi, wallet);

    const usdtReceived = await swapCBTCtoUSDT(wallet, routerContract, cbtcAmount);
    await swapUSDTtoCBTC(wallet, routerContract, pairContract, usdtReceived);
    
    console.log(chalk.green.bold(`🎉 Swap cycle completed!`));
  } catch (error) {
    console.error(chalk.red.bold(`❌ Swap cycle failed: ${error.message}`));
    throw error;
  }
}

const getRandomSwaps = () => Math.floor(Math.random() * 10) + 1;

async function dailySwap(wallets) {
  const swapCount = getRandomSwaps();
  console.log(chalk.yellow(`🚀 Starting ${swapCount} swaps across ${wallets.length} wallets...`));
  
  for (let i = 0; i < swapCount; i++) {
    console.log(chalk.cyan(`🔄 Cycle ${i + 1}/${swapCount}`));
    
    await Promise.all(
      wallets.map(async (wallet, index) => {
        console.log(chalk.blue(`🤖 Processing wallet ${index + 1}`));
        await performSwapCycle(wallet, getRandomAmount());
      })
    );
    
    const delay = Math.floor(Math.random() * 4 + 1) * 60 * 1000;
    console.log(chalk.blue(`⏳ Waiting ${delay / 60000} minutes...`));
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  
  console.log(chalk.yellow("🎉 Daily swaps completed!"));
}

async function autoSwap(wallet, totalCBTCAmount) {
  let remainingAmount = ethers.BigNumber.from(ethers.parseEther(totalCBTCAmount.toString()));
  console.log(chalk.yellow(`🚀 Starting swaps for ${ethers.formatEther(remainingAmount)} cBTC...`));

  let swapCount = 0;

  while (remainingAmount.gt(0)) {
    swapCount++;
    console.log(chalk.cyan(`🔄 Swap ${swapCount}`));
    
    const balance = await wallet.provider.getBalance(wallet.address);
    console.log(chalk.blue(`🤖 Balance: ${ethers.formatEther(balance)} cBTC`));

    if (balance.lte(ethers.parseEther("0.00001"))) {
      console.log(chalk.yellow("⏹️ Balance too low to continue"));
      break;
    }

    let cbtcAmount = getRandomAmount();
    if (cbtcAmount.gt(remainingAmount)) {
      cbtcAmount = remainingAmount;
    }

    await performSwapCycle(wallet, cbtcAmount);
    remainingAmount = remainingAmount.sub(cbtcAmount);

    const delay = Math.floor(Math.random() * 9 + 1) * 60 * 1000;
    console.log(chalk.blue(`⏳ Waiting ${delay / 60000} minutes...`));
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  console.log(chalk.yellow("🎉 Automatic swaps completed!"));
}

async function startBot(wallet) {
  displayInterface();
  const choices = [
    "Start Daily Swap Bot (All Wallets)",
    "Start Automatic Swap",
    "Perform Manual Swap Now",
    "Exit",
  ];

  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: chalk.cyan("What would you like to do?"),
      choices,
    },
  ]);

  switch (action) {
    case choices[0]:
      console.log(chalk.green("🚀 Starting daily swap bot..."));
      const wallets = await initializeAllWallets();
      const randomHour = Math.floor(Math.random() * 24);
      const randomMinute = Math.floor(Math.random() * 60);
      console.log(chalk.blue(`⏰ Scheduled at ${randomHour}:${randomMinute} daily`));
      schedule.scheduleJob(`${randomMinute} ${randomHour} * * *`, () => {
        displayInterface();
        dailySwap(wallets);
      });
      break;

    case choices[1]:
      displayInterface();
      const { amount, account } = await inquirer.prompt([
        {
          type: "input",
          name: "amount",
          message: "Amount of cBTC to swap:",
          validate: (input) => !isNaN(parseFloat(input)) && parseFloat(input) > 0 || "Invalid amount!"
        },
        {
          type: "input",
          name: "account",
          message: "Account to use (1, 2, ...):",
          validate: (input) => {
            const num = parseInt(input);
            return !isNaN(num) && num > 0 && num <= PRIVATE_KEYS.length || `Must be 1-${PRIVATE_KEYS.length}`;
          }
        }
      ]);

      console.log(chalk.green(`🚀 Starting swap with ${amount} cBTC using account ${account}...`));
      const autoWallet = await initializeSpecificWallet(parseInt(account));
      await autoSwap(autoWallet, amount);
      await startBot(wallet);
      break;

    case choices[2]:
      displayInterface();
      console.log(chalk.yellow("🔧 Performing manual swap..."));
      await performSwapCycle(wallet, getRandomAmount());
      console.log(chalk.green("✅ Manual swap completed!"));
      await startBot(wallet);
      break;

    case choices[3]:
      console.log(chalk.red("👋 Exiting..."));
      process.exit(0);
  }
}

async function main() {
  console.log(chalk.blue("🤖 Initializing Citrus Swap Bot..."));
  const wallet = await initializeWallet();
  await startBot(wallet);
}

main().catch((error) => console.error(chalk.red(`❌ Error: ${error.message}`)));