import React, { Component } from 'react';
import { Table, Select, Radio, message, Icon, Tooltip } from 'antd';
import { observer, inject } from 'mobx-react';
import intl from 'react-intl-universal';

import style from './index.less';
import { WANMAIN, WANTESTNET } from 'utils/settings';
import history from 'static/image/history.png';

const Option = Select.Option;

@inject(stores => ({
  isMainNetwork: stores.session.isMainNetwork,
  addrInfo: stores.wanAddress.addrInfo,
  language: stores.languageIntl.language,
  settings: stores.session.settings,
  historyList: stores.wanAddress.historyList,
  privateHistoryList: stores.wanAddress.privateHistoryList,
  selectedAddr: stores.wanAddress.selectedAddr,
  transColumns: stores.languageIntl.transColumns,
  privateTransColumns: stores.languageIntl.privateTransColumns,
  setCurrPage: page => stores.wanAddress.setCurrPage(page),
  setSelectedAddr: addr => stores.wanAddress.setSelectedAddr(addr)
}))

@observer
class WANTransHistory extends Component {
  constructor(props) {
    super(props);
    this.props.setCurrPage(this.props.name || []);
    this.state = {
      type: 'all'
    }
  }

  onChange = value => {
    this.props.setSelectedAddr(value);
  }

  onTypeChange = (value) => {
    this.setState({
      type: value.target.value
    });
  }

  onClickRow = record => {
    let href = '';
    if (this.state.type === 'all') {
      href = this.props.isMainNetwork ? `${WANMAIN}/tx/${record.key}` : `${WANTESTNET}/tx/${record.key}`;
    } else {
      if (record.txHash === '') {
        message.warn('No txHash');
        return false;
      }
      href = this.props.isMainNetwork ? `${WANMAIN}/tx/${record.txHash}` : `${WANTESTNET}/tx/${record.txHash}`;
    }
    wand.shell.openExternal(href);
  }

  render() {
    const { addrInfo, historyList, privateHistoryList, name } = this.props;
    let addrList = [];
    if (name) {
      name.forEach(val => { addrList = addrList.concat(Object.entries(addrInfo[val]).map(v => ({ address: v[0], name: v[1].name }))) });
    }
    return (
      <div>
        <div className="historyCon" id="wanAddrSelect">
          <img src={history} /><span>{intl.get('TransHistory.transactionHistory')}</span>
          <Select
            showSearch
            allowClear
            style={{ width: 400 }}
            placeholder={intl.get('TransHistory.selectAFromAddress')}
            optionFilterProp="children"
            onChange={this.onChange}
            defaultValue={this.props.selectedAddr ? this.props.selectedAddr[0] : undefined}
            getPopupContainer={() => document.getElementById('wanAddrSelect')}
            filterOption={(input, option) => option.props.children.toLowerCase().indexOf(input.toLowerCase()) >= 0}
          >
            {addrList.map((item, index) => <Option value={item.address} key={index}>{item.name}</Option>)}
          </Select>
          <Radio.Group className={style.typeRadio} onChange={this.onTypeChange} defaultValue={this.state.type}>
            <Radio className={style.allRadio} value={'all'}>{intl.get('TransHistory.all')}
              <Tooltip placement="bottom" title={intl.get('TransHistory.allTooltip')} >
                <Icon type="question-circle" />
              </Tooltip>
            </Radio>
            {
              this.props.settings.long_addresses &&
              <Radio value={'private'}>{intl.get('TransHistory.private')}
                <Tooltip placement="bottom" title={intl.get('TransHistory.privateTooltip')} >
                  <Icon type="question-circle" />
                </Tooltip>
              </Radio>
            }
          </Radio.Group>
        </div>
        <div className="historyRow">
          <Table onRow={record => ({ onClick: this.onClickRow.bind(this, record) })} columns={this.state.type === 'all' ? this.props.transColumns : this.props.privateTransColumns} dataSource={this.state.type === 'all' ? historyList : privateHistoryList} pagination={{ pageSize: 5, hideOnSinglePage: true }} />
        </div>
      </div>
    );
  }
}

export default WANTransHistory;
