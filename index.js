const { ethers } = require("ethers");
const chalk = require("chalk");
const inquirer = require("inquirer");
const clear = require("clear");
const fs = require("fs");
require("dotenv").config();

// Constants
const RPC_URL = "https://rpc.testnet.citrea.xyz";
const ROUTER_ADDRESS = "0xb45670f668EE53E62b5F170B5B1d3C6701C8d03A";
const USDT_ADDRESS = "0xb669dC8cC6D044307Ba45366C0c836eC3c7e31AA";

// ABIs
const routerAbi = [
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function WETH() external pure returns (address)",
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)"
];

const usdtAbi = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function balanceOf(address account) public view returns (uint256)",
  "function decimals() public view returns (uint8)"
];

// Initialize wallet
async function initializeWallet() {
  if (!process.env.PRIVATE_KEY) {
    const { pk } = await inquirer.prompt([
      {
        type: "password",
        name: "pk",
        message: "Enter your private key:",
        validate: input => /^[0-9a-fA-F]{64}$/.test(input) || "Invalid private key"
      }
    ]);
    process.env.PRIVATE_KEY = pk;
  }

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  return new ethers.Wallet(process.env.PRIVATE_KEY, provider);
}

// Swap functions
async function swapCBTCtoUSDT(wallet, routerContract, cbtcAmount) {
  console.log(chalk.blue(`🤖 Starting cBTC → USDT swap...`));
  
  try {
    const wethAddress = await routerContract.WETH();
    const path = [wethAddress, USDT_ADDRESS];
    
    console.log(chalk.blue(`🔹 Path: [${path.join(" → ")}]`));
    console.log(chalk.blue(`🔹 Amount: ${ethers.utils.formatEther(cbtcAmount)} cBTC`));

    const amountsOut = await routerContract.getAmountsOut(cbtcAmount, path);
    const expectedUSDT = ethers.BigNumber.from(amountsOut[1]); // Ensure BigNumber
    console.log(chalk.blue(`🔹 Expected USDT: ${ethers.utils.formatUnits(expectedUSDT, 6)}`));

    const amountOutMin = expectedUSDT.mul(95).div(100); // 5% slippage
    const tx = await routerContract.swapExactETHForTokens(
      amountOutMin,
      path,
      wallet.address,
      Math.floor(Date.now() / 1000) + 60 * 20,
      { 
        value: cbtcAmount,
        gasLimit: 300000 
      }
    );

    console.log(chalk.blue(`🔹 Tx sent: ${tx.hash}`));
    const receipt = await tx.wait();
    
    if (receipt.status === 0) throw new Error("Transaction reverted");
    
    console.log(chalk.green(`✅ cBTC → USDT successful!`));
    return expectedUSDT;
  } catch (error) {
    console.error(chalk.red(`❌ cBTC → USDT failed: ${error.message}`));
    throw error;
  }
}

async function swapUSDTtoCBTC(wallet, routerContract, usdtAmount) {
  console.log(chalk.blue(`🤖 Starting USDT → cBTC swap...`));
  
  try {
    const usdtContract = new ethers.Contract(USDT_ADDRESS, usdtAbi, wallet);
    const usdtBalance = await usdtContract.balanceOf(wallet.address);
    
    if (usdtBalance.lt(usdtAmount)) {
      throw new Error(`Insufficient USDT: ${ethers.utils.formatUnits(usdtBalance, 6)} < ${ethers.utils.formatUnits(usdtAmount, 6)}`);
    }

    const allowance = await usdtContract.allowance(wallet.address, ROUTER_ADDRESS);
    if (allowance.lt(usdtAmount)) {
      console.log(chalk.blue(`🔹 Approving USDT...`));
      const approveTx = await usdtContract.approve(ROUTER_ADDRESS, usdtAmount);
      await approveTx.wait();
    }

    const wethAddress = await routerContract.WETH();
    const path = [USDT_ADDRESS, wethAddress];
    console.log(chalk.blue(`🔹 Path: [${path.join(" → ")}]`));

    const amountsOut = await routerContract.getAmountsOut(usdtAmount, path);
    const expectedCBTC = ethers.BigNumber.from(amountsOut[1]);
    console.log(chalk.blue(`🔹 Expected cBTC: ${ethers.utils.formatEther(expectedCBTC)}`));

    const amountOutMin = expectedCBTC.mul(95).div(100);
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
    return expectedCBTC;
  } catch (error) {
    console.error(chalk.red(`❌ USDT → cBTC failed: ${error.message}`));
    throw error;
  }
}

// Main execution
async function main() {
  try {
    clear();
    const wallet = await initializeWallet();
    const routerContract = new ethers.Contract(ROUTER_ADDRESS, routerAbi, wallet);

    console.log(chalk.green(`\n🔹 Wallet: ${wallet.address}`));
    console.log(chalk.green(`🔹 Network: ${(await wallet.provider.getNetwork()).name}\n`));

    // Perform test swap
    const amount = ethers.utils.parseEther("0.0001"); // 0.0001 cBTC
    const usdtReceived = await swapCBTCtoUSDT(wallet, routerContract, amount);
    await swapUSDTtoCBTC(wallet, routerContract, usdtReceived);

    console.log(chalk.green.bold("\n🎉 Both swaps completed successfully!"));
  } catch (error) {
    console.error(chalk.red.bold("\n❌ Error:", error.message));
    process.exit(1);
  }
}

main();