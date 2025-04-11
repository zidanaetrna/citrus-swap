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

// Full Uniswap V2 Router ABI
const routerAbi = [
    {"inputs":[{"internalType":"address","name":"_factory","type":"address"},{"internalType":"address","name":"_WETH","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},
    {"inputs":[],"name":"WETH","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"}],"name":"getAmountsOut","outputs":[{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"amountOutMin","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"swapExactETHForTokens","outputs":[{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"stateMutability":"payable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"uint256","name":"amountOutMin","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"swapExactTokensForETH","outputs":[{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"stateMutability":"nonpayable","type":"function"}
];

// UniswapV2Pair ABI
const pairAbi = [
    {"constant":true,"inputs":[],"name":"getReserves","outputs":[{"internalType":"uint112","name":"_reserve0","type":"uint112"},{"internalType":"uint112","name":"_reserve1","type":"uint112"},{"internalType":"uint32","name":"_blockTimestampLast","type":"uint32"}],"payable":false,"stateMutability":"view","type":"function"},
    {"constant":true,"inputs":[],"name":"token0","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},
    {"constant":true,"inputs":[],"name":"token1","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"}
];

// USDT ABI
const usdtAbi = [
    "function approve(address spender, uint256 amount) public returns (bool)",
    "function balanceOf(address account) public view returns (uint256)"
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
  const provider = new (require("ethers").providers.JsonRpcProvider)(RPC_URL);
  await provider.getBlockNumber().then((block) => console.log(chalk.blue(`🤖 Connected to RPC, block number: ${block}`))).catch((err) => console.error(chalk.red(`❌ RPC Connection failed: ${err.message}`)));
  const randomIndex = Math.floor(Math.random() * PRIVATE_KEYS.length);
  const wallet = new ethers.Wallet(PRIVATE_KEYS[randomIndex], provider);
  console.log(chalk.blue(`🤖 Using wallet ${randomIndex + 1}: ${wallet.address}`));
  const balance = await provider.getBalance(wallet.address);
  console.log(chalk.blue(`🤖 cBTC Balance: ${ethers.formatEther(balance)} cBTC`));
  return wallet;
}

async function initializeSpecificWallet(accountNumber) {
  await getPrivateKeys();
  const index = accountNumber - 1;
  if (index < 0 || index >= PRIVATE_KEYS.length) throw new Error(`Invalid account number! Must be between 1 and ${PRIVATE_KEYS.length}`);
  const provider = new (require("ethers").providers.JsonRpcProvider)(RPC_URL);
  await provider.getBlockNumber().then((block) => console.log(chalk.blue(`🤖 Connected to RPC, block number: ${block}`))).catch((err) => console.error(chalk.red(`❌ RPC Connection failed: ${err.message}`)));
  const wallet = new ethers.Wallet(PRIVATE_KEYS[index], provider);
  console.log(chalk.blue(`🤖 Using wallet ${accountNumber}: ${wallet.address}`));
  const balance = await provider.getBalance(wallet.address);
  console.log(chalk.blue(`🤖 cBTC Balance: ${ethers.formatEther(balance)} cBTC`));
  return wallet;
}

async function initializeAllWallets() {
  await getPrivateKeys();
  const provider = new (require("ethers").providers.JsonRpcProvider)(RPC_URL);
  await provider.getBlockNumber().then((block) => console.log(chalk.blue(`🤖 Connected to RPC, block number: ${block}`))).catch((err) => console.error(chalk.red(`❌ RPC Connection failed: ${err.message}`)));
  return PRIVATE_KEYS.map((key, index) => {
      const wallet = new ethers.Wallet(key, provider);
      console.log(chalk.blue(`🤖 Wallet ${index + 1}: ${wallet.address}`));
      return wallet;
  });
}

const getRandomAmount = () => {
    const min = 0.00001;
    const max = 0.001;
    const random = Math.random() * (max - min) + min;
    return ethers.parseEther(random.toFixed(18));
};

const DEADLINE = () => Math.floor(Date.now() / 1000) + 60 * 20;

async function getPairDetails(wallet) {
    const pairContract = new ethers.Contract(PAIR_ADDRESS, pairAbi, wallet);
    const [reserve0, reserve1] = await pairContract.getReserves();
    const token0 = await pairContract.token0();
    const token1 = await pairContract.token1();
    const weth = await new ethers.Contract(ROUTER_ADDRESS, routerAbi, wallet).WETH();
    console.log(chalk.blue(`🤖 Pair Reserves: ${ethers.formatEther(reserve0)} (Token0: ${token0}), ${ethers.formatUnits(reserve1, 6)} (Token1: ${token1})`));
    return { reserve0, reserve1, token0, token1, weth };
}

// cBTC -> USDT (original working logic)
async function swapCBTCtoUSDT(wallet, routerContract, cbtcAmount) {
    console.log(chalk.blue(`🤖 Entering swapCBTCtoUSDT...`));
    try {
        const balance = await wallet.provider.getBalance(wallet.address);
        console.log(chalk.blue(`🤖 cBTC Balance before swap: ${ethers.formatEther(balance)} cBTC`));
        if (balance.lt(cbtcAmount)) throw new Error(`Insufficient cBTC: ${ethers.formatEther(balance)} < ${ethers.formatEther(cbtcAmount)}`);

        const path = [await routerContract.WETH(), USDT_ADDRESS];
        const tx = await routerContract.swapExactETHForTokens(
            0, // No slippage protection (worked in original)
            path,
            wallet.address,
            DEADLINE(),
            { value: cbtcAmount, gasLimit: 200000 }
        );
        console.log(chalk.green(`🌟 cBTC (${ethers.formatEther(cbtcAmount)} cBTC) -> USDT Tx: ${tx.hash}`));
        await tx.wait();
        console.log(chalk.green("✅ cBTC -> USDT Swap completed"));

        const usdtContract = new ethers.Contract(USDT_ADDRESS, usdtAbi, wallet);
        const usdtBalance = await usdtContract.balanceOf(wallet.address);
        console.log(chalk.blue(`🤖 USDT Balance after swap: ${ethers.formatUnits(usdtBalance, 6)} USDT`));
        return usdtBalance;
    } catch (error) {
        console.error(chalk.red(`❌ swapCBTCtoUSDT failed: ${error.message}`));
        console.error(chalk.red(`❌ Full error: ${JSON.stringify(error, null, 2)}`));
        throw error;
    }
}

// USDT -> cBTC (using pair reserves)
async function swapUSDTtoCBTC(wallet, routerContract, usdtAmount) {
    console.log(chalk.blue(`🤖 Entering swapUSDTtoCBTC...`));
    try {
        const usdtContract = new ethers.Contract(USDT_ADDRESS, usdtAbi, wallet);
        const usdtBalance = await usdtContract.balanceOf(wallet.address);
        console.log(chalk.blue(`🤖 USDT Balance: ${ethers.formatUnits(usdtBalance, 6)} USDT`));
        if (usdtBalance.lt(usdtAmount)) throw new Error(`Insufficient USDT: ${ethers.formatUnits(usdtBalance, 6)} < ${ethers.formatUnits(usdtAmount, 6)}`);

        const { reserve0, reserve1, token0, weth } = await getPairDetails(wallet);
        const path = [USDT_ADDRESS, weth];
        const isUSDTToken0 = token0.toLowerCase() === USDT_ADDRESS.toLowerCase();
        const reserveUSDT = isUSDTToken0 ? reserve0 : reserve1;
        const reserveCBTC = isUSDTToken0 ? reserve1 : reserve0;

        // Calculate amountOutMin using reserves
        const amountIn = usdtAmount;
        const numerator = amountIn.mul(reserveCBTC).mul(997); // 0.3% fee
        const denominator = reserveUSDT.mul(1000).add(amountIn.mul(997));
        const amountOut = numerator.div(denominator);
        const amountOutMin = amountOut.mul(95).div(100); // 5% slippage
        console.log(chalk.blue(`🤖 Expected cBTC: ${ethers.formatEther(amountOut)}, Min: ${ethers.formatEther(amountOutMin)}`));

        const approveTx = await usdtContract.approve(ROUTER_ADDRESS, usdtAmount);
        console.log(chalk.blue(`🤖 Approve Tx: ${approveTx.hash}`));
        await approveTx.wait();

        const tx = await routerContract.swapExactTokensForETH(
            usdtAmount,
            amountOutMin,
            path,
            wallet.address,
            DEADLINE(),
            { gasLimit: 300000 }
        );
        console.log(chalk.green(`🌟 USDT (${ethers.formatUnits(usdtAmount, 6)} USDT) -> cBTC Tx: ${tx.hash}`));
        await tx.wait();
        console.log(chalk.green("✅ USDT -> cBTC Swap completed"));
    } catch (error) {
        console.error(chalk.red(`❌ swapUSDTtoCBTC failed: ${error.message}`));
        console.error(chalk.red(`❌ Full error: ${JSON.stringify(error, null, 2)}`));
        throw error;
    }
}

async function performSwapCycle(wallet, routerContract, cbtcAmount) {
    console.log(chalk.cyan(`🔄 Starting swap cycle...`));
    try {
        const usdtReceived = await swapCBTCtoUSDT(wallet, routerContract, cbtcAmount);
        await swapUSDTtoCBTC(wallet, routerContract, usdtReceived);
        console.log(chalk.cyan("🔄 Swap cycle completed"));
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
    let remainingAmount = ethers.parseEther(totalCBTCAmount.toString());
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
        if (cbtcAmount.gt(remainingAmount)) cbtcAmount = remainingAmount;

        await performSwapCycle(wallet, routerContract, cbtcAmount);
        remainingAmount = remainingAmount.sub(cbtcAmount);

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