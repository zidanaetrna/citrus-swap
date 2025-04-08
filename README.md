# Citrus Swap Bot 🤖

An automated swap bot for the Citrea testnet that performs random swaps between cBTC and USDT on a Uniswap V2-compatible DEX.

## Features ✨

- Automated daily random swaps between cBTC and USDT
- Manual swap capability
- Randomized swap amounts and intervals
- Secure private key management
- Colorful console interface
- Scheduled daily operations

## Installation 💻

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or yarn
- Private key for your Citrea testnet wallet
- Testnet cBTC for gas and swaps

### Setup Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/citrus-swap.git
   cd citrus-swap
   ```

2. Install dependencies:
   ```bash
   npm install chalk@4.1.2 clear@0.1.0 dotenv@16.4.7 ethers@6.13.5 inquirer@8.2.6 node-schedule@2.1.1
   ```

3. Start the bot
    ```bash
    node index.js
    ```

## Usage 🚀

### Starting the Bot
    ```env
    Please provide your private key (without 0x): fill_with_your_pk_without_0x
    ```

You'll be presented with a menu:
1. **Start Auto-Swap Bot**: Runs random swaps daily at midnight
2. **Perform Manual Swap**: Executes one swap cycle immediately
3. **Exit**: Quits the application

### Configuration ⚙️

You can modify these constants in the code:

```javascript
// Network Configuration
const RPC_URL = "https://rpc.testnet.citrea.xyz";
const ROUTER_ADDRESS = "0xb45670f668EE53E62b5F170B5B1d3C6701C8d03A";
const USDT_ADDRESS = "0xb669dC8cC6D044307Ba45366C0c836eC3c7e31AA";

// Swap Parameters
const MIN_SWAP_AMOUNT = 0.00001; // cBTC
const MAX_SWAP_AMOUNT = 0.001;   // cBTC
const CBTC_PRICE = 60000;        // Price in USDT
```

## Version 1.0 Features 🌟

- Basic swap functionality (cBTC ⇄ USDT)
- Daily automated swaps
- Manual swap capability
- Basic error handling
- Console interface with ASCII art
- Environment variable support for private keys

## Security 🔒

- Private keys are stored locally in `.env` file
- Never commit your `.env` file to version control
- Use a dedicated testnet wallet with limited funds

## Support ❤️

For issues or feature requests, please open an issue on GitHub.

---

*Created with 💜 by aetrna - Version 1.0*
```

You can customize this further by:
1. Adding actual screenshots of the interface
2. Including a real logo instead of the placeholder
3. Adding more detailed troubleshooting information
4. Including contribution guidelines if you plan to open-source it
5. Adding license information

```

## License
This project is licensed under the MIT License. See the LICENSE (./LICENSE) file for details. 
Author: aetrna 

---

Disclaimer This is for educational and testnet purposes only. Use at your own risk, especially with real funds or mainnet deployments.