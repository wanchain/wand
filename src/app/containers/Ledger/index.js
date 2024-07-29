import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { message } from 'antd';
import intl from 'react-intl-universal';
import { WALLETID } from 'utils/settings';
import { WanTx, WanRawTx } from 'utils/hardwareUtils';
import * as ethUtil from 'ethereumjs-util';
import Common from '@ethereumjs/common';
import { TransactionFactory } from '@ethereumjs/tx';
import Accounts from 'components/HwWallet/Accounts';
import ConnectHwWallet from 'components/HwWallet/Connect';

const WAN_PATH = "m/44'/5718350'/0'";
const CHAIN_TYPE = 'WAN';
const LEDGER = 'ledger';

@inject(stores => ({
  addrInfo: stores.wanAddress.addrInfo,
  language: stores.languageIntl.language,
  ledgerAddrList: stores.wanAddress.ledgerAddrList,
  updateTransHistory: () => stores.wanAddress.updateTransHistory(),
  changeTitle: newTitle => stores.languageIntl.changeTitle(newTitle),
  addLedgerAddr: newAddr => stores.wanAddress.addAddresses(LEDGER, newAddr),
  setCurrTokenChain: chain => stores.tokens.setCurrTokenChain(chain),
}))

@observer
class Ledger extends Component {
  constructor (props) {
    super(props);
    this.props.setCurrTokenChain('WAN');
  }

  componentDidMount() {
    this.props.changeTitle('Ledger.ledger');
  }

  componentDidUpdate () {
    if (this.props.ledgerAddrList.length !== 0 && !this.timer) {
      this.timer = setInterval(() => this.props.updateTransHistory(), 5000);
    }
  }

  componentWillUnmount () {
    clearInterval(this.timer);
  }

  instruction = () => {
    return (
      <div>
        <p className="com-gray">1. {intl.get('Ledger.connectLedgerWalletToComputer')} </p>
        <p className="com-gray">2. {intl.get('Ledger.enterPinCode')}</p>
        <p className="com-gray">3. {intl.get('Ledger.navigateToWanchainAPPAndEnterIntoIt')}</p>
        <p className="com-gray">4. {intl.get('Ledger.setContractDataOn')}</p>
      </div>
    )
  }

  connectAndGetPublicKey = callback => {
    console.log('connect to ledger')
    wand.request('wallet_connectToLedger', {}, (err, val) => {
      if (err) {
        callback(err, val);
      } else {
        this.getPublicKey(callback);
      }
    });
  }

  handleCancel = () => {
    wand.request('wallet_deleteLedger');
  }

  getPublicKey = callback => {
    wand.request('wallet_getPubKeyChainId', {
      walletID: WALLETID.LEDGER,
      path: WAN_PATH
    }, (err, val) => {
      callback(err, val);
    });
  }

  signTransaction = (path, tx, callback) => {
    let common = Common.custom({ chainId: tx.chainId });
    console.log('tx: %O', tx);
    let ethTx = TransactionFactory.fromTxData(tx, { common });
    console.log('ethTx: %O', ethTx);
    let rawTx = ethUtil.rlp.encode(ethTx.getMessageToSign(false)).toString('hex');
    console.log('rawTx: %O', rawTx);
    message.info(intl.get('Ledger.signTransactionInLedger'));
    wand.request('wallet_signTransaction', { walletID: WALLETID.LEDGER, path, rawTx }, (err, sig) => {
      if (err) {
        message.warn(intl.get('Ledger.signTransactionFailed'));
        console.error('Sign Failed, path: %s, error: %O', path, err);
        callback(err, null);
      } else {
        tx.v = sig.v;
        tx.r = sig.r;
        tx.s = sig.s;
        let newTx = TransactionFactory.fromTxData(tx, { common });
        let signedTx = '0x' + newTx.serialize().toString('hex');
        console.log('Signed tx: ', signedTx);
        callback(null, signedTx);
      }
    });
  }

  setAddresses = newAddr => {
    wand.request('account_getAll', { chainID: 5718350 }, (err, ret) => {
      if (err) return;
      let hdInfoFromDb = [];
      Object.values(ret.accounts).forEach(item => {
        if (item[WALLETID.LEDGER]) {
          hdInfoFromDb.push(item[WALLETID.LEDGER]);
        }
      })
      newAddr.forEach(item => {
        let matchValue = hdInfoFromDb.find(val => val.addr === item.address.toLowerCase())
        if (matchValue) {
          item.name = matchValue.name;
        }
      });
      this.props.addLedgerAddr(newAddr)
    })
  }

  render () {
    const { ledgerAddrList } = this.props;
    return (
      <div>
        {
          ledgerAddrList.length === 0
            ? <ConnectHwWallet onCancel={this.handleCancel} setAddresses={this.setAddresses} Instruction={this.instruction} getPublicKey={this.connectAndGetPublicKey} dPath={WAN_PATH} />
            : <Accounts name={['ledger']} addresses={ledgerAddrList} signTransaction={this.signTransaction} chainType={CHAIN_TYPE} />
        }
      </div>
    );
  }
}

export default Ledger;
