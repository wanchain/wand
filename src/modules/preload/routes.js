module.exports = {
    phrase: [ 'generate', 'reveal', 'checkPwd', 'has', 'import', 'reset'],
    wallet: [ 'lock', 'unlock', 'checkUpdateDB', 'getPubKey', 'connectToLedger', 'deleteLedger', 'isConnected', 'getPubKeyChainId', 'signPersonalMessage', 'signTransaction', 'setUserTblVersion', 'reboot', 'exportPrivateKeys', 'importPrivateKey', 'signTx' ],
    address: [ 'get', 'getOne', 'getNonce', 'balance', 'balances', 'getPrivateTxInfo', 'scanMultiOTA', 'stopScanMultiOTA', 'stopSingleScan', 'initScanOTA', 'isWanAddress', 'isXrpAddress', 'fromKeyFile', 'getKeyStoreCount', 'isValidatorAddress', 'ethBalance', 'isEthAddress', 'btcImportAddress', 'getBtcMultiBalances', 'btcCoinSelect', 'btcCoinSelectSplit', 'getEosAccountInfo', 'getEOSResourcePrice', 'getRamPrice', 'isEosPublicKey', 'isEosNameExist', 'getNewPathIndex', 'getNewNameForNativeAccount', 'isValidPrivateKey', 'getRegisteredCoinGecko', 'getAllBalances' ],
    account: [ 'create', 'get', 'getAllAccounts', 'getAll', 'update', 'delete', 'getAccountByPublicKey', 'setImportedUserAccounts', 'getImportedAccountsByPublicKey', 'getAccountStakeInfo', 'deleteEOSImportedAccounts' ],
    transaction: [ 'normal', 'private', 'refund', 'raw', 'estimateGas', 'showRecords', 'insertTransToDB', 'BTCNormal', 'XRPNormal', 'EOSNormal', 'tokenNormal', 'estimateSmartFee', 'converter' ],
    query: [ 'config', 'getGasPrice' ],
    staking: [ 'getContractAddr', 'info', 'delegateIn', 'delegateOut', 'getContractData', 'insertTransToDB', 'posInfo', 'registerValidator', 'insertRegisterValidatorToDB', 'validatorInfo', 'validatorAppend', 'validatorUpdate', 'getValidatorsInfo', 'getCurrentEpochInfo', 'PosStakeUpdateFeeRate' ],
    setting: ['switchNetwork', 'set', 'get', 'updateDapps', 'getDapps', 'getDAppInjectFile', 'rpcDelay', 'wanNodeDelay', 'ethNodeDelay', 'btcNodeDelay', 'eosNodeDelay', 'resetSettingsByOptions'],
    contact: ['get', 'addAddress', 'addPrivateAddress', 'delAddress', 'delPrivateAddress', 'reset'],
    crossChain: ['getTokensInfo', 'getTokenPairs', 'getChainInfoByChainId', 'getCcTokenSelections', 'setCcTokenSelectStatus', 'updateTokensInfo', 'updateTokensBalance', 'getTokenInfo', 'addCustomToken', 'deleteCustomToken', 'getSmgList', 'getStoremanGroupList', 'getHtmlAddr', 'getCrossChainContractData', 'crossChain', 'crossBTC', 'crossETH', 'crossEOS', 'crossEOS2WAN', 'getAllUndoneCrossTrans', 'increaseFailedRetryCount', 'getAllCrossTrans', 'getRegisteredOrigToken', 'getMintQuota', 'getBurnQuota', 'getQuota', 'getFastMinCount', 'getFees', 'estimatedXrpFee', 'getCrossChainFees', 'insertCrossChainTransToDB', 'estimateCrossChainNetworkFee', 'estimateCrossChainOperationFee'],
    dappStore: ['getRegisteredDapp', 'getRegisteredAds'],
    upgrade: ['start'],
    storeman: ['getRewardRatio', 'getMultiStoremanGroupInfo', 'getSelectedStoreman', 'publicToAddress', 'getStoremanConf', 'getStoremanDelegatorTotalIncentive', 'getStoremanStakeTotalIncentive', 'getStoremanDelegators', 'openStoremanAction', 'getContractData', 'insertStoremanTransToDB', 'getOpenStoremanGroupList', 'getReadyOpenStoremanGroupList', 'getStoremanStakeInfo', 'getStoremanDelegatorInfo', 'getStoremanGroupMember', 'getStoremanCandidates'],
  }
