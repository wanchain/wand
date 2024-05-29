import React, { Component } from 'react';
import { Spin, Modal, Select } from 'antd';
import style from './index.less';
import { WALLETID, ETHPATH } from 'utils/settings'
import { BigNumber } from 'bignumber.js';
import { observer, inject } from 'mobx-react';
import {
  signPersonalMessage as trezorSignPersonalMessage,
  signTransaction as trezorSignTransaction
} from 'componentUtils/trezor'
import { toWei, fromWei } from 'utils/support.js';
import { getNonce, getGasInfo, getChainId, fillRawTxGasPrice } from 'utils/helper';
import intl from 'react-intl-universal';
import styled from 'styled-components';

const { confirm } = Modal;

const { Option } = Select;

const pu = require('promisefy-util');

@inject(stores => ({
  settings: stores.session.settings,
  // wanchain legacy path address
  addrSelectedList: stores.wanAddress.addrSelectedList,
  getAddrList: stores.wanAddress.getAddrList,
  addrInfo: stores.wanAddress.addrInfo,
  ledgerAddrList: stores.wanAddress.ledgerAddrList,
  trezorAddrList: stores.wanAddress.trezorAddrList,
  // ethereum path address
  addrSelectedListEth: stores.ethAddress.addrSelectedList,
  getAddrListEth: stores.ethAddress.getAddrList,
  addrInfoEth: stores.ethAddress.addrInfo,
  ledgerAddrListEth: stores.ethAddress.ledgerAddrList,
  trezorAddrListEth: stores.ethAddress.trezorAddrList,
}))

@observer
class DApp extends Component {
  constructor(props) {
    super(props);
    this.state = { loading: true, preload: null };
    if (!props.dAppUrl) {
      this.dAppUrl = 'https://demodex.wandevs.org/';
    } else {
      this.dAppUrl = props.dAppUrl;
    }
    this.addresses = {};
  }

  async componentDidMount() {
    this.setState({ loading: true });
    const preload = await this.getPreloadFile()
    this.setState({ preload: preload });
    this.addEventListeners();
    this.chainType = 'WAN';
    this.chainId = await getChainId();
    console.log('Dapp init chain: %s(%d), wanPath: %s', this.chainType, this.chainId, this.props.settings.wan_path);
  }

  addEventListeners = () => {
    if (this.webview || !this.state.preload) {
      return;
    }

    var webview = document.getElementById('dappView');

    if (!webview) {
      return;
    }

    webview.addEventListener('dom-ready', function (e) {
      this.setState({ loading: false });
      webview.openDevTools();
    }.bind(this));

    webview.addEventListener('ipc-message', function (event) {
      const { args, channel } = event;
      if (channel === 'dapp-message') {
        this.handlerDexMessage(args[0]);
      }
    }.bind(this));

    this.webview = webview;
  }

  componentWillUnmount() {
    if (typeof (this.selectAddressModal) === 'object' && 'destroy' in this.selectAddressModal) {
      this.selectAddressModal.destroy();
    }
  }

  handlerDexMessage(args) {
    const msg = {
      method: args[0],
      id: args[1]
    }
    switch (msg.method) {
      case 'getAddresses':
        this.getAddresses(msg);
        break;
      case 'loadNetworkId':
        this.loadNetworkId(msg);
        break;
      case 'signPersonalMessage':
        msg.message = args[2];
        msg.address = args[3];
        this.signPersonalMessage(msg);
        break;
      case 'sendTransaction':
        msg.message = args[2];
        this.sendTransaction(msg);
        break;
      case 'signTransaction':
        msg.message = args[2];
        this.signTransaction(msg);
        break;
      case 'sendRawTransaction':
        msg.message = args[2];
        this.sendRawTransaction(msg);
        break;
      case 'switchEthereumChain':
        msg.message = args[2];
        this.switchEthereumChain(msg);
        break;
      default:
        console.log('unknown method.');
        break;
    }
  }

  sendToDApp(msg) {
    if (!this.webview) {
      this.webview = document.getElementById('dappView');
    }
    this.webview.send('dapp-message', msg);
  }

  async getAddresses(msg) {
    await this.showAddresses(msg, async (msg) => {
      this.sendToDApp(msg);
    }, async (msg) => {
      this.sendToDApp(msg);
    });
  }

  loadNetworkId(msg) {
    msg.err = null;
    msg.val = this.chainId;
    this.sendToDApp(msg);
  }

  async getWalletFromAddress(address) {
    try {
      if (!this.addresses[address]) {
        return '';
      }
      let addrInfo = [888, 999].includes(this.chainId) ? this.props.addrInfo : this.props.addrInfoEth;
      let addrPath = [888, 999].includes(this.chainId) ? this.props.settings.wan_path : ETHPATH;

      let addrType = '';
      switch (this.addresses[address].walletID) {
        case WALLETID.NATIVE:
          addrType = 'normal';
          break;
        case WALLETID.LEDGER:
          addrType = 'ledger';
          break;
        case WALLETID.TREZOR:
          addrType = 'trezor';
          break;
      }
      let index = Object.keys(addrInfo[addrType]).findIndex(val => val.toLowerCase() === address);
      let addr = '';
      if (index !== -1) {
        addr = Object.keys(addrInfo[addrType])[index];
      }
      let path = addrInfo[addrType][addr] && addrInfo[addrType][addr]['path'];
      if (path.indexOf('m') === -1) {
        path = addrPath + path;
      }
      return {
        id: this.addresses[address].walletID,
        path: path,
      }
    } catch (error) {
      console.log('getWalletFromAddress error', error);
    }
  }

  async signPersonalMessage(msg) {
    await this.showConfirm('sign', msg, async (msg) => {
      msg.err = null;
      msg.val = null;

      const wallet = await this.getWalletFromAddress(msg.address.toLowerCase());

      if (wallet.id === WALLETID.TREZOR) {
        try {
          let sig = await trezorSignPersonalMessage(wallet.path, msg.message);
          msg.val = sig;
        } catch (error) {
          console.log(error);
          msg.err = error;
        }
        this.sendToDApp(msg);
      } else {
        wand.request('wallet_signPersonalMessage', { walletID: wallet.id, path: wallet.path, rawTx: msg.message }, (err, sig) => {
          if (err) {
            msg.err = err;
            console.log(`Sign Failed:`, JSON.stringify(err));
          } else {
            msg.val = sig;
          }
          this.sendToDApp(msg);
        });
      }
    }, async (msg) => {
      msg.err = 'The user rejects in the wallet.';
      this.sendToDApp(msg);
    });
  }

  toHexString(value) {
    if (typeof value === 'string') {
      return value.startsWith('0x') ? value : `0x${Number(value).toString(16)}`;
    } else {
      return `0x${value.toString(16)}`;
    }
  }

  async nativeSendTransaction(msg, wallet) {
    let gasPrice = await getGasInfo(this.chainType);
    let amountInWei = new BigNumber(msg.message.value);
    let trans = {
      walletID: wallet.id,
      chainType: 'WAN',
      symbol: 'WAN',
      path: wallet.path,
      to: msg.message.to,
      amount: amountInWei.div(1e18),
      gasLimit: this.toHexString(msg.message.gasLimit || msg.message.gas || 2000000),
      gasPrice: msg.message.gasPrice ? fromWei(msg.message.gasPrice, 'Gwei') : gasPrice.gasPrice,
      baseFeePerGas: gasPrice.baseFeePerGas,
      data: msg.message.data,
      chainId: this.chainId
    };

    wand.request('transaction_normal', trans, function (err, val) {
      if (err) {
        console.log('error printed inside callback: ', err)
        msg.err = err;
      } else {
        if (val.code === false) {
          msg.err = new Error(val.result);
        } else {
          msg.val = val.result;
        }
      }
      this.sendToDApp(msg);
    }.bind(this)
    );
  }

  async trezorSendTransaction(msg, wallet) {
    try {
      let nonce = await getNonce(msg.message.from, this.chainType);
      let gasPrice = await getGasInfo(this.chainType);
      let data = msg.message.data;
      let amountWei = msg.message.value;
      let rawTx = {};
      rawTx.from = msg.message.from;
      rawTx.to = msg.message.to;
      rawTx.value = amountWei ? '0x' + Number(amountWei).toString(16) : '0x00';
      rawTx.data = data;
      rawTx.nonce = '0x' + nonce.toString(16);
      rawTx.gasLimit = this.toHexString(msg.message.gasLimit || msg.message.gas || 2000000);
      fillRawTxGasPrice({ gasPrice: msg.message.gasPrice || toWei(gasPrice.gasPrice, 'gwei'), baseFeePerGas: toWei(gasPrice.baseFeePerGas || 0, 'gwei') }, rawTx);
      rawTx.chainId = this.chainId;
      let raw = await pu.promisefy(trezorSignTransaction, [wallet.path, rawTx]);
      let txHash = await pu.promisefy(wand.request, ['transaction_raw', { raw, chainType: this.chainType }]);
      msg.val = txHash;
    } catch (error) {
      console.log(error)
      msg.err = error;
    }

    this.sendToDApp(msg);
  }

  async nativeSignTransaction(msg, wallet) {
    let nonce = await getNonce(msg.message.from, this.chainType);
    let gasPrice = await getGasInfo(this.chainType);
    let data = msg.message.data;
    let amountWei = msg.message.value;
    let rawTx = {};
    rawTx.from = msg.message.from;
    rawTx.to = msg.message.to;
    rawTx.value = amountWei ? '0x' + Number(amountWei).toString(16) : '0x00';
    rawTx.data = data;
    rawTx.nonce = '0x' + nonce.toString(16);
    rawTx.gasLimit = this.toHexString(msg.message.gasLimit || msg.message.gas || 2000000);
    fillRawTxGasPrice({ gasPrice: msg.message.gasPrice || toWei(gasPrice.gasPrice, 'gwei'), baseFeePerGas: toWei(gasPrice.baseFeePerGas || 0, 'gwei') }, rawTx);
    rawTx.chainId = this.chainId;
    console.log('DApp wallet_signTx input: %O', { chainType: this.chainType, walletID: wallet.id, path: wallet.path, rawTx });
    wand.request('wallet_signTx', { walletID: wallet.id, path: wallet.path, rawTx }, function (err, tx) {
      console.log('wallet_signTx return %O', err || tx);
      if (err) {
        console.log('error printed inside callback: ', err)
        msg.err = err;
      } else {
        msg.val = tx;
      }
      this.sendToDApp(msg);
    }.bind(this)
    );
  }

  async trezorSignTransaction(msg, wallet) {
    try {
      let nonce = await getNonce(msg.message.from, this.chainType);
      let gasPrice = await getGasInfo(this.chainType);
      let data = msg.message.data;
      let amountWei = msg.message.value;
      let rawTx = {};
      rawTx.from = msg.message.from;
      rawTx.to = msg.message.to;
      rawTx.value = amountWei ? '0x' + Number(amountWei).toString(16) : '0x00';
      rawTx.data = data;
      rawTx.nonce = '0x' + nonce.toString(16);
      rawTx.gasLimit = this.toHexString(msg.message.gasLimit || msg.message.gas || 2000000);
      fillRawTxGasPrice({ gasPrice: msg.message.gasPrice || toWei(gasPrice.gasPrice, 'gwei'), baseFeePerGas: toWei(gasPrice.baseFeePerGas || 0, 'gwei') }, rawTx);
      rawTx.chainId = this.chainId;
      let raw = await pu.promisefy(trezorSignTransaction, [wallet.path, rawTx]);
      msg.val = raw;
    } catch (error) {
      console.log(error)
      msg.err = error;
    }

    this.sendToDApp(msg);
  }

  async sendTransaction(msg) {
    await this.showConfirm('send', msg, async (msg) => {
      msg.err = null;
      msg.val = null;
      if (!msg.message || !msg.message.from) {
        msg.err = 'can not find from address.';
        this.sendToDApp(msg);
        return;
      }

      const wallet = await this.getWalletFromAddress(msg.message.from);

      if (wallet.id === WALLETID.TREZOR) {
        await this.trezorSendTransaction(msg, wallet);
      } else {
        await this.nativeSendTransaction(msg, wallet);
      }
    }, async (msg) => {
      msg.err = 'The user rejects in the wallet.';
      this.sendToDApp(msg);
    });
  }

  async signTransaction(msg) {
    await this.showConfirm('send', msg, async (msg) => {
      msg.err = null;
      msg.val = null;
      if (!msg.message || !msg.message.from) {
        msg.err = 'can not find from address.';
        this.sendToDApp(msg);
        return;
      }

      const wallet = await this.getWalletFromAddress(msg.message.from);

      if (wallet.id === WALLETID.TREZOR) {
        await this.trezorSignTransaction(msg, wallet);
      } else {
        await this.nativeSignTransaction(msg, wallet);
      }
    }, async (msg) => {
      msg.err = 'The user rejects in the wallet.';
      this.sendToDApp(msg);
    });
  }

  async sendRawTransaction(msg) {
    msg.err = null;
    msg.val = null;
    try {
      let txHash = await pu.promisefy(wand.request, ['transaction_raw', { raw: msg.message, chainType: this.chainType }]);
      msg.val = txHash;
    } catch (error) {
      console.error('Dapp sendRawTransaction error: %O', error)
      msg.err = error;
    }
    this.sendToDApp(msg);
  }

  async switchEthereumChain(msg) {
    msg.err = null;
    if (isNaN(msg.message.chainId)) {
      msg.err = 'Invalid chainId.';
      this.sendToDApp(msg);
      return;
    }
    let newChainType = msg.message.chainType;
    let newChainId = parseInt(msg.message.chainId);
    if ((newChainType === this.chainType) && (newChainId === this.chainId)) {
      this.sendToDApp(msg);
      return;
    }
    await this.showConfirm('send', msg, async (msg) => {
      this.chainType = newChainType;
      this.chainId = newChainId;
      console.log('Dapp switchEthereumChain: %s(%d)', newChainType, newChainId);
      this.sendToDApp(msg);
    }, async (msg) => {
      msg.err = 'The user rejects in the wallet.';
      this.sendToDApp(msg);
    });
  }

  async getPreloadFile() {
    return pu.promisefy(wand.request, ['setting_getDAppInjectFile']);
  }

  async showConfirm(type, msg, onOk, onCancel) {
    let title = '';
    if (type === 'sign') {
      title = intl.get('dAppConfirm.sign');
    } else {
      title = intl.get('dAppConfirm.send');
    }

    confirm({
      title: title,
      content: intl.get('dAppConfirm.warn'),
      okText: intl.get('ValidatorRegister.acceptAgency'),
      cancelText: intl.get('ValidatorRegister.notAcceptAgency'),
      async onOk() {
        await onOk(msg);
      },
      async onCancel() {
        await onCancel(msg);
      },
    });
  }

  async showAddresses(msg, onOk, onCancel) {
    let title = intl.get('HwWallet.Connect.selectAddress');
    let addrAll = [];
    msg.err = null;
    msg.val = [];
    let { addrSelectedList, addrSelectedListEth } = this.props;
    try {
      let val = await pu.promisefy(wand.request, ['account_getAll', { chainID: this.chainId }]);
      let addrs = [];
      for (var account in val.accounts) {
        if (Object.prototype.hasOwnProperty.call(val.accounts[account], '1')) {
          addrs.push(val.accounts[account]['1'].addr);
        }
      }
      let addrSelected = [888, 999].includes(this.chainId) ? addrSelectedList : addrSelectedListEth;
      addrAll = addrSelected.slice();
      for (var i = 0, len = addrAll.length; i < len; i++) {
        const addr = addrAll[i];
        addrAll[i] = addrAll[i].replace(/^Ledger: /, '').toLowerCase();
        addrAll[i] = addrAll[i].replace(/^trezor: /, '').toLowerCase();

        this.addresses[addrAll[i]] = {};
        if (addr.indexOf('Ledger') !== -1) {
          this.addresses[addrAll[i]].walletID = WALLETID.LEDGER;
        } else if (addr.indexOf('Trezor') !== -1) {
          this.addresses[addrAll[i]].walletID = WALLETID.TREZOR;
        } else {
          this.addresses[addrAll[i]].walletID = WALLETID.NATIVE;
        }
      }
      msg.val = [addrAll[0]];
    } catch (error) {
      console.log(error);
      msg.err = error;
    }

    this.selectAddressModal = confirm({
      title: title,
      content: (
        <StyledSelect labelInValue defaultValue={{
          key: addrAll[0],
          label: <div><span style={{ color: '#2FBDF4' }}>{this.getNameByAddr(addrAll[0])}:&nbsp;</span>{addrAll[0]}</div>
        }} onChange={e => {
          msg.val = [e.key];
        }}>
          {
            addrAll.map(v => {
              return (<Option key={v} value={v}><span><span style={{ color: '#2FBDF4' }}>{this.getNameByAddr(v)}:&nbsp;</span>{v}</span></Option>);
            })
          }
        </StyledSelect>
      ),
      okText: intl.get('ValidatorRegister.acceptAgency'),
      cancelText: intl.get('ValidatorRegister.notAcceptAgency'),
      async onOk() {
        await onOk(msg);
      },
      async onCancel() {
        await onCancel(msg);
      },
    });
  }

  getNameByAddr(addr) {
    let isWan = [888, 999].includes(this.chainId);
    let { ledgerAddrList, ledgerAddrListEth, trezorAddrList, trezorAddrListEth, getAddrList, getAddrListEth } = this.props;
    let ledgerAddr = isWan ? ledgerAddrList : ledgerAddrListEth;
    let trezorAddr = isWan ? trezorAddrList : trezorAddrListEth;
    let getAddr = isWan ? getAddrList : getAddrListEth;
    let item;
    if (this.addresses[addr].walletID === WALLETID.LEDGER) {
      item = ledgerAddr.find(v => v.address.toLowerCase() === addr.toLowerCase());
    } else if (this.addresses[addr].walletID === WALLETID.TREZOR) {
      item = trezorAddr.find(v => v.address.toLowerCase() === addr.toLowerCase());
    } else {
      item = getAddr.find(v => v.address.toLowerCase() === addr.toLowerCase());
    }
    return item ? item.name : '';
  }

  renderLoadTip = () => {
    return (
      <div>
        {/* Loading... */}
        {/* <br />
        <br />
        If you're using it for the first time, it might take a few minutes... */}
      </div>
    );
  }

  render() {
    const preload = this.state.preload;
    if (preload) {
      return (
        <div className={style.myIframe}>
          {this.state.loading
            ? <Spin
              style={{ margin: '60px 0px 0px 60px' }}
              tip={this.renderLoadTip()}
              size="large"
            /> : null}
          <webview
            id="dappView"
            src={this.dAppUrl}
            style={{ width: '100%', height: '100%' }}
            nodeintegration="on"
            preload={preload}
            allowpopups="on"
          >
            Your electron doesn't support webview, please set webviewTag: true.
          </webview>
        </div>
      );
    } else {
      return null;
    }
  }
}

const StyledSelect = styled(Select)`
  .ant-select-selection {
    border: none!important;
  }
  margin-top: 30px!important;
  margin-bottom: 20px!important;
`;

export default DApp;
