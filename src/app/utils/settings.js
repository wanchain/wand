export const MAIN = 'main';
export const TESTNET = 'testnet';

export const CHAINID = { // WAN
  MAIN: 888,
  TEST: 999,
}

export const ETHCHAINID = {
  MAIN: 1,
  TEST: 11155111,
}

export const BTCCHAINID = {
  MAIN: 0,
  TEST: 1,
}

export const BSCCHAINID = {
  MAIN: 56,
  TEST: 97,
}

export const WALLETID = {
  NATIVE: 0x01,
  LEDGER: 0x02,
  TREZOR: 0x03,
  KEYSTOREID: 0x05,
  RAWKEY: 0x06,
}

export const TRANSTYPE = {
  tokenTransfer: 'tokenTransfer'
};

export const INBOUND = 'inbound';
export const OUTBOUND = 'outbound';

export const MINDAYS = 7;
export const MAXDAYS = 90;

export const defaultTimeout = '5';

export const DEFAULT_GASPRICE = 180000000000;
export const DEFAULT_GAS = 4700000;

export const REDEEMWEOS_GAS = '250000';
export const LOCKETH_GAS = '1000000';
export const REDEEMWETH_GAS = '250000';
export const REVOKEETH_GAS = '250000';

export const LOCKWEOS_GAS = '600000';
export const LOCKWETH_GAS = '500000';
export const REDEEMETH_GAS = '250000';
export const REVOKEWETH_GAS = '250000';

export const FAST_GAS = '350000';

export const WANMAIN = 'https://www.wanscan.org';
export const WANTESTNET = 'https://testnet.wanscan.org';

export const BTCMAIN = 'https://www.blockchain.com/btc';
export const BTCTESTNET = 'https://www.blockchain.com/btc-testnet';

export const XRPMAIN = 'https://livenet.xrpl.org/transactions';
export const XRPTESTNET = 'https://testnet.xrpl.org/transactions';

export const ETHMAIN = 'https://etherscan.io';
export const ETHTESTNET = 'https://sepolia.etherscan.io';

export const EOSMAIN = 'https://bloks.io';
export const EOSTESTNET = 'https://jungle.bloks.io';

export const BNBMAIN = 'https://bscscan.com';
export const BNBTESTNET = 'https://testnet.bscscan.com';

export const BTCPATH_MAIN = "m/44'/0'/0'/0/";
export const BTCPATH_TEST = "m/44'/1'/0'/0/";
export const ETHPATH = "m/44'/60'/0'/0/";
export const EOSPATH = "m/44'/194'/0'/0/";
export const XRPPATH = "m/44'/144'/0'/0/";
export const WANPATH = "m/44'/5718350'/0'/0/";
export const BSCPATH = "m/44'/60'/0'/0/";

export const STAKEACT = ['StakeIn', 'StakeRegister', 'StakeUpdate', 'StakeAppend', 'StakeUpdateFeeRate'];
export const OSMSTAKEACT = ['Storeman-stakeIn', 'Storeman-stakeAppend', 'Storeman-stakeOut', 'Storeman-stakeClaim', 'Storeman-stakeIncentiveClaim'];
export const OSMDELEGATIONACT = ['Storeman-delegateIn', 'Storeman-delegateOut', 'Storeman-delegateClaim', 'Storeman-delegateIncentiveClaim'];

export const X = '0x0000000000000000000000000000000000000000000000000000000000000001';
export const HASHX = '0x0000000000000000000000000000000000000000000000000000000000000002';
export const FAKEVAL = '1';
export const FAKEADDR = '0x0000000000000000000000000000000000000003';
export const FAKESTOREMAN = '0x0000000000000000000000000000000000000004';

export const WALLET_CHAIN = ['WAN', 'BTC', 'ETH', 'EOS', 'XRP'];
export const CROSSCHAINTYPE = ['WAN', 'BTC', 'ETH', 'EOS', 'XRP'];

export const MAX_CONFIRM_BLKS = 100000000;
export const MIN_CONFIRM_BLKS = 0;

export const THIRD_PARTY_OPEN = true;
export const PENALTYNUM = 10000;
export const PRIVATE_TX_AMOUNT_SELECTION = [50000, 5000, 1000, 500, 200, 100, 50, 20, 10];

export const DAPPORDERING = ['DApp.sortByName', 'DApp.sortByDate'];
export const ALLCATEGORIES = 'DApp.allCategories';

export const CROSS_TYPE = ['FAST', 'HTLC'];
export const COIN_ACCOUNT = '0x0000000000000000000000000000000000000000';
export const COIN_ACCOUNT_EOS = 'eosio.token:EOS';

export const TOKEN_PRIORITY = {
  WAN: 4,
  BTC: 3,
  ETH: 2,
  XRP: 1,
  EOS: 0,
}
export const WAN_ETH_DECIMAL = 18;
export const MAX_BTC_FEE_RATE = 2000;
export const DECIMALS = {
  XRP: 6
}

export const MINXRPBALANCE = 10;
export const DEBOUNCE_DURATION = 600;

export const FNX_POOL_TESTNET = '0xcbf7eab1639c175545a0d8b24ac47ea36a2720ed';
export const FNX_POOL_MAINNET = '0xdab498c11f19b25611331cebffd840576d1dc86d';

export const FNX_TOKEN_TESTNET = '0x0664b5e161a741bcdec503211beeec1e8d0edb37';
export const FNX_TOKEN_MAINNET = '0xc6f4465a6a521124c8e3096b62575c157999d361';

export const CURRENCY_SYMBOL = {
  usd: '$',
  try: '₺'
}
