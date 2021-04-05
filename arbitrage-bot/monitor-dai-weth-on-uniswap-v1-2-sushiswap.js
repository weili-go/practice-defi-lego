const { ethers } = require("ethers");
const provider = new ethers.providers.JsonRpcProvider("https://mainnet.infura.io/v3/bd724c915e864e94a14a858b05d88ae5");

const uniswapV2Exchange =  "0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11";
const sushiswapExchange =  "0xC3D03e4F041Fd4cD388c549Ee2A29a9E5075882f";
const uniswapV1Exchange = "0x2a1530C4C41db0B0b2bB646CB5Eb1A67b7158667";

var tokenin = true;

// this ABI object works for both Uniswap and SushiSwap
const uniswapAbi = [
  "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)",
];

const uniswapV1Abi = [
  "event TokenPurchase(address indexed buyer, uint256 indexed eth_sold, uint256 indexed tokens_bought)",
  "event EthPurchase(address indexed buyer, uint256 indexed tokens_sold, uint256 indexed eth_bought)"
];

function getAmountsFromSwapArgs(swapArgs) {
  const { amount0In, amount0Out, amount1In, amount1Out } = swapArgs;

  let token0AmountBigDecimal = amount0In;
  tokenin = true;
  if (token0AmountBigDecimal.eq(0)) {
    token0AmountBigDecimal = amount0Out;
    tokenin = false;
  }

  let token1AmountBigDecimal = amount1In;
  if (token1AmountBigDecimal.eq(0)) {
    token1AmountBigDecimal = amount1Out;
  }

  return { token0AmountBigDecimal, token1AmountBigDecimal };
}

function convertSwapEventToPrice({ swapArgs, token0Decimals, token1Decimals }) {
  const {
    token0AmountBigDecimal,
    token1AmountBigDecimal,
  } = getAmountsFromSwapArgs(swapArgs);

  const token0AmountFloat = parseFloat(
    ethers.utils.formatUnits(token0AmountBigDecimal, token0Decimals)
  );
  const token1AmounFloat = parseFloat(
    ethers.utils.formatUnits(token1AmountBigDecimal, token1Decimals)
  );

  if (token1AmounFloat > 0) {
    const priceOfToken0InTermsOfToken1 = token0AmountFloat / token1AmounFloat;
    return { price: priceOfToken0InTermsOfToken1, token_volume: token0AmountFloat, eth_volume: token1AmounFloat};
  }

  return null;
}

const uniswapContract = new ethers.Contract(
  uniswapV2Exchange,
  uniswapAbi,
  provider,
);
const filteruniV2 = uniswapContract.filters.Swap();


const sushiswapContract = new ethers.Contract(
    sushiswapExchange,
    uniswapAbi,
    provider,
  );
  const filtersushi = sushiswapContract.filters.Swap();

  const uniswapV1Contract = new ethers.Contract(
    uniswapV1Exchange,
    uniswapV1Abi,
    provider,
  );
  const filteruniv11 = uniswapV1Contract.filters.TokenPurchase();
  const filteruniv12 = uniswapV1Contract.filters.EthPurchase();

console.log('monitor-dai-weth-on-uniswapV1-uniswapV2-sushiswap start. 🌟');

// "event TokenPurchase(address indexed buyer, uint256 indexed eth_sold, uint256 indexed tokens_bought)",
// "event EthPurchase(address indexed buyer, uint256 indexed tokens_sold, uint256 indexed eth_bought)
function convertV1(va1, va2, de, flag){
  const re1 = parseFloat(ethers.utils.formatUnits(va1, de));
  const re2 = parseFloat(ethers.utils.formatUnits(va2, de));
  const price = flag == 1 ? re2/re1 : re1/re2;

  return { re1,  re2 , price};
} 

uniswapV1Contract.on(filteruniv11, (buyer, eth_sold, tokens_bought, event) => {
  //console.log("TokenPurchase");
  const blockNumber = event.blockNumber;
  const {re1, re2, price} = convertV1(eth_sold, tokens_bought, 18, 1);

  console.log({ blockNumber, DEX: 'Uniswap V1', price, token_volume:re2, eth_volume:re1, tokenin:false });

});

uniswapV1Contract.on(filteruniv12, (buyer, tokens_sold, eth_bought, event) => {
  //console.log("EthPurchase");
  const blockNumber = event.blockNumber;
  const { re1, re2, price} = convertV1(tokens_sold, eth_bought, 18, 0);
  //console.log({ buyer, tokens_sold:re1, eth_bought:re2 ,price});
  console.log({ blockNumber, DEX: 'Uniswap V1', price, token_volume:re1, eth_volume:re2, tokenin:true });
});

uniswapContract.on(filteruniV2, (from, a0in, a0out, a1in, a1out, to, event) => {
  //console.log(event);
  const blockNumber = event.blockNumber;
  //console.log({ from, a0in, a0out, a1in, a1out, to });
  const { price, token_volume, eth_volume } = convertSwapEventToPrice({
    swapArgs: event.args,
    // the DAI ERC20 uses 18 decimals
    token0Decimals: 18,
    // the WETH ERC20 uses 18 decimals
    token1Decimals: 18,
  });
  // console.log(a0in);
  console.log({ blockNumber, DEX: 'Uniswap V2', price, token_volume, eth_volume, tokenin });
});

sushiswapContract.on(filtersushi, (from, a0in, a0out, a1in, a1out, to, event) => {
    //console.log({ from, a0in, a0out, a1in, a1out, to });
    const blockNumber = event.blockNumber;
    const { price, token_volume, eth_volume } = convertSwapEventToPrice({
        swapArgs: event.args,
        // the DAI ERC20 uses 18 decimals
        token0Decimals: 18,
        // the WETH ERC20 uses 18 decimals
        token1Decimals: 18,
    });

    console.log({ blockNumber, DEX: 'Sushiswap', price, token_volume, eth_volume, tokenin });
});
