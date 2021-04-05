// make sure to test your own strategies, do not use this version in production
require('dotenv').config();

const privateKey = process.env.PRIVATE_KEY_SWAP;
// your contract address
const uniswapRouter = process.argv[3] === 'U' ? process.env.ROUTER : process.env.SUSHI_ROUTER;
if (process.argv[3] === 'U') {
  console.log('Uniswap router address -> ', uniswapRouter);
} else {
  console.log('Sushiswap router address -> ', uniswapRouter);
}


const { ethers } = require('ethers');

// uni/sushiswap ABIs
const UniswapRouter = require('./abis/IUniswapV2Router02.json');

// use your own Infura node in production
// const provider = new ethers.providers.InfuraProvider('mainnet', process.env.INFURA_KEY);
const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");

const wallet = new ethers.Wallet(privateKey, provider);


const swap = async () => {
  const uniRouter = new ethers.Contract(
    uniswapRouter,
    UniswapRouter.abi, wallet,
  );

  let overrides = {
    // The maximum units of gas for the transaction to use
    //gasLimit: 230000,
    // The price (in wei) per unit of gas
    gasPrice: ethers.utils.parseUnits('10', 'gwei'),
    // The amount to send with the transaction (i.e. msg.value)
    value: ethers.utils.parseEther(process.argv[2]),

  };

  // function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline)

  const amountOutMin = 1;
  // weth, dai
  const path = ['0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', '0x6b175474e89094c44da98b954eedeac495271d0f'];
  const to = wallet.address;
  
  const block = await provider.getBlock();
  //console.log(block.timestamp.toString());
  const deadline = block.timestamp * 20;

  const gasLimit = await uniRouter.estimateGas.swapExactETHForTokens(
    amountOutMin,
    path,
    to,
    deadline,
    overrides,
  );

  console.log("GasLimit is -> ", gasLimit.toString());

  const gasPrice = await wallet.getGasPrice();

  console.log("GasPrice is -> ", gasPrice.toString());

  const gasCost = Number(ethers.utils.formatEther(gasPrice.mul(gasLimit)));

  console.log("GasCost is -> ", gasCost);

  const options = {
    gasPrice,
    gasLimit,
    value: ethers.utils.parseEther(process.argv[2]),
  };

  console.log("swapExactETHForTokens start");
  const tx = await uniRouter.swapExactETHForTokens(
    amountOutMin,
    path,
    to,
    deadline,
    options,
  );

  console.log('SWAP EXECUTED! PENDING TX TO BE MINED\n\n');
  console.log('TX hash: ', tx.hash);

  await tx.wait();

  console.log('\n\nSUCCESS! TX MINED');
  
};

console.log('ETH -> DAI SWAP started!');
swap();
