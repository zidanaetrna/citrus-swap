const { ethers } = require("ethers");
const schedule = require("node-schedule");
const chalk = require("chalk");
const inquirer = require("inquirer");
const clear = require("clear");
const fs = require("fs");
require("dotenv").config();

// Constants
const PROJECT_NAME = "Citrus Swap Pro";
const CREATOR_NAME = "aetrna";
const RPC_URL = "https://rpc.testnet.citrea.xyz";
const ROUTER_ADDRESS = "0xb45670f668EE53E62b5F170B5B1d3C6701C8d03A";
const USDT_ADDRESS = "0xb669dC8cC6D044307Ba45366C0c836eC3c7e31AA";

// Load all private keys from .env
const PRIVATE_KEYS = Object.keys(process.env)
  .filter((key) => key.startsWith("PRIVATE_KEY_"))
  .map((key) => process.env[key]);

// Uniswap V2 Router ABI (minimal, from working script)
const routerAbi = [
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function WETH() external pure returns (address)",
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)", // Optional for slippage
];

// USDT ABI (minimal, from working script)
const usdtAbi = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function balanceOf(address account) public view returns (uint256)", // Optional for checks
];

// Rainbow colors for ASCII art
const colors = [chalk.red, chalk.yellow, chalk.green, chalk.cyan, chalk.blue, chalk.magenta];

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
  console.log(chalk.magenta(`================ ${PROJECT_NAME} ====================`));
  console.log("");
  asciiArt.forEach((line, index) => console.log(colors[index](line)));
  console.log("");
  console.log(chalk.magenta(`================= Created by: ${CREATOR_NAME} ====================`));
  console.log("");
}

// Prompt for private keys if not in .env
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
          message: chalk.cyan(`Enter private key ${walletIndex} (without 0x, or press Enter to finish): 🔑`),
          validate: (input) => {
            if (input === "") return true;
            if (/^[0-9a-fA-F]{64}$/.test(input)) return true;
            return "Invalid private key! Must be 64 hex chars.";
          },
        },
      ]);
      if (pk === "") break;
      privateKeys.push(pk);
      walletIndex++;
    }

    if (privateKeys.length === 0) throw new Error("No private keys provided!");
    const envContent = privateKeys.map((key, i) => `PRIVATE_KEY_${i + 1}=${key}`).join("\n") + "\n";
    fs.writeFileSync(".env", envContent, { flag: "w" });
    console.log(chalk.green(`✅ ${privateKeys.length} private key(s) saved to .env!`));
    PRIVATE_KEYS.push(...privateKeys);
  }
}

// Initialize a single random wallet
async function initializeWallet() {
  await getPrivateKeys();
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const block = await provider.getBlockNumber();
  console.log(chalk.blue(`🤖 Connected to RPC, block: ${block}`));
  const randomIndex = Math.floor(Math.random() * PRIVATE_KEYS.length);
  const wallet = new ethers.Wallet(PRIVATE_KEYS[randomIndex], provider);
  console.log(chalk.blue(`🤖 Using wallet ${randomIndex + 1}: ${wallet.address}`));
  return wallet;
}

// Initialize a specific wallet by number
async function initializeSpecificWallet(accountNumber) {
  await getPrivateKeys();
  const index = accountNumber - 1;
  if (index < 0 || index >= PRIVATE_KEYS.length) throw new Error(`Invalid account! Must be 1-${PRIVATE_KEYS.length}`);
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const block = await provider.getBlockNumber();
  console.log(chalk.blue(`🤖 Connected to RPC, block: ${block}`));
  const wallet = new ethers.Wallet(PRIVATE_KEYS[index], provider);
  console.log(chalk.blue(`🤖 Using wallet ${accountNumber}: ${wallet.address}`));
  return wallet;
}

// Initialize all wallets
async function initializeAllWallets() {
  await getPrivateKeys();
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const block = await provider.getBlockNumber();
  console.log(chalk.blue(`🤖 Connected to RPC, block: ${block}`));
  return PRIVATE_KEYS.map((key, i) => {
    const wallet = new ethers.Wallet(key, provider);
    console.log(chalk.blue(`🤖 Wallet ${i + 1}: ${wallet.address}`));
    return wallet;
  });
}

// Random swap amount
const getRandomAmount = () => {
  const min = 0.00001;
  const max = 0.001;
  const random = Math.random() * (max - min) + min;
  return ethers.parseEther(random.toFixed(18));
};

// Estimate USDT amount (from original)
const getEstimatedUSDTAmount = (cbtcAmount) => {
  const cbtcValue = parseFloat(ethers.formatEther(cbtcAmount));
  const usdtValue = cbtcValue * 60000; // Testnet assumption
  return ethers.parseUnits(usdtValue.toFixed(6), 6);
};

// Deadline
const DEADLINE = () => Math.floor(Date.now() / 1000) + 60 * 20;

// Swap cBTC to USDT (from original, with optional slippage)
async function swapCBTCtoUSDT(wallet, routerContract, cbtcAmount, useSlippage = false) {
  try {
    console.log(chalk.blue(`🤖 Starting cBTC -> USDT swap...`));
    const path = [await routerContract.WETH(), USDT_ADDRESS];
    let amountOutMin = 0;

    if (useSlippage) {
      const amountsOut = await routerContract.getAmountsOut(cbtcAmount, path);
      amountOutMin = amountsOut[1].mul(95).div(100); // 5% slippage
      console.log(chalk.blue(`🤖 Expected USDT: ${ethers.formatUnits(amountsOut[1], 6)}, Min: ${ethers.formatUnits(amountOutMin, 6)}`));
    }

    const balance = await wallet.provider.getBalance(wallet.address);
    console.log(chalk.blue(`🤖 cBTC Balance: ${ethers.formatEther(balance)}`));
    if (ethers.BigNumber.from(balance).lt(cbtcAmount)) throw new Error("Insufficient cBTC!");

    const tx = await routerContract.swapExactETHForTokens(
      amountOutMin,
      path,
      wallet.address,
      DEADLINE(),
      { value: cbtcAmount, gasLimit: 200000 }
    );
    console.log(chalk.green(`🌟 cBTC (${ethers.formatEther(cbtcAmount)}) -> USDT Tx: ${tx.hash}`));
    await tx.wait();
    console.log(chalk.green("✅ cBTC -> USDT Swap completed"));
    return cbtcAmount;
  } catch (error) {
    console.error(chalk.red(`❌ cBTC -> USDT failed: ${error.message}`));
    throw error;
  }
}

// Swap USDT to cBTC (from original, with optional slippage)
async function swapUSDTtoCBTC(wallet, routerContract, cbtcAmount, useSlippage = false) {
  try {
    console.log(chalk.blue(`🤖 Starting USDT -> cBTC swap...`));
    const usdtAmount = getEstimatedUSDTAmount(cbtcAmount);
    const usdtContract = new ethers.Contract(USDT_ADDRESS, usdtAbi, wallet);
    const balance = await usdtContract.balanceOf(wallet.address);
    console.log(chalk.blue(`🤖 USDT Balance: ${ethers.formatUnits(balance, 6)}`));
    if (ethers.BigNumber.from(balance).lt(usdtAmount)) throw new Error("Insufficient USDT!");

    const approveTx = await usdtContract.approve(ROUTER_ADDRESS, usdtAmount);
    console.log(chalk.blue(`🤖 USDT Approved: ${approveTx.hash}`));
    await approveTx.wait();

    const path = [USDT_ADDRESS, await routerContract.WETH()];
    let amountOutMin = 0;

    if (useSlippage) {
      const amountsOut = await routerContract.getAmountsOut(usdtAmount, path);
      amountOutMin = amountsOut[1].mul(95).div(100); // 5% slippage
      console.log(chalk.blue(`🤖 Expected cBTC: ${ethers.formatEther(amountsOut[1])}, Min: ${ethers.formatEther(amountOutMin)}`));
    }

    const tx = await routerContract.swapExactTokensForETH(
      usdtAmount,
      amountOutMin,
      path,
      wallet.address,
      DEADLINE(),
      { gasLimit: 200000 }
    );
    console.log(chalk.green(`🌟 USDT (${ethers.formatUnits(usdtAmount, 6)}) -> cBTC Tx: ${tx.hash}`));
    await tx.wait();
    console.log(chalk.green("✅ USDT -> cBTC Swap completed"));
  } catch (error) {
    console.error(chalk.red(`❌ USDT -> cBTC failed: ${error.message}`));
    throw error;
  }
}

// Full swap cycle
async function performSwapCycle(wallet, routerContract, cbtcAmount, useSlippage = false) {
  try {
    console.log(chalk.cyan(`🔄 Starting swap cycle: cBTC > USDT > cBTC`));
    const swappedCBTC = await swapCBTCtoUSDT(wallet, routerContract, cbtcAmount, useSlippage);
    await swapUSDTtoCBTC(wallet, routerContract, swappedCBTC, useSlippage);
    console.log(chalk.cyan("🔄 Swap cycle completed"));
  } catch (error) {
    console.error(chalk.red(`❌ Swap cycle failed: ${error.message}`));
    throw error;
  }
}

// Random swap count
const getRandomSwaps = () => Math.floor(Math.random() * 10) + 1;

// Daily swaps across all wallets
async function dailySwap(wallets, routerContracts) {
  const swapCount = getRandomSwaps();
  console.log(chalk.yellow(`🚀 Starting ${swapCount} swaps across ${wallets.length} wallets...`));
  for (let i = 0; i < swapCount; i++) {
    console.log(chalk.cyan(`🔄 Cycle ${i + 1}/${swapCount}`));
    await Promise.all(
      wallets.map(async (wallet, idx) => {
        await performSwapCycle(wallet, routerContracts[idx], getRandomAmount());
      })
    );
    const delay = Math.floor(Math.random() * 4 + 1) * 60 * 1000;
    console.log(chalk.blue(`⏳ Waiting ${delay / 60000} mins...`));
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  console.log(chalk.yellow("🎉 Daily swaps completed!"));
}

// Auto-swap with custom amount
async function autoSwap(wallet, routerContract, totalCBTCAmount) {
  let remaining = ethers.parseEther(totalCBTCAmount.toString());
  console.log(chalk.yellow(`🚀 Auto-swapping ${ethers.formatEther(remaining)} cBTC...`));
  let swapCount = 0;

  while (remaining.gt(0)) {
    swapCount++;
    console.log(chalk.cyan(`🔄 Cycle ${swapCount}`));
    const balance = await wallet.provider.getBalance(wallet.address);
    console.log(chalk.blue(`🤖 cBTC Balance: ${ethers.formatEther(balance)}`));
    if (ethers.BigNumber.from(balance).lte(ethers.parseEther("0.00001"))) {
      console.log(chalk.yellow("🎉 Balance too low to continue!"));
      break;
    }

    let cbtcAmount = getRandomAmount();
    if (cbtcAmount.gt(remaining)) cbtcAmount = remaining;

    await performSwapCycle(wallet, routerContract, cbtcAmount);
    remaining = remaining.sub(cbtcAmount);

    const delay = Math.floor(Math.random() * 9 + 1) * 60 * 1000;
    console.log(chalk.blue(`⏳ Waiting ${delay / 60000} mins...`));
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  console.log(chalk.yellow("🎉 Auto-swaps completed!"));
}

// Main menu
async function startBot(wallet, routerContract) {
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
      message: chalk.cyan("What would you like to do? 🤖"),
      choices,
    },
  ]);

  switch (action) {
    case choices[0]:
      console.log(chalk.green("🚀 Starting daily swap bot..."));
      const wallets = await initializeAllWallets();
      const routerContracts = wallets.map((w) => new ethers.Contract(ROUTER_ADDRESS, routerAbi, w));
      const randomHour = Math.floor(Math.random() * 24);
      const randomMinute = Math.floor(Math.random() * 60);
      console.log(chalk.blue(`⏰ Scheduled at ${randomHour}:${randomMinute}. Press Ctrl+C to stop.`));
      schedule.scheduleJob(`${randomMinute} ${randomHour} * * *`, () => {
        displayInterface();
        dailySwap(wallets, routerContracts);
      });
      break;

    case choices[1]:
      displayInterface();
      const { amount, account } = await inquirer.prompt([
        {
          type: "input",
          name: "amount",
          message: chalk.cyan("Amount of cBTC to swap: "),
          validate: (input) => parseFloat(input) > 0 || "Enter a valid number!",
        },
        {
          type: "input",
          name: "account",
          message: chalk.cyan(`Account (1-${PRIVATE_KEYS.length}): `),
          validate: (input) => {
            const num = parseInt(input);
            return num >= 1 && num <= PRIVATE_KEYS.length ? true : `Enter 1-${PRIVATE_KEYS.length}!`;
          },
        },
      ]);
      console.log(chalk.green(`🚀 Auto-swapping ${amount} cBTC with account ${account}...`));
      const autoWallet = await initializeSpecificWallet(parseInt(account));
      const autoRouter = new ethers.Contract(ROUTER_ADDRESS, routerAbi, autoWallet);
      await autoSwap(autoWallet, autoRouter, amount);
      await startBot(wallet, routerContract);
      break;

    case choices[2]:
      displayInterface();
      console.log(chalk.yellow("🔧 Manual swap..."));
      await performSwapCycle(wallet, routerContract, getRandomAmount());
      console.log(chalk.green("✅ Manual swap completed!"));
      await startBot(wallet, routerContract);
      break;

    case choices[3]:
      console.log(chalk.red("👋 Goodbye!"));
      process.exit(0);
  }
}

// Main
async function main() {
  console.log(chalk.blue("🤖 Initializing Citrus Swap Pro..."));
  const wallet = await initializeWallet();
  const routerContract = new ethers.Contract(ROUTER_ADDRESS, routerAbi, wallet);
  await startBot(wallet, routerContract);
}

main().catch((error) => console.error(chalk.red(`❌ Error: ${error.message}`)));