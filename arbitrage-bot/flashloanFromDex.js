require('dotenv').config();

const privateKey = process.env.PRIVATE_KEY_T;
// your arb contract address
const flashLoanerAddress = process.env.FLASH_LOANER_V1V2;
const { ethers } = require('ethers');

// uni/sushiswap ABIs
const SwapV2Pair = require('./abis/IUniswapV2Pair.json');
const SwapV2Factory = require('./abis/IUniswapV2Factory.json');
const SwapV1Factory = require('./abis/IUniswapV1FactoryV1.json');
const FlashLoaner = require('./abis/FlashSwapV1V2.json');
const Router = require('./abis/IUniswapV2Router02.json');
const Ex = require('./abis/IUniswapV1ExchangeV1.json');
const ERC20 = require('./abis/IERC20.json');

// main or fork main
const provider = process.argv[10] === 'main' ? new ethers.providers.InfuraProvider('mainnet', process.env.INFURA_KEY) : new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
const wallet = new ethers.Wallet(privateKey, provider);

const unifactoryaddress = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
const sushifactoryaddress = '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac';
const unirouteraddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
const sushirouteraddress = '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F';
const abiCoder = ethers.utils.defaultAbiCoder;
const univ1Fatoryaddress = '0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95';

//const tokenAddress = '0x6b175474e89094c44da98b954eedeac495271d0f';
const wethAddress = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

const tokenAddress = process.argv[7];
const decimal = Number(process.argv[8]);
let fee = 10;


const uniswapFactory = new ethers.Contract(
  unifactoryaddress,
  SwapV2Factory.abi, wallet,
);

const uniswapV1Factory = new ethers.Contract(
  univ1Fatoryaddress,
  SwapV1Factory.abi, wallet,
);

const sushiFactory = new ethers.Contract(
  sushifactoryaddress,
  SwapV2Factory.abi, wallet,
);

const flashswaper = new ethers.Contract(
  flashLoanerAddress,
  FlashLoaner.abi, wallet,
);

const unirouter = new ethers.Contract(
  unirouteraddress,
  Router.abi, wallet,
);

const sushirouter = new ethers.Contract(
  sushirouteraddress,
  Router.abi, wallet,
);

const tokenContract = new ethers.Contract(
  tokenAddress,
  ERC20.abi, wallet,
);

const wethContract = new ethers.Contract(
  wethAddress,
  ERC20.abi, wallet,
);

let sushiEthDai;
let uniswapEthDai;

let limit = process.argv[6];
// defalt 15
limit = limit === '0' ? '200' : limit;
let repeatedv1 = 0;
let repeatedv2 = 0;
let repeateds = 0;

const flashswapToken = async (input, data, routerExe,
  pairExe, r0, r1, uniV1Ex, dryrun, tokenEth = true) => {
  /*
  const routerExe = priceUniswap > priceSushiswap ? unirouter : sushirouter;
  const pairExe = priceUniswap > priceSushiswap ? uniswapEthDai : sushiEthDai;
  const r0 = priceUniswap > priceSushiswap ? uniswapReserves[0] : sushiReserves[0];
  const r1 = priceUniswap > priceSushiswap ? uniswapReserves[1] : sushiReserves[1];

  const sushiout = await sushirouter.getAmountOut(input, sushiReserves[0], sushiReserves[1]);
  console.log(`With the flashloan tokens, Sushiswap will get ETH     => ${ethers.utils.formatUnits(sushiout)}`);
  const uniout = await unirouter.getAmountOut(input, uniswapReserves[0], uniswapReserves[1]);
  console.log(`With the flashloan tokens, Uniswap V2 will get ETH    => ${ethers.utils.formatUnits(uniout)}`);
  */
  if (dryrun) {
    console.log(`👉 If FlashLoan Tokens  => ${ethers.utils.formatUnits(input, decimal)}`);
  } else {
    console.log(`\n😋 FlashLoan Tokens     => ${ethers.utils.formatUnits(input, decimal)}`);
  }
  

  const re2 = await uniV1Ex.getTokenToEthInputPrice(input);
  console.log(`With the flashloan tokens, Uniswap V1 will get ETH Y => ${ethers.utils.formatUnits(re2)}`);

  const re3 = await routerExe.getAmountIn(input, r1, r0);
  console.log(`Require to return flashloan to source DEX ETH X      => ${ethers.utils.formatUnits(re3)}`);
  let spread = Number(ethers.utils.formatUnits(re2)) - Number(ethers.utils.formatUnits(re3));
  console.log("Profit =  Y - X  => ", spread);
  console.log(`⏰ Time: ${Date()}`);
  // console.log('\n');

  if (spread <= 0) {
    console.log("There is no profit, just need to wait for opportunity. return.\n");
    // there is no spread at contract layer
    return spread - 1;
  }
  
  // if main fork, will execute the tx.
  if (process.argv[10] !== 'main') {
    const inputT0 = tokenEth ? input : 0;
    const inputT1 = tokenEth ? 0 : input; 
    const gasLimit = await pairExe.estimateGas.swap(
      inputT0,
      inputT1,
      flashLoanerAddress,
      data,
    );

    console.log("GasLimit is                     => ", gasLimit.toString());
    let gasPrice = await wallet.getGasPrice();
    const tmp = Number(gasPrice.toString()) / 1e9;
    // to give more
    console.log(`GasPrice is ${tmp}g. But I make it 10 times. `);
    gasPrice = gasPrice.mul(fee); 
    console.log("GasPrice * N is                => ", Number(gasPrice.toString()) / 1e9);
    const gasCost = Number(ethers.utils.formatEther(gasPrice.mul(gasLimit)));
    console.log("Gas cost is                     => ", gasCost);

    // don't trade if gasCost is higher than the spread
    if (spread > gasCost) {
      console.log("Profit - GasCost              => ", spread - gasCost);

      if (dryrun) {
        // OK, have spread
        return spread - gasCost;
      }
    } else {
      console.log("Profit < GasCost, will return. => ", spread - gasCost);
      // there is spread, but can not cover gas cost.
      return spread - gasCost;
    }

    let tbalance = await wethContract.balanceOf(wallet.address);
    let profitWeth = Number(ethers.utils.formatUnits(tbalance, 18));
    console.log(`💰 Before Flashswap, the WETH       => ${profitWeth} 💰`);
 
    const options = {
      gasPrice,
      gasLimit,
    };

    // execute
    console.log(' 👿 👿 👿 ARBITRAGE Transactionを実行して行きます。');
    const tx = await pairExe.swap(
      inputT0,
      inputT1,
      flashLoanerAddress,
      data,
      options,
    );

    console.log('🎉🎉🎉 ARBITRAGE EXECUTED! PENDING TX TO BE MINED 🎉🎉🎉');
    console.log('🎉🎉🎉 Tx Hash: ', tx.hash);

    await tx.wait();

    console.log('🎆🎆🎆 SUCCESS　🎉　 TX MINED 🎆🎆🎆\n');
    tbalance = await wethContract.balanceOf(wallet.address);
    profitWeth = Number(ethers.utils.formatUnits(tbalance, 18));
    console.log(`💰 After Flashswap, the WETH       => ${profitWeth} 💰`);

  } else {
    console.log("Swap costs gas is 190000 (188199)");
    const gasPrice = await wallet.getGasPrice();
    const tmp = Number(gasPrice.toString());
    // to give more
    console.log(`GasPrice is ${tmp / 1e9}g.`);
    const tmpbig = gasPrice.mul(190000);
    const cost = Number(ethers.utils.formatUnits(tmpbig));
    console.log(`Gas cost estimated ${cost} ETH. Profit - GasCost = ${spread - cost}`);
    const tmpbig1 = gasPrice.mul(1900000);
    const cost1 = Number(ethers.utils.formatUnits(tmpbig1));
    console.log(`Make gasPrice 10 times. Gas cost estimated ${cost1} ETH. Profit - GasCost = ${spread - cost1}`);
    return spread - cost;
  }
}

const flashswapETH = async (input, data, routerExe,
  pairExe, r0, r1, uniV1Ex, dryrun, tokenEth = true) => {
  /*
  const routerExe = priceUniswap < priceSushiswap ? unirouter : sushirouter;
  const pairExe = priceUniswap < priceSushiswap ? uniswapEthDai : sushiEthDai;
  const r0 = priceUniswap < priceSushiswap ? uniswapReserves[0] : sushiReserves[0];
  const r1 = priceUniswap < priceSushiswap ? uniswapReserves[1] : sushiReserves[1];

  const uniout = await unirouter.getAmountOut(input, uniswapReserves[1], uniswapReserves[0]);
  console.log(`With the flashloan ETHs, Uniswap v2 will get tokens     => ${ethers.utils.formatUnits(uniout)}`);
  const sushiout = await sushirouter.getAmountOut(input, sushiReserves[1], sushiReserves[0]);
  console.log(`With the flashloan ETHs, Sushiswap will get tokens      => ${ethers.utils.formatUnits(sushiout)}`);
  */

  if (dryrun) {
    console.log(`👉 If FlashLoan ETHs  => ${ethers.utils.formatUnits(input)} ETH`);
  } else {
    console.log(`\n😋 FlashLoan ETHs     => ${ethers.utils.formatUnits(input)} ETH`);
  }

  const re3 = await routerExe.getAmountIn(input, r0, r1);
  console.log(`Require to return flashloan source DEX tokens           => ${ethers.utils.formatUnits(re3, decimal)}`);
  const re2 = await uniV1Ex.getEthToTokenOutputPrice(re3);
  console.log(`To get the tokens, need to send Uniswap V1 WETH X       => ${ethers.utils.formatUnits(re2)}`);
  const spread = Number(ethers.utils.formatUnits(input)) - Number(ethers.utils.formatUnits(re2));
  console.log('Profit = (FlashLoan ETHs) - X                           => ', spread);
  console.log(`⏰ Time: ${Date()}`);

  if (spread <= 0) {
    console.log("There is no profit, just need to wait for opportunity. return.\n");
    return spread - 1;
  }

  if (process.argv[10] !== 'main') {
    const inputT0 = tokenEth ? 0 : input;
    const inputT1 = tokenEth ? input : 0; 
    const gasLimit = await pairExe.estimateGas.swap(
      inputT0,
      inputT1,
      flashLoanerAddress,
      data,
    );
    console.log("GasLimit is                       => ", gasLimit.toString());

    let gasPrice = await wallet.getGasPrice();
    const tmp = Number(gasPrice.toString()) / 1e9;
    // to give more
    console.log(`GasPrice is ${tmp}g. But I make it 10 times. `);
    gasPrice = gasPrice.mul(fee); 
    console.log("GasPrice * N is                  => ", Number(gasPrice.toString()) / 1e9);
    const gasCost = Number(ethers.utils.formatEther(gasPrice.mul(gasLimit)));
    console.log("Gas cost is                       => ", gasCost);
    // don't trade if gasCost is higher than the spread
    if (spread > gasCost) {
      console.log("Profit - GasCost                  => ", spread - gasCost);
      if (dryrun) {
        // OK, have spread
        return spread - gasCost;
      }
    } else {
      console.log("Profit < GasCost, NO Profit, return. => ", spread - gasCost);
      return spread - gasCost;
    }

    let tbalance = await wethContract.balanceOf(wallet.address);
    let profitWeth = Number(ethers.utils.formatUnits(tbalance, 18));
    console.log(`💰 Before Flashswap, the WETH       => ${profitWeth} 💰`);

    const options = {
      gasPrice,
      gasLimit,
    };

    // execute
    console.log(' 👿 👿 👿 ARBITRAGE Transactionを実行して行きます。');
    const tx = await pairExe.swap(
      inputT0,
      inputT1,
      flashLoanerAddress,
      data,
      options,
    );

    console.log('🎉🎉🎉 ARBITRAGE EXECUTED! PENDING TX TO BE MINED 🎉🎉🎉');
    console.log('🎉🎉🎉 Tx Hash: ', tx.hash);
    await tx.wait();
    console.log('\n🎆🎆🎆 SUCCESS　🎉　 TX MINED 🎆🎆🎆\n');
    tbalance = await wethContract.balanceOf(wallet.address);
    profitWeth = Number(ethers.utils.formatUnits(tbalance, 18));
    console.log(`💰 After Flashswap, the WETH       => ${profitWeth} 💰`);

  } else {
    console.log("Swap costs gas is 240000 (232309)");
    const gasPrice = await wallet.getGasPrice();
    const tmp = Number(gasPrice.toString());
    // to ne more
    console.log(`GasPrice is ${tmp / 1e9}g.`);
    const tmpbig = gasPrice.mul(240000);
    const cost = Number(ethers.utils.formatUnits(tmpbig));
    console.log(`Gas cost estimated ${cost} ETH. Profit - GasCost = ${spread - cost}`);

    const tmpbig1 = gasPrice.mul(2400000);
    const cost1 = Number(ethers.utils.formatUnits(tmpbig1));

    console.log(`Make gasPrice 10 times. Gas cost estimated ${cost1} ETH. Profit - GasCost = ${spread - cost1}`);
    return spread - cost;
  }
}

const exeToken = async (data, exerouter, exepair, r0, r1, uniV1Ex, tokenEth = true) => {
  let input = ethers.utils.parseUnits(process.argv[4], decimal);
  let oldInput = input;
  // < 0, there is no spread or can not cover gos cost.
  // > 0, OK, get spread.
  let re = -9999;
  let oldSpread = -9999;
  let i = 0;

  do {
    oldInput = input;
    input = input.add(ethers.utils.parseUnits(process.argv[5], decimal));

    oldSpread = re; 
    // eslint-disable-next-line no-await-in-loop
    console.log(`\n🤖 Find aribitrage oppoturnity => ${++i} times `);
    // eslint-disable-next-line no-await-in-loop
    re = await flashswapToken(input, data, exerouter, exepair,
      r0, r1, uniV1Ex, true, tokenEth);
    // eslint-disable-next-line no-plusplus
  } while (re > oldSpread && i < Number(limit));
// } while (re !== -9999 && re > oldSpread && i < Number(limit));
  const doinput = i >= Number(limit) && re > 0 ? input : oldInput;
  const exe = oldSpread > 0 || re > 0 ? await flashswapToken(doinput, data, exerouter, exepair,
    r0, r1, uniV1Ex, false, tokenEth) : 0;
  
  return 0;
}

const exeETH = async (data, exerouter, exepair, r0, r1, uniV1Ex, tokenEth = true) => {
  let input = ethers.utils.parseEther(process.argv[2]);
  let oldInput = input;
  // < 0, there is no spread or can not cover gos cost.
  // > 0, OK, get spread.
  let re = -9999;
  let oldSpread = -9999;
  let i = 0;

  do {
    oldInput = input;
    input = input.add(ethers.utils.parseEther(process.argv[3]));

    oldSpread = re;
    console.log(`\n🤖 Find aribitrage oppoturnity => ${++i} times `);
    // eslint-disable-next-line no-await-in-loop
    re = await flashswapETH(input, data, exerouter, exepair,
      r0, r1, uniV1Ex, true, tokenEth);
    // eslint-disable-next-line no-plusplus
  } while (re > oldSpread && i < Number(limit));

  const doinput = i >= Number(limit) && re > 0 ? input : oldInput;
  const exe = oldSpread > 0 || re > 0 ? await flashswapETH(doinput, data, exerouter, exepair,
    r0, r1, uniV1Ex, false, tokenEth) : 0;

  return 0;
}

//const uniT0 = await uniswapEthDai.token0();


const runBot = async () => {
  // console.log(process.argv[11]);
  // eslint-disable-next-line no-restricted-globals
  if (isNaN(process.argv[11]) === false) {
    fee = Number(process.argv[11]);
    console.log(`Will make gas fee ${fee} times.`);
  }

  const v1Exchange = await uniswapV1Factory.getExchange(tokenAddress);
  const uniV1Ex = new ethers.Contract(
    v1Exchange,
    Ex.abi, wallet,
  );

  const loadPairs = async () => {
    sushiEthDai = new ethers.Contract(
      await sushiFactory.getPair(wethAddress, tokenAddress),
      SwapV2Pair.abi, wallet,
    );
    uniswapEthDai = new ethers.Contract(
      await uniswapFactory.getPair(wethAddress, tokenAddress),
      SwapV2Pair.abi, wallet,
    );
  };

  await loadPairs();

  // const sushiT0 = await sushiEthDai.token0();
  // const sushiT1 = await sushiEthDai.token1();
  const uniT1 = await uniswapEthDai.token1();
  // get the aribitrage opportunity
  provider.on('block', async (blockNumber) => {
    try {
      console.log('\n👌👌👌 OK Start aribitrage block by block 👌👌👌');
      console.log(`\nBlockNumber => ${blockNumber} , ${Date()}`);

      // get uniswap v1 price
      const ebalance = await provider.getBalance(v1Exchange);
      const tbalance = await tokenContract.balanceOf(v1Exchange);
      const v1token = Number(ethers.utils.formatUnits(tbalance, decimal));
      const v1eth = Number(ethers.utils.formatUnits(ebalance, 18));
      const priceUv1 = v1token / v1eth;

      const sushiReserves = await sushiEthDai.getReserves();
      const uniswapReserves = await uniswapEthDai.getReserves();
      const tokenEth = uniT1.toLowerCase() === wethAddress;

      const reserve0Sushi = tokenEth ? Number(ethers.utils.formatUnits(sushiReserves[0], decimal)) 
        : Number(ethers.utils.formatUnits(sushiReserves[1], decimal));
      const reserve1Sushi = tokenEth ? Number(ethers.utils.formatUnits(sushiReserves[1], 18))
        : Number(ethers.utils.formatUnits(sushiReserves[0], 18));
      const reserve0Uni = tokenEth ? Number(ethers.utils.formatUnits(uniswapReserves[0], decimal))
        : Number(ethers.utils.formatUnits(uniswapReserves[1], decimal));
      const reserve1Uni = tokenEth ? Number(ethers.utils.formatUnits(uniswapReserves[1], 18))
        : Number(ethers.utils.formatUnits(uniswapReserves[0], 18));
      const priceUniswap = reserve0Uni / reserve1Uni;
      const priceSushiswap = reserve0Sushi / reserve1Sushi;

      if (Math.abs(priceUv1 - repeatedv1) <= Number(process.argv[9])
      && Math.abs(priceUniswap - repeatedv2) < Number(process.argv[9])
      && Math.abs(priceSushiswap - repeateds) < Number(process.argv[9])) {
        console.log(`TOKEN/ETH not changed too much, will wait for next block. `);
        console.log('Uniswap V1 Price Spread: Old - New =>', repeatedv1 - priceUv1);
        console.log('Uniswap V2 Price Spread: Old - New =>', repeatedv2 - priceUniswap);
        console.log('ushiswap  Price  Spread: Old - New =>', repeateds - priceSushiswap);
        repeatedv1 = priceUv1;
        repeatedv2 = priceUniswap;
        repeateds = priceSushiswap;
        return;
      }
      
      // save old value
      repeatedv1 = priceUv1;
      repeatedv2 = priceUniswap;
      repeateds = priceSushiswap;

      console.log(`Uniswap V1 ETH Reserves           => ${v1eth}`);
      console.log(`Uniswap V1 TOKEN Reserves         => ${v1token}`);
      console.log(`Uniswap ETH Reserves              => ${reserve1Uni}`);
      console.log(`Uniswap TOKEN Reserves            => ${reserve0Uni}`);
      console.log(`Sushiswap ETH Reserves            => ${reserve1Sushi}`);
      console.log(`Sushiswap TOKEN Reserves          => ${reserve0Sushi}`);
      console.log('\n');
      console.log(`Uniswap V1 TOKEN/ETH              => ${priceUv1}`);
      console.log(`Uniswap V2 TOEKN/ETH              => ${priceUniswap}`);
      console.log(`Sushiswap TOKEN/ETH               => ${priceSushiswap}`);
      console.log('\n');

      const unir0 = tokenEth ? uniswapReserves[0] : uniswapReserves[1];
      const unir1 = tokenEth ? uniswapReserves[1] : uniswapReserves[0];
      const suir0 = tokenEth ? sushiReserves[0] : sushiReserves[1];
      const suir1 = tokenEth ? sushiReserves[1] : sushiReserves[0];

      // uniswap -> 11, sushiswao -> 22
      if (priceUv1 > priceUniswap && priceUv1 > priceSushiswap) {
        if (priceUniswap <= priceSushiswap) {
          const data = abiCoder.encode(["uint"], ['11']);
          console.log('Need to start flashswap from Uniswap V2, borrow ETH');
          await exeETH(data, unirouter, uniswapEthDai,
            unir0, unir1, uniV1Ex, tokenEth);
        } else {
          const data = abiCoder.encode(["uint"], ['22']);
          console.log('Need to start flashswap from Sushiswap, borrow ETH');
          await exeETH(data, sushirouter, sushiEthDai,
            suir0, suir1, uniV1Ex, tokenEth);
        }
      } else if (priceUv1 < priceUniswap && priceUv1 < priceSushiswap) {
        if (priceUniswap > priceSushiswap) {
          const data = abiCoder.encode(["uint"], ['11']);
          console.log('Need to start flashswap from Uniswap V2, borrow TOKEN');
          await exeToken(data, unirouter, uniswapEthDai,
            unir0, unir1, uniV1Ex, tokenEth);
        } else {
          const data = abiCoder.encode(["uint"], ['22']);
          console.log('Need to start flashswap from Sushiswap, borrow TOKEN');
          await exeToken(data, sushirouter, sushiEthDai,
            suir0, suir1, uniV1Ex, tokenEth);
        }
      } else if (priceUv1 < priceUniswap && priceUv1 > priceSushiswap) {
        if (priceUniswap / priceUv1 > priceUv1 / priceSushiswap) {
          const data = abiCoder.encode(["uint"], ['11']);
          console.log('Need to start flashswap from Uniswap V2, borrow TOKEN');
          await exeToken(data, unirouter, uniswapEthDai,
            unir0, unir1, uniV1Ex, tokenEth);
        } else {
          const data = abiCoder.encode(["uint"], ['22']);
          console.log('Need to start flashswap from Sushiswap, borrow ETH');
          await exeETH(data, sushirouter, sushiEthDai,
            suir0, suir1, uniV1Ex, tokenEth);
        }
      } else if (priceUv1 > priceUniswap && priceUv1 < priceSushiswap) {
        if (priceSushiswap / priceUv1 > priceUv1 / priceUniswap) {
          const data = abiCoder.encode(["uint"], ['22']);
          console.log('Need to start flashswap from Sushiswap, borrow TOKEN');
          await exeToken(data, sushirouter, sushiEthDai,
            suir0, suir1, uniV1Ex, tokenEth);
        } else {
          const data = abiCoder.encode(["uint"], ['11']);
          console.log('Need to start flashswap from Uniswap V2, borrow ETH');
          await exeETH(data, unirouter, uniswapEthDai,
            unir0, unir1, uniV1Ex, tokenEth);
        }
      }

      console.log('\n👌👌👌 OK, to NEXT block 👌👌👌\n');

    } catch (err) {
      console.error(err);
    }
  });
};

console.log('🌟 Bot started! 🌟');

runBot();
