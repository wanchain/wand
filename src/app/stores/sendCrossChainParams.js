import { observable, action, computed, makeObservable } from 'mobx';
import { CROSS_TYPE } from 'utils/settings';
import session from './session';

const GASLIMIT = 21000;

class SendCrossChainParams {
  @observable record = {};

  @observable currentFrom = '';

  @observable transParams = {};

  @observable BTCCrossTransParams = {
    from: [],
    changeAddress: '',
    to: '',
    value: 0,
    feeRate: 0,
    smgBtcAddr: '',
    btcAddress: '',
    storeman: '',
    wanAddress: '',
    gas: '',
    crossAddr: '',
    amount: 0,
    toAddr: '',
    txFeeRatio: ''
  };

  @observable XRPCrossTransParams = {
    groupAddr: '',
    groupName: '',
    value: 0,
    groupId: '',
    path: '',
    from: {
      walletID: 1,
      path: ''
    },
    fromAddr: '',
    to: {
      walletID: 1,
      path: ''
    },
    toAddr: ''
  };

  @observable gasLimit = GASLIMIT;

  @observable defaultGasPrice = 10;

  @observable minGasPrice = 1;

  @observable currentGasPrice = 10;

  constructor() {
    makeObservable(this);
  }

  @action updateRecord(record) {
    self.record = record;
  }

  @action addCrossTransTemplate(addr, params = {}) {
    let gasPrice = 1;
    self.currentFrom = addr;
    self.transParams[addr] = {
      gasPrice,
      source: params.chainType,
      destination: params.chainType ? params.chainType : 'WAN',
      from: {
        walletID: 1,
        path: params.path
      },
      to: {
        walletID: 1,
        path: ''
      },
      toAddr: '',
      amount: 0,
      storeman: '',
      txFeeRatio: 0,
      gasLimit: GASLIMIT,
      crossType: params.crossType ? params.crossType : CROSS_TYPE[0],
    };
  }

  @action updateBTCTransParams(paramsObj) {
    Object.keys(paramsObj).forEach(item => {
      self.BTCCrossTransParams[item] = paramsObj[item];
    });
  }

  @action updateTransParams(addr, paramsObj) {
    Object.keys(paramsObj).forEach(item => {
      self.transParams[addr][item] = paramsObj[item];
    });
  }

  @action updateXRPTransParams(paramsObj) {
    Object.keys(paramsObj).forEach(item => {
      self.XRPCrossTransParams[item] = paramsObj[item];
    });
  }

  @computed get minCrossBTC() {
    return 0.002;
  }

  @computed get btcFee() {
    return session.chainId === 1 ? 0.0001 : 0.001;
  }
}

const self = new SendCrossChainParams();
export default self;
