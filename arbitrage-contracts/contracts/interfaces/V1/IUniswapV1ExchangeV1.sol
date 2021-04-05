pragma solidity >=0.5.0;

interface IUniswapV1ExchangeV1 {
    function balanceOf(address owner) external view returns (uint);
    function transferFrom(address from, address to, uint value) external returns (bool);
    function removeLiquidity(uint, uint, uint, uint) external returns (uint, uint);
    function tokenToEthSwapInput(uint, uint, uint) external returns (uint);
    function ethToTokenSwapInput(uint, uint) external payable returns (uint);
    function getEthToTokenOutputPrice(uint256) external view returns (uint256);
    function getTokenToEthInputPrice(uint256) external view returns (uint256);
}
