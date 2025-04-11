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

// Load all private keys from .env
const PRIVATE_KEYS = Object.keys(process.env)
  .filter((key) => key.startsWith("PRIVATE_KEY_"))
  .map((key) => process.env[key]);

// Full Uniswap V2 Router ABI (from your latest input)
const routerAbi = [
    {"inputs":[{"internalType":"address","name":"_factory","type":"address"},{"internalType":"address","name":"_WETH","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},
    {"inputs":[],"name":"WETH","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"address","name":"tokenA","type":"address"},{"internalType":"address","name":"tokenB","type":"address"},{"internalType":"uint256","name":"amountADesired","type":"uint256"},{"internalType":"uint256","name":"amountBDesired","type":"uint256"},{"internalType":"uint256","name":"amountAMin","type":"uint256"},{"internalType":"uint256","name":"amountBMin","type":"uint256"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"addLiquidity","outputs":[{"internalType":"uint256","name":"amountA","type":"uint256"},{"internalType":"uint256","name":"amountB","type":"uint256"},{"internalType":"uint256","name":"liquidity","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"amountTokenDesired","type":"uint256"},{"internalType":"uint256","name":"amountTokenMin","type":"uint256"},{"internalType":"uint256","name":"amountETHMin","type":"uint256"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"addLiquidityETH","outputs":[{"internalType":"uint256","name":"amountToken","type":"uint256"},{"internalType":"uint256","name":"amountETH","type":"uint256"},{"internalType":"uint256","name":"liquidity","type":"uint256"}],"stateMutability":"payable","type":"function"},
    {"inputs":[],"name":"factory","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"amountOut","type":"uint256"},{"internalType":"uint256","name":"reserveIn","type":"uint256"},{"internalType":"uint256","name":"reserveOut","type":"uint256"}],"name":"getAmountIn","outputs":[{"internalType":"uint256","name":"amountIn","type":"uint256"}],"stateMutability":"pure","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"uint256","name":"reserveIn","type":"uint256"},{"internalType":"uint256","name":"reserveOut","type":"uint256"}],"name":"getAmountOut","outputs":[{"internalType":"uint256","name":"amountOut","type":"uint256"}],"stateMutability":"pure","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"amountOut","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"}],"name":"getAmountsIn","outputs":[{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"}],"name":"getAmountsOut","outputs":[{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"amountA","type":"uint256"},{"internalType":"uint256","name":"reserveA","type":"uint256"},{"internalType":"uint256","name":"reserveB","type":"uint256"}],"name":"quote","outputs":[{"internalType":"uint256","name":"amountB","type":"uint256"}],"stateMutability":"pure","type":"function"},
    {"inputs":[{"internalType":"address","name":"tokenA","type":"address"},{"internalType":"address","name":"tokenB","type":"address"},{"internalType":"uint256","name":"liquidity","type":"uint256"},{"internalType":"uint256","name":"amountAMin","type":"uint256"},{"internalType":"uint256","name":"amountBMin","type":"uint256"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"removeLiquidity","outputs":[{"internalType":"uint256","name":"amountA","type":"uint256"},{"internalType":"uint256","name":"amountB","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"liquidity","type":"uint256"},{"internalType":"uint256","name":"amountTokenMin","type":"uint256"},{"internalType":"uint256","name":"amountETHMin","type":"uint256"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"removeLiquidityETH","outputs":[{"internalType":"uint256","name":"amountToken","type":"uint256"},{"internalType":"uint256","name":"amountETH","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"liquidity","type":"uint256"},{"internalType":"uint256","name":"amountTokenMin","type":"uint256"},{"internalType":"uint256","name":"amountETHMin","type":"uint256"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"removeLiquidityETHSupportingFeeOnTransferTokens","outputs":[{"internalType":"uint256","name":"amountETH","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"liquidity","type":"uint256"},{"internalType":"uint256","name":"amountTokenMin","type":"uint256"},{"internalType":"uint256","name":"amountETHMin","type":"uint256"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"bool","name":"approveMax","type":"bool"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"removeLiquidityETHWithPermit","outputs":[{"internalType":"uint256","name":"amountToken","type":"uint256"},{"internalType":"uint256","name":"amountETH","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"liquidity","type":"uint256"},{"internalType":"uint256","name":"amountTokenMin","type":"uint256"},{"internalType":"uint256","name":"amountETHMin","type":"uint256"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"bool","name":"approveMax","type":"bool"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"removeLiquidityETHWithPermitSupportingFeeOnTransferTokens","outputs":[{"internalType":"uint256","name":"amountETH","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"address","name":"tokenA","type":"address"},{"internalType":"address","name":"tokenB","type":"address"},{"internalType":"uint256","name":"liquidity","type":"uint256"},{"internalType":"uint256","name":"amountAMin","type":"uint256"},{"internalType":"uint256","name":"amountBMin","type":"uint256"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"bool","name":"approveMax","type":"bool"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"removeLiquidityWithPermit","outputs":[{"internalType":"uint256","name":"amountA","type":"uint256"},{"internalType":"uint256","name":"amountB","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"amountOut","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"swapETHForExactTokens","outputs":[{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"stateMutability":"payable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"amountOutMin","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"swapExactETHForTokens","outputs":[{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"stateMutability":"payable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"amountOutMin","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"swapExactETHForTokensSupportingFeeOnTransferTokens","outputs":[],"stateMutability":"payable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"uint256","name":"amountOutMin","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"swapExactTokensForETH","outputs":[{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"uint256","name":"amountOutMin","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"swapExactTokensForETHSupportingFeeOnTransferTokens","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"uint256","name":"amountOutMin","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"swapExactTokensForTokens","outputs":[{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"uint256","name":"amountOutMin","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"swapExactTokensForTokensSupportingFeeOnTransferTokens","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"amountOut","type":"uint256"},{"internalType":"uint256","name":"amountInMax","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"swapTokensForExactETH","outputs":[{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"amountOut","type":"uint256"},{"internalType":"uint256","name":"amountInMax","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"swapTokensForExactTokens","outputs":[{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"stateMutability":"nonpayable","type":"function"},
    {"stateMutability":"payable","type":"receive"}
];

// USDT ABI
const usdtAbi = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function balanceOf(address account) public view returns (uint256)",
];

const colors = [chalk.red, chalk.yellow, chalk.green, chalk.cyan, chalk.blue, chalk.magenta];
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
          message: chalk.cyan(`Please provide your private key ${walletIndex} (without 0x, or press Enter to finish): `),
          validate: (input) => {
            if (input === "") return true;
            if (/^[0-9a-fA-F]{64}$/.test(input)) return true;
            return "Invalid private key! Must be a 64-character hex string without 0x.";
          },
        },
      ]);
      if (pk === "") break;
      privateKeys.push(pk);
      walletIndex++;
    }
    if (privateKeys.length === 0) throw new Error("No private keys provided!");
    const envContent = privateKeys.map((key, index) => `PRIVATE_KEY_${index + 1}=${key}`).join("\n") + "\n";
    fs.writeFileSync(".env", envContent, { flag: "w" });
    console.log(chalk.green(`✅ ${privateKeys.length} private key(s) saved to .env file!`));
    privateKeys.forEach((key, index) => process.env[`PRIVATE_KEY_${index + 1}`] = key);
    PRIVATE_KEYS.push(...privateKeys);
  }
}

async function initializeWallet() {
  await getPrivateKeys();
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL); // Compatible with v5 & v6
  await provider.getBlockNumber().then((block) => console.log(chalk.blue(`🤖 Connected to RPC, block number: ${block}`))).catch((err) => console.error(chalk.red(`❌ RPC Connection failed: ${err.message}`)));
  const randomIndex = Math.floor(Math.random() * PRIVATE_KEYS.length);
  const selectedKey = PRIVATE_KEYS[randomIndex];
  console.log(chalk.blue(`🤖 Using wallet ${randomIndex + 1} for this session`));
  const wallet = new ethers.Wallet(selectedKey, provider);
  console.log(chalk.blue(`🤖 Wallet address: ${wallet.address}`));
  const balance = await provider.getBalance(wallet.address);
  console.log(chalk.blue(`🤖 cBTC Balance: ${ethers.utils.formatEther(balance)} cBTC`));
  return wallet;
}

async function initializeSpecificWallet(accountNumber) {
  await getPrivateKeys();
  const index = accountNumber - 1;
  if (index < 0 || index >= PRIVATE_KEYS.length) throw new Error(`Invalid account number! Must be between 1 and ${PRIVATE_KEYS.length}`);
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  await provider.getBlockNumber().then((block) => console.log(chalk.blue(`🤖 Connected to RPC, block number: ${block}`))).catch((err) => console.error(chalk.red(`❌ RPC Connection failed: ${err.message}`)));
  console.log(chalk.blue(`🤖 Using wallet ${accountNumber} for automatic swaps`));
  const wallet = new ethers.Wallet(PRIVATE_KEYS[index], provider);
  console.log(chalk.blue(`🤖 Wallet address: ${wallet.address}`));
  const balance = await provider.getBalance(wallet.address);
  console.log(chalk.blue(`🤖 cBTC Balance: ${ethers.utils.formatEther(balance)} cBTC`));
  return wallet;
}

async function initializeAllWallets() {
  await getPrivateKeys();
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  await provider.getBlockNumber().then((block) => console.log(chalk.blue(`🤖 Connected to RPC, block number: ${block}`))).catch((err) => console.error(chalk.red(`❌ RPC Connection failed: ${err.message}`)));
  const wallets = PRIVATE_KEYS.map((key, index) => {
    console.log(chalk.blue(`🤖 Initialized wallet ${index + 1} for daily swaps`));
    const wallet = new ethers.Wallet(key, provider);
    console.log(chalk.blue(`🤖 Wallet address ${index + 1}: ${wallet.address}`));
    return wallet;
  });
  return wallets;
}

const getRandomAmount = () => {
  const min = 0.00001;
  const max = 0.001;
  const random = Math.random() * (max - min) + min;
  return ethers.utils.parseEther(random.toFixed(18)); // v5 & v6 compatible
};

const DEADLINE = () => Math.floor(Date.now() / 1000) + 60 * 20;

// cBTC -> USDT (back to original working logic)
async function swapCBTCtoUSDT(wallet, routerContract, cbtcAmount) {
  console.log(chalk.blue(`🤖 Entering swapCBTCtoUSDT...`));
  try {
    const balance = await wallet.provider.getBalance(wallet.address);
    console.log(chalk.blue(`🤖 cBTC Balance before swap: ${ethers.utils.formatEther(balance)} cBTC`));
    if (ethers.BigNumber.from(balance).lt(cbtcAmount)) throw new Error(`Insufficient cBTC: ${ethers.utils.formatEther(balance)} < ${ethers.utils.formatEther(cbtcAmount)}`);

    const path = [await routerContract.WETH(), USDT_ADDRESS];
    const tx = await routerContract.swapExactETHForTokens(
      0, // No slippage protection (worked in original)
      path,
      wallet.address,
      DEADLINE(),
      { value: cbtcAmount, gasLimit: 200000 } // Original gas limit
    );
    console.log(chalk.blue(`🤖 Transaction sent: ${tx.hash}`));
    await tx.wait();
    console.log(chalk.green(`🌟 cBTC (${ethers.utils.formatEther(cbtcAmount)} cBTC) -> USDT Tx: ${tx.hash}`));
    console.log(chalk.green("✅ cBTC -> USDT Swap completed"));

    // Return actual USDT received
    const usdtContract = new ethers.Contract(USDT_ADDRESS, usdtAbi, wallet);
    const usdtBalance = await usdtContract.balanceOf(wallet.address);
    console.log(chalk.blue(`🤖 USDT Balance after swap: ${ethers.utils.formatUnits(usdtBalance, 6)} USDT`));
    return usdtBalance;
  } catch (error) {
    console.error(chalk.red(`❌ swapCBTCtoUSDT failed: ${error.message}`));
    console.error(chalk.red(`❌ Full error: ${JSON.stringify(error, null, 2)}`));
    throw error;
  }
}

// USDT -> cBTC (dynamic amount with getAmountsOut)
async function swapUSDTtoCBTC(wallet, routerContract, usdtAmount) {
  console.log(chalk.blue(`🤖 Entering swapUSDTtoCBTC...`));
  try {
    const usdtContract = new ethers.Contract(USDT_ADDRESS, usdtAbi, wallet);
    const usdtBalance = await usdtContract.balanceOf(wallet.address);
    console.log(chalk.blue(`🤖 USDT Balance: ${ethers.utils.formatUnits(usdtBalance, 6)} USDT`));
    if (ethers.BigNumber.from(usdtBalance).lt(usdtAmount)) throw new Error(`Insufficient USDT: ${ethers.utils.formatUnits(usdtBalance, 6)} < ${ethers.utils.formatUnits(usdtAmount, 6)}`);

    const approveTx = await usdtContract.approve(ROUTER_ADDRESS, usdtAmount);
    console.log(chalk.blue(`🤖 Approve Tx: ${approveTx.hash}`));
    await approveTx.wait();

    const path = [USDT_ADDRESS, await routerContract.WETH()];
    const amountsOut = await routerContract.getAmountsOut(usdtAmount, path);
    const amountOutMin = amountsOut[1].mul(95).div(100); // 5% slippage
    console.log(chalk.blue(`🤖 Expected cBTC: ${ethers.utils.formatEther(amountsOut[1])}, Min: ${ethers.utils.formatEther(amountOutMin)}`));

    const tx = await routerContract.swapExactTokensForETH(
      usdtAmount,
      amountOutMin,
      path,
      wallet.address,
      DEADLINE(),
      { gasLimit: 300000 } // Increased for safety
    );
    console.log(chalk.blue(`🤖 Transaction sent: ${tx.hash}`));
    await tx.wait();
    console.log(chalk.green(`🌟 USDT (${ethers.utils.formatUnits(usdtAmount, 6)} USDT) -> cBTC Tx: ${tx.hash}`));
    console.log(chalk.green("✅ USDT -> cBTC Swap completed"));
  } catch (error) {
    console.error(chalk.red(`❌ swapUSDTtoCBTC failed: ${error.message}`));
    console.error(chalk.red(`❌ Full error: ${JSON.stringify(error, null, 2)}`));
    throw error;
  }
}

async function performSwapCycle(wallet, routerContract, cbtcAmount) {
  console.log(chalk.blue(`🤖 Starting swap cycle...`));
  try {
    const usdtReceived = await swapCBTCtoUSDT(wallet, routerContract, cbtcAmount);
    await swapUSDTtoCBTC(wallet, routerContract, usdtReceived);
    console.log(chalk.blue("🔄 Swap cycle completed"));
  } catch (error) {
    console.error(chalk.red(`❌ Swap failed: ${error.message}`));
    throw error;
  }
}

const getRandomSwaps = () => Math.floor(Math.random() * 10) + 1;

async function dailySwap(wallets) {
  const swapCount = getRandomSwaps();
  console.log(chalk.yellow(`🚀 Starting ${swapCount} swaps for today across ${wallets.length} wallets...`));
  for (let i = 0; i < swapCount; i++) {
    console.log(chalk.cyan(`🔄 Daily Swap Cycle ${i + 1}/${swapCount}`));
    await Promise.all(
      wallets.map(async (wallet, index) => {
        const routerContract = new ethers.Contract(ROUTER_ADDRESS, routerAbi, wallet);
        console.log(chalk.blue(`🤖 Processing wallet ${index + 1}`));
        await performSwapCycle(wallet, routerContract, getRandomAmount());
      })
    );
    const delay = Math.floor(Math.random() * 4 + 1) * 60 * 1000;
    console.log(chalk.blue(`⏳ Waiting ${delay / 60000} minutes before next cycle...`));
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  console.log(chalk.yellow("🎉 Daily swaps completed!"));
}

async function autoSwap(wallet, routerContract, totalCBTCAmount) {
  let remainingAmount = ethers.utils.parseEther(totalCBTCAmount.toString());
  console.log(chalk.yellow(`🚀 Starting automatic swaps for ${ethers.utils.formatEther(remainingAmount)} cBTC...`));
  let swapCount = 0;

  while (ethers.BigNumber.from(remainingAmount).gt(0)) {
    swapCount++;
    console.log(chalk.cyan(`🔄 Swap Cycle ${swapCount}`));
    const balance = await wallet.provider.getBalance(wallet.address);
    console.log(chalk.blue(`🤖 cBTC Balance: ${ethers.utils.formatEther(balance)} cBTC`));
    if (ethers.BigNumber.from(balance).lte(ethers.utils.parseEther("0.00001"))) {
      console.log(chalk.yellow("🎉 cBTC balance too low to continue swapping!"));
      break;
    }

    let cbtcAmount = getRandomAmount();
    if (ethers.BigNumber.from(cbtcAmount).gt(remainingAmount)) cbtcAmount = remainingAmount;

    await performSwapCycle(wallet, routerContract, cbtcAmount);
    remainingAmount = ethers.BigNumber.from(remainingAmount).sub(cbtcAmount);

    const delay = Math.floor(Math.random() * 9 + 1) * 60 * 1000;
    console.log(chalk.blue(`⏳ Waiting ${delay / 60000} minutes before next swap...`));
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  console.log(chalk.yellow("🎉 Automatic swaps completed!"));
}

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
      console.log(chalk.green("🚀 Starting daily swap bot with all wallets..."));
      const wallets = await initializeAllWallets();
      const randomHour = Math.floor(Math.random() * 24);
      const randomMinute = Math.floor(Math.random() * 60);
      console.log(chalk.blue(`⏰ Scheduled daily swaps at ${randomHour}:${randomMinute} for all wallets. Press Ctrl+C to stop.`));
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
          message: chalk.cyan("Amount of cBTC you want to swap: "),
          validate: (input) => {
            const num = parseFloat(input);
            if (isNaN(num) || num <= 0) return "Please enter a valid positive number!";
            return true;
          },
        },
        {
          type: "input",
          name: "account",
          message: chalk.cyan("Account you want to use (e.g., 1, 2, ...): "),
          validate: (input) => {
            const num = parseInt(input);
            if (isNaN(num) || num < 1 || num > PRIVATE_KEYS.length) return `Please enter a valid account number between 1 and ${PRIVATE_KEYS.length}!`;
            return true;
          },
        },
      ]);
      console.log(chalk.green(`🚀 Starting automatic swap with ${amount} cBTC using account ${account}...`));
      const autoWallet = await initializeSpecificWallet(parseInt(account));
      const autoRouterContract = new ethers.Contract(ROUTER_ADDRESS, routerAbi, autoWallet);
      await autoSwap(autoWallet, autoRouterContract, amount);
      await startBot(wallet, routerContract);
      break;

    case choices[2]:
      displayInterface();
      console.log(chalk.yellow("🔧 Performing a manual swap..."));
      const cbtcAmountManual = getRandomAmount();
      await performSwapCycle(wallet, routerContract, cbtcAmountManual);
      console.log(chalk.green("✅ Manual swap completed!"));
      await startBot(wallet, routerContract);
      break;

    case choices[3]:
      console.log(chalk.red("👋 Exiting bot. Goodbye!"));
      process.exit(0);
  }
}

async function main() {
  console.log(chalk.blue("🤖 Initializing Citrus Swap Bot..."));
  const wallet = await initializeWallet();
  const routerContract = new ethers.Contract(ROUTER_ADDRESS, routerAbi, wallet);
  await startBot(wallet, routerContract);
}

main().catch((error) => console.error(chalk.red(`❌ Error: ${error.message}`)));