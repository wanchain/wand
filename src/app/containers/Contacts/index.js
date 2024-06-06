import React, { Component } from 'react';
import { Table, message, Tabs, Tooltip, Icon, Modal } from 'antd';
import { observer, inject } from 'mobx-react';
import intl from 'react-intl-universal';
import { EditableFormRow, EditableCell } from 'components/Rename';
import AddContacts from 'components/AddContacts';
import AddPrivateContacts from 'components/AddContacts/AddPrivateContacts';
import style from './index.less';

import wan from 'static/image/wan.png';
import eth from 'static/image/eth.png';
import btc from 'static/image/btc.png';
import xrp from 'static/image/xrp.png';
import eos from 'static/image/eos.png';
import bsc from 'static/image/bnb.png';
import { chain } from 'lodash';

const { TabPane } = Tabs;

@inject(stores => ({
  language: stores.languageIntl.language,
  settingContactsColumns: stores.languageIntl.settingContactsColumns,
  normalData: stores.contacts.contacts.normalAddr,
  privateData: stores.contacts.contacts.privateAddr,
  contacts: stores.contacts.contacts,
  settings: stores.session.settings,
  addAddress: (chain, addr, val) => stores.contacts.addAddress(chain, addr, val),
  addPrivateAddress: (addr, val) => stores.contacts.addPrivateAddress(addr, val),
  delAddress: (chain, addr) => stores.contacts.delAddress(chain, addr),
  delPrivateAddress: (addr) => stores.contacts.delPrivateAddress(addr),
}))

@observer
class Contacts extends Component {
  constructor(props) {
    super(props);
    this.state = {
      config: [],
      type: 'normalAddr',
      rows: [],
      privateRows: [],
      addInfo: {},
      delInfo: {}
    }
  }

  componentDidMount() {
    this.setState({
      rows: this.getRowsData(this.props),
      privateRows: this.getPrivateRowsData(this.props)
    });
  }

  getImg = chain => {
    switch (chain) {
      case 'Wanchain':
        return wan;
      case 'Ethereum':
        return eth;
      case 'Bitcoin':
        return btc;
      case 'XRPL':
        return xrp;
      case 'EOS':
        return eos;
      case 'BSC':
        return bsc;
      default:
        return wan;
    }
  }

  getRowsData = (props) => {
    return this.processRowData(props.normalData);
  }

  getPrivateRowsData = props => {
    return this.processRowData(props.privateData);
  }

  processRowData = rows => {
    rows = Object.values(rows).filter(v => Object.keys(v).length);
    let rowData = [];
    rows.map(v => {
      rowData = [].concat(rowData, Object.values(v));
    });
    return rowData;
  }

  handleCreate = (chainSymbol, address, name, opts) => {
    if (this.state.type === 'normalAddr') {
      const obj = {
        name,
        address,
        chainSymbol
      };
      if (chainSymbol === 'XRPL') {
        Object.assign(obj, { tag: opts })
      } else if (chainSymbol === 'EOS') {
        Object.assign(obj, { memo: opts })
      }
      this.props.addAddress(chainSymbol, address, obj).then(() => {
        this.setState({ rows: this.getRowsData(this.props) });
      })
    } else {
      this.props.addPrivateAddress(address, {
        name,
        address,
        chainSymbol
      }).then(() => {
        this.setState({ privateRows: this.getPrivateRowsData(this.props) });
      })
    }
  }

  handelDeleteModal = () => {
    this.setState({
      showDeleteModal: !this.state.showDeleteModal
    })
  }

  handelDelInfo = item => {
    this.setState({
      delInfo: item
    })
  }

  handleDelete = () => {
    const { chainSymbol, address } = this.state.delInfo;
    if (this.state.type === 'normalAddr') {
      this.props.delAddress(chainSymbol, address).then(() => {
        this.setState({ rows: this.getRowsData(this.props) });
        this.handelDeleteModal();
      })
    } else {
      this.props.delPrivateAddress(address).then(() => {
        this.setState({ privateRows: this.getPrivateRowsData(this.props) });
        this.handelDeleteModal();
      })
    }
  }

  handleUpdateName = row => {
    const { chainSymbol, address, name, tag, memo } = row;
    if (this.state.type === 'normalAddr') {
      const obj = {
        name,
        address,
        chainSymbol
      };
      if (chainSymbol === 'XRPL') {
        Object.assign(obj, { tag })
      } else if (chainSymbol === 'EOS') {
        Object.assign(obj, { memo })
      }
      this.props.addAddress(chainSymbol, address, obj).then(() => {
        this.setState({ rows: this.getRowsData(this.props) });
      })
    } else {
      this.props.addPrivateAddress(address, {
        chainSymbol,
        address,
        name
      }).then(() => {
        this.setState({ privateRows: this.getPrivateRowsData(this.props) });
      })
    }
  }

  colums = [
    {
      title: intl.get('DApp.chainCol'),
      dataIndex: 'chainSymbol',
      key: 'chainSymbol',
      width: '20%',
      align: 'center',
      render: (value, row, index) => {
        const obj = {
          children: (
            <div className={style['chain-symbol']}>
              <img className={style['chain-icon']} src={this.getImg(value)} />
              <p className={style['chain-name']}>{value}</p>
            </div>
          ),
          props: {}
        };
        const data = this.props.normalData;
        const len = Object.keys(data[value]).length;
        if (index > 0 && this.state.rows[index - 1].chainSymbol === this.state.rows[index].chainSymbol) {
          obj.props.rowSpan = 0;
        } else {
          obj.props.rowSpan = len;
        }
        return obj;
      }
    },
    {
      title: intl.get('DApp.nameCol'),
      dataIndex: 'name',
      key: 'name',
      editable: true,
      width: '20%',
    },
    {
      title: intl.get('DApp.addressCol'),
      dataIndex: 'address',
      key: 'address',
      width: '55%',
      render: (text, record) =>
        <div className="addrText">
          <p className={style['address']}>{text}</p>
          <Tooltip placement="bottom" title={intl.get('Common.copy')}><Icon type="copy" onClick={e => this.copy2Clipboard(record.address, e)} /></Tooltip>
          <Tooltip placement="bottom" title={intl.get('Common.delete')}><Icon type="delete" onClick={e => {
            this.handelDeleteModal();
            this.handelDelInfo(record);
          }} /></Tooltip>
          {
            record.chainSymbol === 'XRPL' && record.tag &&
            <p><span style={{ color: '#01ECF7' }}>Tag </span>： { record.tag }</p>
          }
          {
            record.chainSymbol === 'EOS' && record.memo &&
            <p><span style={{ color: '#01ECF7' }}>Memo </span>： { record.memo }</p>
          }
        </div>
    },
    {
      title: '',
      dataIndex: 'blank',
      key: 'blank',
      width: '5%',
    },
  ]

  columsTrees = this.colums.map((col) => {
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
        handleSave: this.handleUpdateName,
      }),
    };
  });

  privateColums = [
    {
      title: intl.get('DApp.chainCol'),
      dataIndex: 'chainSymbol',
      key: 'chainSymbol',
      width: '20%',
      align: 'center',
      render: (value, row, index) => {
        const obj = {
          children: (
            <div className={style['chain-symbol']}>
              <img className={style['chain-icon']} src={this.getImg(value)} />
              <p className={style['chain-name']}>{value}</p>
            </div>
          ),
          props: {}
        };
        const data = this.props.privateData;
        const len = Object.keys(data[value]).length;
        if (index > 0 && this.state.privateRows[index - 1].chainSymbol === this.state.privateRows[index].chainSymbol) {
          obj.props.rowSpan = 0;
        } else {
          obj.props.rowSpan = len;
        }
        return obj;
      }
    },
    {
      title: intl.get('DApp.nameCol'),
      dataIndex: 'name',
      key: 'name',
      editable: true,
      width: '20%',
    },
    {
      title: intl.get('DApp.addressCol'),
      dataIndex: 'address',
      key: 'address',
      width: '55%',
      render: (text, record) =>
        <div className="addrText">
          <p className={style['address']}>{text}</p>
          <Tooltip placement="bottom" title={intl.get('Common.copy')}><Icon type="copy" onClick={e => this.copy2Clipboard(record.address, e)} /></Tooltip>
          <Tooltip placement="bottom" title={intl.get('Common.delete')}><Icon type="delete" onClick={e => {
            this.handelDeleteModal();
            this.handelDelInfo(record);
          }} /></Tooltip>
        </div>
    },
    {
      title: '',
      dataIndex: 'blank',
      key: 'blank',
      width: '5%',
    },
  ]

  privateColumsTrees = this.privateColums.map((col) => {
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
        handleSave: this.handleUpdateName,
      }),
    };
  });

  copy2Clipboard = addr => {
    wand.writeText(addr);
    message.success(intl.get('CopyAndQrcode.copySuccessfully'));
  }

  handleChangeTab = e => {
    this.setState({
      type: e
    })
  }

  getRowClassName = (record, index, list) => {
    let className = 'editable-row';
    className = `${className} ${style['border-line']}`;
    return className
  }

  render() {
    const {
      showDeleteModal,
      delInfo,
      rows,
      privateRows,
      type
    } = this.state;
    const components = {
      body: {
        cell: EditableCell,
        row: EditableFormRow,
      },
    };

    for (let i = 0; i < this.colums.length; i++) {
      if (this.colums[i].key !== 'blank') {
        this.colums[i].title = this.props.settingContactsColumns[i].title;
        this.privateColums[i].title = this.props.settingContactsColumns[i].title;
      } else {
        this.colums[i].title = <AddContacts handleSave={this.handleCreate} />
        this.privateColums[i].title = <AddPrivateContacts handleSave={this.handleCreate} />
      }
    }

    return (
      <div className={`${style['settings_network']} ${style['contacts']}`}>
        <Tabs onChange={this.handleChangeTab}>
          <TabPane tab={intl.get('AddressBook.normalAddrTab')} key="normalAddr">
            <Table
              pagination={false}
              components={components}
              columns={this.columsTrees}
              rowClassName={(record, index) => this.getRowClassName(record, index, rows)}
              rowKey={record => record.chainSymbol + record.name + record.address}
              dataSource={rows}
            />
          </TabPane>
          {
            this.props.settings.long_addresses &&
              <TabPane tab={intl.get('AddressBook.privateAddrTab')} key="privateAddr">
                <Table
                  pagination={false}
                  components={components}
                  columns={this.privateColumsTrees}
                  rowClassName={(record, index) => this.getRowClassName(record, index, privateRows)}
                  rowKey={record => record.chainSymbol + record.name + record.address}
                  dataSource={privateRows}
                />
              </TabPane>
          }
        </Tabs>
        {
          showDeleteModal &&
          <Modal
            className='delModal'
            destroyOnClose={true}
            title={intl.get('Config.deleteConfirm')}
            visible={showDeleteModal}
            onOk={() => this.handleDelete()}
            onCancel={() => this.handelDeleteModal()}
            closable={false}
            okText={intl.get('Common.ok')}
            cancelText={intl.get('Common.cancel')}
            bodyStyle={{ textAlign: 'center' }}
          >
            <div className={style.deleteMsg}>
              <span className={style.deleteConfirmMsg}>{intl.get('CopyAndQrcode.confirmText')} : </span>
              <span className={style.symbolSty}>{delInfo.name}</span>
            </div>
          </Modal>
        }
      </div>
    );
  }
}

export default Contacts;
