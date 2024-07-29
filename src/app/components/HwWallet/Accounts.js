import React, { Component } from 'react';
import { Table, message, Row, Col } from 'antd';
import { observer, inject } from 'mobx-react';
import intl from 'react-intl-universal';
import BigNumber from 'bignumber.js';
import { formatNum } from 'utils/support';
import { hasSameName } from 'utils/helper';
import TransHistory from 'components/TransHistory';
import CopyAndQrcode from 'components/CopyAndQrcode';
import SendNormalTrans from 'components/SendNormalTrans';
import { EditableFormRow, EditableCell } from 'components/Rename';
import style from './index.less';

@inject(stores => ({
  addrInfo: stores.wanAddress.addrInfo,
  language: stores.languageIntl.language,
  transParams: stores.sendTransParams.transParams,
  updateName: (arr, type) => stores.wanAddress.updateName(arr, type),
  updateTransHistory: () => stores.wanAddress.updateTransHistory(),
}))

@observer
class Accounts extends Component {
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
      render: balance => <span>{formatNum(balance)}</span>
    },
    {
      dataIndex: 'action',
      render: (text, record) => <div><SendNormalTrans isHardwareWallet={true} path={record.path} from={record.address} walletID={record.wid} balance={record.balance} handleSend={this.handleSend} chainType={this.props.chainType} disablePrivateTx = {true} /></div>
    }
  ];

  columnsTree = this.columns.map(col => {
    if (!col.editable) {
      return col;
    }
    return {
      ...col,
      onCell: record => ({
        record,
        editable: col.editable,
        dataIndex: col.dataIndex,
        title: col.title,
        handleSave: this.handleSave,
      }),
    };
  });

  handleSave = row => {
    let type = this.props.name[0];
    if (hasSameName(type, row, this.props.addrInfo)) {
      message.warn(intl.get('WanAccount.notSameName'));
    } else {
      this.props.updateName(row, row.wid);
    }
  }

  handleSend = from => {
    let params = this.props.transParams[from];
    let { to, amount, data, chainId, nonce, gasLimit, gasPrice, txType } = params;

    let rawTx = {
      from,
      to,
      value: '0x' + new BigNumber(amount).times(BigNumber(10).pow(18)).toString(16),
      data,
      chainId: chainId,
      nonce: '0x' + nonce.toString(16),
      gasLimit: '0x' + gasLimit.toString(16),
      gasPrice: '0x' + new BigNumber(gasPrice).times(BigNumber(10).pow(9)).toString(16),
      Txtype: txType
    }
    return new Promise((resolve, reject) => {
      this.props.signTransaction(params.path, rawTx, (_err, raw) => {
        wand.request('transaction_raw', { raw, chainType: 'WAN' }, (err, txHash) => {
          if (err) {
            message.warn(intl.get('HwWallet.Accounts.sendTransactionFailed'));
            console.log(err);
            reject(err);
          } else {
            let params = {
              txHash,
              from: from.toLowerCase(),
              srcSCAddrKey: 'WAN',
              srcChainType: 'WAN',
              tokenSymbol: 'WAN',
              ...rawTx
            }
            wand.request('transaction_insertTransToDB', { rawTx: params }, () => {
              this.props.updateTransHistory();
            })
            resolve();
            console.log('Tx Hash:', txHash);
          }
        });
      });
    })
  }

  render () {
    const { name, addresses } = this.props;
    const components = {
      body: {
        cell: EditableCell,
        row: EditableFormRow,
      },
    };

    this.props.language && this.columnsTree.forEach(col => {
      col.title = intl.get(`HwWallet.Accounts.${col.dataIndex}`)
    });

    return (
      <div className="account">
        <Row className="mainBody">
          <Col>
            <Table components={components} rowClassName={() => 'editable-row'} pagination={false} columns={this.columnsTree} dataSource={addresses}></Table>
          </Col>
        </Row>
        <Row className="mainBody">
          <Col>
            <TransHistory name={name}/>
          </Col>
        </Row>
      </div>
    )
  }
}

export default Accounts;
