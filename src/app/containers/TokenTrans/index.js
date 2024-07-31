import intl from 'react-intl-universal';
import React, { Component } from 'react';
import { BigNumber } from 'bignumber.js';
import { observer, inject } from 'mobx-react';
import { Table, Row, Col, message, Tag } from 'antd';
import TokenTransHistory from 'components/TransHistory/TokenTransHistory';
import CopyAndQrcode from 'components/CopyAndQrcode';
import SendTokenNormalTrans from 'components/SendNormalTrans/SendTokenNormalTrans';
import { WanTx, WanRawTx } from 'utils/hardwareUtils'
import { checkAddrType, getWalletIdByType, getFullChainName } from 'utils/helper';
import { WALLETID, TRANSTYPE, WANMAIN, WANTESTNET, BTCMAIN, BTCTESTNET, ETHMAIN, ETHTESTNET, BNBMAIN, BNBTESTNET, CHAINID, ETHCHAINID } from 'utils/settings';
import { signTransaction } from 'componentUtils/trezor';
import { formatNum } from 'utils/support';
import style from './index.less';
import * as ethUtil from 'ethereumjs-util';
import Common from '@ethereumjs/common';
import { TransactionFactory } from '@ethereumjs/tx';

message.config({
  duration: 2,
  maxCount: 1
});

@inject(stores => ({
  chainId: stores.session.chainId,
  isMainNetwork: stores.session.isMainNetwork,
  language: stores.languageIntl.language,
  getTokenAmount: stores.tokens.getTokenAmount,
  currTokenAddr: stores.tokens.currTokenAddr,
  transParams: stores.sendTransParams.transParams,
  tokenIconList: stores.tokens.tokenIconList,
  tokensList: stores.tokens.tokensList,
  getTokensListInfo: stores.tokens.getTokensListInfo,
  currTokenChain: stores.tokens.currTokenChain,
  setCurrToken: addr => stores.tokens.setCurrToken(addr),
  setCurrTokenChain: chain => stores.tokens.setCurrTokenChain(chain),
  setTokenIcon: (tokenScAddr) => stores.tokens.setTokenIcon(tokenScAddr),
  changeTitle: newTitle => stores.languageIntl.changeTitle(newTitle),
  updateTokensBalance: (...args) => stores.tokens.updateTokensBalance(...args),
  getChainAddressInfoByChain: chain => stores.tokens.getChainAddressInfoByChain(chain),
  getChainStoreInfoByChain: chain => stores.tokens.getChainStoreInfoByChain(chain),
  updateChainBalanceList: chain => stores.tokens.updateChainBalanceList(chain),
}))

@observer
class TokenTrans extends Component {
  init = (tokenAddr, chain) => {
    this.props.setCurrToken(tokenAddr);
    this.props.setCurrTokenChain(chain);
    this.props.getChainStoreInfoByChain(chain).updateTransHistory();
    if (!this.props.tokenIconList[tokenAddr]) {
      this.props.setTokenIcon(tokenAddr);
    }
  }

  componentDidMount() {
    this.init(this.props.tokenAddr, this.props.chain);
    this.props.updateChainBalanceList(this.props.chain);
    this.props.changeTitle('WanAccount.wallet');
    const { tokenAddr, chain } = this.props;
    this.props.getChainStoreInfoByChain(chain).updateTransHistory();
    this.props.updateTokensBalance(tokenAddr, chain);
    this.timer = setInterval(() => {
      this.props.getChainStoreInfoByChain(chain).updateTransHistory();
      this.props.updateTokensBalance(tokenAddr, chain);
    }, 5000);
  }

  componentWillUnmount() {
    clearInterval(this.timer);
    this.props.updateChainBalanceList()
  }

  sendLedgerTrans = (path, tx) => {
    message.info(intl.get('Ledger.signTransactionInLedger'));
    const { chain, isMainNetwork } = this.props;
    let chainId;
    if (chain === 'WAN') {
      chainId = isMainNetwork ? CHAINID.MAIN : CHAINID.TEST;
    } else { // TODO: suuport other EVMs
      chainId = isMainNetwork ? ETHCHAINID.MAIN : ETHCHAINID.TEST;
    }
    let formatTx = {
      from: tx.from.toLowerCase(),
      to: tx.to,
      value: '0x00',
      data: tx.data,
      chainId,
      nonce: '0x' + tx.nonce.toString(16),
      gasLimit: tx.gasLimit,
      gasPrice: '0x' + new BigNumber(tx.gasPrice).times(BigNumber(10).pow(9)).toString(16),
      Txtype: 1
    };
    console.log({ formatTx })
    let rawTx;
    const common = Common.custom({ chainId });
    const ethTx = TransactionFactory.fromTxData(formatTx, { common });
    rawTx = ethUtil.rlp.encode(ethTx.getMessageToSign(false)).toString('hex');
    console.log('sendLedgerTrans %s rawTx: %O', path, rawTx);
    return new Promise((resolve, reject) => {
      wand.request('wallet_signTransaction', { walletID: WALLETID.LEDGER, path, rawTx }, (err, sig) => {
        if (err) {
          message.warn(intl.get('Ledger.signTransactionFailed'));
          console.error('sendLedgerTrans signTransaction: %O', err);
          reject(err);
        } else {
          console.log('sendLedgerTrans signTransaction: %O', sig)
          formatTx.v = sig.v;
          formatTx.r = sig.r;
          formatTx.s = sig.s;
          let newTx = TransactionFactory.fromTxData(formatTx, { common });
          let signedTx = '0x' + newTx.serialize().toString('hex');
          console.log('sendLedgerTrans %s signedTx: %O', path, signedTx);
          resolve(signedTx);
        }
      });
    })
  }

  columns = [
    {
      dataIndex: 'name',
      editable: true
    },
    {
      dataIndex: 'address',
      render: text => <div className="addrText"><p className="address">{text}</p><CopyAndQrcode addr={text} /></div>
    },
    {
      dataIndex: 'balance',
      sorter: (a, b) => a.balance - b.balance,
      render: num => formatNum(num),
    },
    {
      dataIndex: 'action',
      render: (text, record) => {
        return <div><SendTokenNormalTrans symbol={this.props.symbol} balance={typeof (record.balance) === 'string' ? record.balance.replace(/,/g, '') : record.balance} tokenAddr={this.props.tokenAddr} from={record.address} path={record.path} handleSend={this.handleSend} chainType={this.props.chain} transType={TRANSTYPE.tokenTransfer} /></div>
      }
    }
  ];

  handleSend = from => {
    let params = this.props.transParams[from];
    const { chain, symbol, getChainAddressInfoByChain, isMainNetwork } = this.props;
    let addrInfo = getChainAddressInfoByChain(chain);

    if (addrInfo === undefined) {
      console.log('Unknown token type');
      return;
    }

    let type = checkAddrType(from, addrInfo);
    let walletID = getWalletIdByType(type);
    let trans = {
      from,
      walletID,
      chainType: chain,
      symbol: symbol,
      path: params.path,
      to: params.to,
      amount: params.token,
      gasLimit: `0x${params.gasLimit.toString(16)}`,
      gasPrice: params.gasPrice,
      nonce: params.nonce,
      data: params.data,
      satellite: {
        transferTo: params.transferTo.toLowerCase(),
        token: params.token
      }
    };

    return new Promise((resolve, reject) => {
      switch (type) {
        case 'ledger':
          this.sendLedgerTrans(params.path, trans).then(raw => {
            wand.request('transaction_raw', { raw, chainType: chain }, (err, txHash) => {
              if (err) {
                message.warn(intl.get('HwWallet.Accounts.sendTransactionFailed'));
                reject(false); // eslint-disable-line prefer-promise-reject-errors
              } else {
                wand.request('transaction_insertTransToDB', {
                  rawTx: {
                    txHash,
                    value: '0x0',
                    from: from.toLowerCase(),
                    srcSCAddrKey: params.to,
                    srcChainType: chain,
                    tokenSymbol: symbol,
                    ...trans
                  },
                  satellite: trans.satellite
                }, () => {
                  this.props.getChainStoreInfoByChain(chain).updateTransHistory();
                })
                console.log('TxHash:', txHash);
                message.success(intl.get('Send.transSuccess'));
                resolve(txHash);
              }
            });
          }).catch(() => { reject(false) }); // eslint-disable-line prefer-promise-reject-errors
          break;
        case 'trezor':
          let chainId;
          if (chain === 'WAN') {
            chainId = isMainNetwork ? CHAINID.MAIN : CHAINID.TEST;
          } else { // TODO: suuport other EVMs
            chainId = isMainNetwork ? ETHCHAINID.MAIN : ETHCHAINID.TEST;
          }
          signTransaction(params.path, {
            value: '0x',
            chainId,
            to: trans.to,
            data: trans.data,
            nonce: '0x' + trans.nonce.toString(16),
            gasLimit: trans.gasLimit,
            gasPrice: '0x' + new BigNumber(trans.gasPrice).times(BigNumber(10).pow(9)).toString(16),
          }, (_err, raw) => {
            if (_err) {
              console.log('signTrezorTransaction:', _err)
              return;
            }
            wand.request('transaction_raw', { raw, chainType: chain }, (err, txHash) => {
              if (err) {
                message.warn(intl.get('HwWallet.Accounts.sendTransactionFailed'));
                reject(err);
              } else {
                wand.request('transaction_insertTransToDB', {
                  rawTx: {
                    txHash,
                    value: '0x0',
                    from: from.toLowerCase(),
                    srcSCAddrKey: params.to,
                    srcChainType: chain,
                    tokenSymbol: symbol,
                    ...trans
                  },
                  satellite: trans.satellite
                }, () => {
                  this.props.getChainStoreInfoByChain(chain).updateTransHistory();
                })
                message.success(intl.get('Send.transSuccess'));
                resolve(txHash);
              }
            });
          });
          break;
        case 'normal':
        case 'import':
        case 'rawKey':
          wand.request('transaction_tokenNormal', trans, (err, txHash) => {
            console.log('Token res:', err, txHash);
            if (err) {
              message.warn(intl.get('WanAccount.sendTransactionFailed'));
              reject(false); // eslint-disable-line prefer-promise-reject-errors
            } else {
              if (txHash.code === false) {
                message.warn(intl.get('WanAccount.sendTransactionFailed'));
                reject(txHash.result);
              } else {
                message.success(intl.get('Send.transSuccess'));
                resolve(txHash)
              }
              this.props.getChainStoreInfoByChain(chain).updateTransHistory();
            }
          });
          break;
      }
    })
  }

  onClickTokenAddress = () => {
    let { isMainNetwork, tokenAddr, currTokenChain } = this.props;
    let prefix = '';
    switch (currTokenChain) {
      case 'WAN':
        prefix = isMainNetwork ? WANMAIN : WANTESTNET;
        break;
      case 'ETH':
        prefix = isMainNetwork ? ETHMAIN : ETHTESTNET;
        break;
      case 'BTC':
        prefix = isMainNetwork ? BTCMAIN : BTCTESTNET;
        break;
      case 'BNB':
        prefix = isMainNetwork ? BNBMAIN : BNBTESTNET;
        break;
      default:
        prefix = isMainNetwork ? WANMAIN : WANTESTNET;
    }
    wand.shell.openExternal(`${prefix}/token/${tokenAddr}`);
  }

  render() {
    const { getTokenAmount, getTokensListInfo, symbol, tokenAddr, chain } = this.props;
    this.props.language && this.columns.forEach(col => {
      col.title = intl.get(`WanAccount.${col.dataIndex}`)
    });

    return (
      <div className="account">
        <Row className="title">
          <Col span={12} className="col-left">
            <img className="totalImg" src={this.props.tokenIconList[tokenAddr]} />
            <span className="wanTotal">{getTokenAmount}</span>
            <span className="wanTex">{symbol}</span>
            <Tag className="symbol">{getFullChainName(chain)}</Tag>
          </Col>
          <Col span={12} className="col-right">
            <span className={style.tokenTxt}>{intl.get('Common.tokenAddr')}: <span className={style.tokenAddr} onClick={this.onClickTokenAddress}>{tokenAddr}</span></span>
          </Col>
        </Row>
        <Row className="mainBody">
          <Col>
            <Table className="content-wrap" pagination={false} rowKey={'address'} columns={this.columns} dataSource={getTokensListInfo} />
          </Col>
        </Row>
        <Row className="mainBody">
          <Col>
            <TokenTransHistory name={chain === 'WAN' ? ['normal', 'import', 'ledger', 'trezor', 'rawKey'] : ['normal', 'ledger', 'trezor', 'rawKey']} />
          </Col>
        </Row>
      </div>
    );
  }
}

export default props => <TokenTrans {...props} symbol={props.match.params.symbol} chain={props.match.params.chain} key={props.match.params.tokenAddr} tokenAddr={props.match.params.tokenAddr} />;
