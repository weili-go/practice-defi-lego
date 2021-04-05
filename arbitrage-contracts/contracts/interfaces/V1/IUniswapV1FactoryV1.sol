pragma solidity >=0.5.0;

interface IUniswapV1FactoryV1 {
    function getExchange(address) external view returns (address);
}
