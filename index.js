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

// Uniswap V2 Router ABI
const routerAbi = [
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function WETH() external pure returns (address)",
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
];

// USDT ABI
const usdtAbi = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function balanceOf(address account) public view returns (uint256)",
];

const colors = [
  chalk.red,
  chalk.yellow,
  chalk.green,
  chalk.cyan,
  chalk.blue,
  chalk.magenta,
];

// ASCII art lines
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

  asciiArt.forEach((line, index) => {
    console.log(colors[index](line));
  });

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

    if (privateKeys.length === 0) {
      throw new Error("No private keys provided!");
    }

    const envContent = privateKeys
      .map((key, index) => `PRIVATE_KEY_${index + 1}=${key}`)
      .join("\n") + "\n";
    fs.writeFileSync(".env", envContent, { flag: "w" });
    console.log(chalk.green(`✅ ${privateKeys.length} private key(s) saved to .env file!`));

    privateKeys.forEach((key, index) => {
      process.env[`PRIVATE_KEY_${index + 1}`] = key;
    });
    PRIVATE_KEYS.push(...privateKeys);
  }
}

async function initializeWallet() {
    await getPrivateKeys();
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const randomIndex = Math.floor(Math.random() * PRIVATE_KEYS.length);
    const selectedKey = PRIVATE_KEYS[randomIndex];
    console.log(chalk.blue(`🤖 Using wallet ${randomIndex + 1} for this session`));
    return new ethers.Wallet(selectedKey, provider);
  }

async function initializeSpecificWallet(accountNumber) {
  await getPrivateKeys();
  const index = accountNumber - 1;
  if (index < 0 || index >= PRIVATE_KEYS.length) {
    throw new Error(`Invalid account number! Must be between 1 and ${PRIVATE_KEYS.length}`);
  }
  const selectedKey = PRIVATE_KEYS[index];
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  console.log(chalk.blue(`🤖 Using wallet ${accountNumber} for automatic swaps`));
  return new ethers.Wallet(selectedKey, provider);
}

async function initializeAllWallets() {
  await getPrivateKeys();
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallets = PRIVATE_KEYS.map((key, index) => {
    console.log(chalk.blue(`🤖 Initialized wallet ${index + 1} for daily swaps`));
    return new ethers.Wallet(key, provider);
  });
  return wallets;
}

const getRandomAmount = () => {
  const min = 0.00001;
  const max = 0.001;
  const random = Math.random() * (max - min) + min;
  return ethers.parseEther(random.toFixed(18));
};

const DEADLINE = () => Math.floor(Date.now() / 1000) + 60 * 20;

async function swapCBTCtoUSDT(wallet, routerContract, cbtcAmount) {
  const path = [(await routerContract.WETH()), USDT_ADDRESS];
  const amountsOutRaw = await routerContract.getAmountsOut(cbtcAmount, path);
  // Convert amountsOut to BigNumber if not already
  const amountsOut = amountsOutRaw.map((amount) => ethers.BigNumber.from(amount));
  console.log(chalk.blue(`🤖 Expected amounts out: ${amountsOut.map(a => ethers.formatUnits(a, 18)).join(", ")}`));
  const amountOutMin = amountsOut[1].mul(95).div(100); // 5% slippage tolerance
  const tx = await routerContract.swapExactETHForTokens(
    amountOutMin,
    path,
    wallet.address,
    DEADLINE(),
    { value: cbtcAmount, gasLimit: 200000 }
  );
  console.log(chalk.green(`🌟 cBTC (${ethers.formatEther(cbtcAmount)} cBTC) -> USDT Tx: ${tx.hash}`));
  await tx.wait();
  console.log(chalk.green(`✅ cBTC -> USDT Swap completed, received ${ethers.formatUnits(amountsOut[1], 6)} USDT`));
  return amountsOut[1]; // Return actual USDT received
}

async function swapUSDTtoCBTC(wallet, routerContract, usdtAmount) {
  const usdtContract = new ethers.Contract(USDT_ADDRESS, usdtAbi, wallet);
  const balance = await usdtContract.balanceOf(wallet.address);
  console.log(chalk.blue(`🤖 USDT Balance: ${ethers.formatUnits(balance, 6)} USDT`));

  if (ethers.BigNumber.from(balance).lt(usdtAmount)) {
    throw new Error(`Insufficient USDT balance: ${ethers.formatUnits(balance, 6)} < ${ethers.formatUnits(usdtAmount, 6)}`);
  }

  const approveTx = await usdtContract.approve(ROUTER_ADDRESS, usdtAmount);
  console.log(chalk.blue(`🤖 Approve Tx: ${approveTx.hash}`));
  await approveTx.wait();

  const path = [USDT_ADDRESS, await routerContract.WETH()];
  const amountsOutRaw = await routerContract.getAmountsOut(usdtAmount, path);
  const amountsOut = amountsOutRaw.map((amount) => ethers.BigNumber.from(amount));
  console.log(chalk.blue(`🤖 Expected amounts out: ${amountsOut.map(a => ethers.formatUnits(a, 18)).join(", ")}`));
  const amountOutMin = amountsOut[1].mul(95).div(100); // 5% slippage tolerance
  const tx = await routerContract.swapExactTokensForETH(
    usdtAmount,
    amountOutMin,
    path,
    wallet.address,
    DEADLINE(),
    { gasLimit: 200000 }
  );
  console.log(chalk.green(`🌟 USDT (${ethers.formatUnits(usdtAmount, 6)} USDT) -> cBTC Tx: ${tx.hash}`));
  await tx.wait();
  console.log(chalk.green("✅ USDT -> cBTC Swap completed"));
}

async function performSwapCycle(wallet, routerContract, cbtcAmount) {
  try {
    const usdtAmount = await swapCBTCtoUSDT(wallet, routerContract, cbtcAmount);
    await swapUSDTtoCBTC(wallet, routerContract, usdtAmount);
  } catch (error) {
    console.error(chalk.red(`❌ Swap failed: ${error.message}`));
    throw error; // Re-throw to stop the loop if needed
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
  let remainingAmount = ethers.BigNumber.from(ethers.parseEther(totalCBTCAmount.toString()));
  console.log(chalk.yellow(`🚀 Starting automatic swaps for ${ethers.formatEther(remainingAmount)} cBTC...`));

  let swapCount = 0;

  while (remainingAmount.gt(0)) {
    swapCount++;
    console.log(chalk.cyan(`🔄 Swap Cycle ${swapCount}`));
    const balance = await wallet.provider.getBalance(wallet.address);
    console.log(chalk.blue(`🤖 cBTC Balance: ${ethers.formatEther(balance)} cBTC`));

    if (balance.lte(ethers.parseEther("0.00001"))) {
      console.log(chalk.yellow("🎉 cBTC balance too low to continue swapping!"));
      break;
    }

    let cbtcAmount = getRandomAmount();
    if (cbtcAmount.gt(remainingAmount)) {
      cbtcAmount = remainingAmount; // Use remaining amount if less than random
    }

    await performSwapCycle(wallet, routerContract, cbtcAmount);
    remainingAmount = remainingAmount.sub(cbtcAmount);

    const delay = Math.floor(Math.random() * 9 + 1) * 60 * 1000; // 1-10 minutes
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
      const randomHour = Math.floor(Math.random() * 24); // Random hour (0-23)
      const randomMinute = Math.floor(Math.random() * 60); // Random minute (0-59)
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
            if (isNaN(num) || num < 1 || num > PRIVATE_KEYS.length) {
              return `Please enter a valid account number between 1 and ${PRIVATE_KEYS.length}!`;
            }
            return true;
          },
        },
      ]);

      console.log(chalk.green(`🚀 Starting automatic swap with ${amount} cBTC using account ${account}...`));
      const autoWallet = await initializeSpecificWallet(parseInt(account));
      const autoRouterContract = new ethers.Contract(ROUTER_ADDRESS, routerAbi, autoWallet);
      await autoSwap(autoWallet, autoRouterContract, amount);
      await startBot(wallet, routerContract); // Return to menu after completion
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