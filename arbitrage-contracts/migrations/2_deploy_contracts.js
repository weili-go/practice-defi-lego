const FlashLoaner = artifacts.require("FlashLoanFromDex");
// const SafeMath = artifacts.require("@openzeppelin/contracts/math/SafeMath.sol");
// const UniswapV2Library = artifacts.require("UniswapV2Library");
// const SushiswapV2Library = artifacts.require("SushiswapV2Library");

module.exports = function (deployer, network) {

  if(network == 'rinkeby'){
    // uni-factory, sushi-factory, uni-v1-factory
    deployer.deploy(FlashLoaner, '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac', '0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95');  
  }else{
    deployer.deploy(FlashLoaner, '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac', '0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95');  
  }
  };


