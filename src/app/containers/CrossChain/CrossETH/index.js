import intl from 'react-intl-universal';
import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { Table, Row, Col, message } from 'antd';
import { formatNum } from 'utils/support';
import totalImg from 'static/image/eth.png';
import CopyAndQrcode from 'components/CopyAndQrcode';
import { INBOUND, OUTBOUND } from 'utils/settings';
import ETHTrans from 'components/CrossChain/SendCrossChainTrans/ETHTrans';
import CrossChainTransHistory from 'components/CrossChain/CrossChainTransHistory/CrossETHHistory';
import { convertCrossChainTxErrorText } from 'utils/helper';
import { crossChainTrezorTrans } from 'componentUtils/trezor'
import BigNumber from 'bignumber.js';
import style from './index.less';

const CHAINTYPE = 'ETH';

@inject(stores => ({
  addrInfo: stores.ethAddress.addrInfo,
  language: stores.languageIntl.language,
  getNormalAddrList: stores.ethAddress.getNormalAddrList,
  ledgerAddrList: stores.ethAddress.ledgerAddrList,
  trezorAddrList: stores.ethAddress.trezorAddrList,
  getAmount: stores.ethAddress.getNormalAmount,
  getCCTokensListInfo: stores.tokens.getCCTokensListInfo,
  transParams: stores.sendCrossChainParams.transParams,
  tokenPairs: stores.crossChain.tokenPairs,
  setCurrSymbol: symbol => stores.crossChain.setCurrSymbol(symbol),
  changeTitle: newTitle => stores.languageIntl.changeTitle(newTitle),
  setCurrToken: addr => stores.tokens.setCurrToken(addr),
  updateTokensBalance: (...args) => stores.tokens.updateTokensBalance(...args),
  setCurrTokenChain: chain => stores.tokens.setCurrTokenChain(chain),
  setCurrTokenPairId: id => stores.crossChain.setCurrTokenPairId(id),
  updateChainBalanceList: chain => stores.tokens.updateChainBalanceList(chain),
}))

@observer
class CrossETH extends Component {
  constructor (props) {
    super(props);
    const { tokenPairs, match } = props;
    let tokenPairID = match.params.tokenPairId;
    this.info = tokenPairs[tokenPairID];
  }

  componentDidMount() {
    this.props.changeTitle('Common.crossChain');
    this.props.setCurrSymbol(CHAINTYPE);
    this.props.updateChainBalanceList(CHAINTYPE);
    this.props.setCurrTokenPairId(this.props.match.params.tokenPairId);
    this.props.setCurrToken(this.info.toAccount);
    this.props.setCurrTokenChain(this.info.toChainSymbol);
    this.props.updateTokensBalance(this.info.toAccount, this.info.toChainSymbol);
    this.timer = setInterval(() => {
      this.props.updateTokensBalance(this.info.toAccount, this.info.toChainSymbol);
    }, 5000);
  }

  componentWillUnmount() {
    this.props.updateChainBalanceList();
    clearInterval(this.timer);
  }

  inboundHandleSend = from => {
    const { tokenPairs, match } = this.props;
    let tokenPairID = match.params.tokenPairId;
    let info = this.info;
    let transParams = this.props.transParams[from];
    let input = {
      from: transParams.from,
      to: transParams.to,
      amount: transParams.amount,
      gasPrice: transParams.gasPrice,
      baseFeePerGas: transParams.baseFeePerGas,
      gasLimit: transParams.gasLimit,
      storeman: transParams.storeman,
      crosschainFee: transParams.crosschainFee,
      receivedAmount: transParams.receivedAmount,
      tokenPairID: tokenPairID,
      crossType: transParams.crossType,
      amountUnit: new BigNumber(transParams.amount).multipliedBy(Math.pow(10, info.ancestorDecimals)).toString(10),
      networkFee: new BigNumber(transParams.networkFee).multipliedBy(Math.pow(10, info.ancestorDecimals)).toString(10)
    };
    if (input.from.walletID === 2) {
      message.info(intl.get('Ledger.signTransactionInLedger'))
    }
    return new Promise((resolve, reject) => {
      if (input.from.walletID === 3) {
        input.BIP44Path = input.from.path;
        input.from = from;
        input.toAddr = transParams.toAddr;
        crossChainTrezorTrans({ input, tokenPairID, toChainSymbol: info.toChainSymbol, sourceSymbol: info.fromChainSymbol, sourceAccount: info.fromAccount, destinationSymbol: info.toChainSymbol, destinationAccount: info.toAccount, type: 'LOCK', tokenSymbol: 'ETH', tokenStand: 'ETH', chainType: 'ETH' }).then(() => {
          message.success(intl.get('Send.transSuccess'));
          resolve();
        }).catch(reject)
      } else {
        wand.request('crossChain_crossChain', { input, tokenPairID, toChainSymbol: info.toChainSymbol, sourceSymbol: info.fromChainSymbol, sourceAccount: info.fromAccount, destinationSymbol: info.toChainSymbol, destinationAccount: info.toAccount, type: 'LOCK' }, (err, ret) => {
          console.log('ETH inbound result:', err, ret);
          if (err) {
            if (err instanceof Object && err.desc && err.desc.includes('ready')) {
              message.warn(intl.get('Common.networkError'));
            } else {
              message.warn(err.desc);
            }
            reject(err);
          } else {
            if (ret.code) {
              message.success(intl.get('Send.transSuccess'));
              resolve(ret);
            } else {
              message.warn(convertCrossChainTxErrorText(ret.result));
              reject(ret);
            }
          }
        })
      }
    });
  }

  outboundHandleSend = from => {
    const { tokenPairs, match } = this.props;
    let tokenPairID = match.params.tokenPairId;
    let info = this.info;
    let transParams = this.props.transParams[from];
    let input = {
      from: transParams.from,
      to: transParams.to,
      amount: transParams.amount,
      gasPrice: transParams.gasPrice,
      baseFeePerGas: transParams.baseFeePerGas,
      gasLimit: transParams.gasLimit,
      storeman: transParams.storeman,
      crosschainFee: transParams.crosschainFee,
      receivedAmount: transParams.receivedAmount,
      tokenPairID: tokenPairID,
      crossType: transParams.crossType,
      amountUnit: new BigNumber(transParams.amount).multipliedBy(Math.pow(10, info.ancestorDecimals)).toString(10),
      networkFee: new BigNumber(transParams.networkFee).multipliedBy(Math.pow(10, info.ancestorDecimals)).toString(10)
    };

    return new Promise((resolve, reject) => {
      if (input.from.walletID === 2) {
        message.info(intl.get('Ledger.signTransactionInLedger'))
      }
      if (input.from.walletID === 3) {
        input.BIP44Path = input.from.path;
        input.from = from;
        input.toAddr = transParams.toAddr;
        crossChainTrezorTrans({ input, tokenPairID, toChainSymbol: info.fromChainSymbol, sourceSymbol: info.toChainSymbol, sourceAccount: info.toAccount, destinationSymbol: info.fromChainSymbol, destinationAccount: info.fromAccount, type: 'LOCK', tokenSymbol: 'ETH', tokenStand: 'ETH' }).then(() => {
          message.success(intl.get('Send.transSuccess'));
          resolve();
        }).catch(reject)
      } else {
        wand.request('crossChain_crossChain', { input, tokenPairID, toChainSymbol: info.fromChainSymbol, sourceSymbol: info.toChainSymbol, sourceAccount: info.toAccount, destinationSymbol: info.fromChainSymbol, destinationAccount: info.fromAccount, type: 'LOCK' }, (err, ret) => {
          console.log(err, ret);
          if (err) {
            if (err instanceof Object && err.desc && err.desc.includes('ready')) {
              message.warn(intl.get('Common.networkError'));
            } else {
              message.warn(err.desc);
            }
            reject(err);
          } else {
            if (ret.code) {
              message.success(intl.get('Send.transSuccess'));
              resolve(ret);
            } else {
              message.warn(convertCrossChainTxErrorText(ret.result));
              reject(ret);
            }
          }
        })
      }
    });
  }

  inboundColumns = [
    {
      dataIndex: 'name',
      width: '20%',
      ellipsis: true
    },
    {
      dataIndex: 'address',
      width: '50%',
      render: text => <div className="addrText"><p className="address">{text}</p><CopyAndQrcode addr={text} /></div>
    },
    {
      dataIndex: 'balance',
      width: '20%',
      ellipsis: true,
      sorter: (a, b) => a.balance - b.balance,
      render: num => formatNum(num),
    },
    {
      dataIndex: 'action',
      width: '10%',
      render: (text, record) => <div><ETHTrans balance={record.balance} from={record.address} record={record} account={record.name} chainPairId={this.props.match.params.tokenPairId} path={record.path} handleSend={this.inboundHandleSend} chainType={this.info.fromChainSymbol} type={INBOUND}/></div>
    }
  ];

  outboundColumns = [
    {
      dataIndex: 'name',
      width: '20%',
      ellipsis: true
    },
    {
      dataIndex: 'address',
      width: '50%',
      render: text => <div className="addrText"><p className="address">{text}</p><CopyAndQrcode addr={text} /></div>
    },
    {
      dataIndex: 'balance',
      width: '20%',
      ellipsis: true,
      sorter: (a, b) => a.balance - b.balance,
      render: num => formatNum(num),
    },
    {
      dataIndex: 'action',
      width: '10%',
      render: (text, record) => <div><ETHTrans balance={record.balance} from={record.address} record={record} account={record.name} chainPairId={this.props.match.params.tokenPairId} path={record.path} handleSend={this.outboundHandleSend} chainType={this.info.toChainSymbol} type={OUTBOUND}/></div>
    }
  ];

  render () {
    const { getNormalAddrList, getCCTokensListInfo, ledgerAddrList, trezorAddrList } = this.props;

    this.props.language && this.inboundColumns.forEach(col => {
      col.title = intl.get(`WanAccount.${col.dataIndex}`)
    })

    this.props.language && this.outboundColumns.forEach(col => {
      col.title = intl.get(`WanAccount.${col.dataIndex}`)
    })

    return (
      <div className="account">
        <Row className="title">
          <Col span={12} className="col-left"><img className="totalImg" src={totalImg} /><span className="wanTotal">{this.info.fromTokenSymbol} </span><span className={style.chain}>{this.info.fromChainName}</span></Col>
        </Row>
        <Row className="mainBody">
          <Col>
            <Table className="content-wrap" pagination={false} columns={this.inboundColumns} dataSource={getNormalAddrList.concat(ledgerAddrList).concat(trezorAddrList)} />
          </Col>
        </Row>
        <Row className="title">
          <Col span={12} className="col-left"><img className="totalImg" src={totalImg} /><span className="wanTotal">{this.info.toTokenSymbol} </span><span className={style.chain}>{this.info.toChainName}</span></Col>
        </Row>
        <Row className="mainBody">
          <Col>
            <Table className="content-wrap" pagination={false} columns={this.outboundColumns} dataSource={getCCTokensListInfo} />
          </Col>
        </Row>
        <Row className="mainBody">
          <Col>
            <CrossChainTransHistory name={['normal']} symbol='ETH' />
          </Col>
        </Row>
      </div>
    );
  }
}

export default CrossETH;
