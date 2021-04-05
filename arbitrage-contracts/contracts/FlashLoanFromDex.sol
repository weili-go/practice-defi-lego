pragma solidity =0.6.6;

import './interfaces/V1/IUniswapV1FactoryV1.sol';
import './interfaces/V1/IUniswapV1ExchangeV1.sol';
import './interfaces/IWETH.sol';
import './UniswapV2Library.sol';
import './SushiswapV2Library.sol';
import './interfaces/IUniswapV2Router02.sol';
import './interfaces/IUniswapV2Pair.sol';
import './interfaces/IERC20.sol';

// I just want WETH, so you need to give pair of TOKEN/WETH.
contract FlashLoanFromDex {
    IUniswapV1FactoryV1 immutable factoryV1;
    address immutable ufactory;
    address immutable sfactory;
    IWETH public constant WETH = IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

    constructor(address _ufactory, address _sfactory, address _factoryV1) public {
        factoryV1 = IUniswapV1FactoryV1(_factoryV1);
        ufactory = _ufactory;
        sfactory = _sfactory;
    }

    // needs to accept ETH from any V1 exchange and WETH. 
    receive() external payable {}

    // gets tokens/WETH via a Uniswap V2 or Sushiswap flashloan, swaps for the ETH/tokens on V1, 
    //   repays Uniswap V2 or Sushiswap, and keeps the rest weth, oh yeah!
    function uniswapV2Call(address sender, uint amount0, uint amount1, bytes calldata data) external {
        address[] memory path = new address[](2);
        uint amountToken;
        uint amountETH;
        (uint flag) = abi.decode(data, (uint));

        { // scope for token{0,1}, avoids stack too deep errors
        address token0 = IUniswapV2Pair(msg.sender).token0();
        address token1 = IUniswapV2Pair(msg.sender).token1();
        // Uniswap, Sushiswap 
        if(flag == 11){
            require(msg.sender == UniswapV2Library.pairFor(ufactory, token0, token1), "Unauthorized From Uniswap"); // ensure that msg.sender is actually a V2 pair
        } else {
            require(msg.sender == SushiswapV2Library.pairFor(sfactory, token0, token1), "Unauthorized From Sushiswap"); // ensure that msg.sender is actually a V2 pair
        }
        
        require(amount0 == 0 || amount1 == 0, "Input not right"); // this strategy is unidirectional
        path[0] = amount0 == 0 ? token0 : token1;
        path[1] = amount0 == 0 ? token1 : token0;
        amountToken = token0 == address(WETH) ? amount1 : amount0;
        amountETH = token0 == address(WETH) ? amount0 : amount1;
        }

        require(path[0] == address(WETH) || path[1] == address(WETH), "WETH is needed"); // this strategy only works with a V2 WETH pair
        IERC20 token = IERC20(path[0] == address(WETH) ? path[1] : path[0]);
        IUniswapV1ExchangeV1 exchangeV1 = IUniswapV1ExchangeV1(factoryV1.getExchange(address(token))); // get V1 exchange

        if (amountToken > 0) {
            token.approve(address(exchangeV1), amountToken);
            uint amountReceived = exchangeV1.tokenToEthSwapInput(amountToken, 1, uint(-1));
            uint amountRequired = flag == 11 ? UniswapV2Library.getAmountsIn(ufactory, amountToken, path)[0] : SushiswapV2Library.getAmountsIn(sfactory, amountToken, path)[0];
            require(amountReceived > amountRequired, "NO Profit"); // fail if we didn't get enough ETH back to repay our flash loan
            // change eth to weth
            WETH.deposit{value: amountReceived}();
            WETH.transfer(msg.sender, amountRequired); // return WETH to source pair
            WETH.transfer(sender, amountReceived - amountRequired); // return WETH profit to sender 
        } else {
            uint amountRequired = flag == 11 ? UniswapV2Library.getAmountsIn(ufactory, amountETH, path)[0] : SushiswapV2Library.getAmountsIn(sfactory, amountETH, path)[0];
            uint valueEth = exchangeV1.getEthToTokenOutputPrice(amountRequired);
            WETH.withdraw(valueEth);
            exchangeV1.ethToTokenSwapInput{value: valueEth}(amountRequired, uint(-1));
            require(amountETH > valueEth, "NO Profit"); // fail if we didn't get enough tokens back to repay our flash loan
            assert(token.transfer(msg.sender, amountRequired)); // return tokens to source pair
            assert(WETH.transfer(sender, amountETH - valueEth)); // keep the rest! (tokens)
        }
    }
}
