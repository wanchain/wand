import { Table, Row, Col } from 'antd';
import intl from 'react-intl-universal';
import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import style from './index.less';
import OsmDelegateClaim from './OsmDelegateClaim'
import DelegateAppendAndExit from './DelegateAppendAndExit';

@inject(stores => ({
  language: stores.languageIntl.language,
  delegatorListData: stores.openstoreman.delegatorListData,
  osmDelegateListColumns: stores.languageIntl.osmDelegateListColumns,
  getStoremanDelegatorInfo: () => stores.openstoreman.getStoremanDelegatorInfo()
}))

@observer
class OsmDelegateList extends Component {
  componentDidMount() {
    this.props.getStoremanDelegatorInfo()
    this.timer = setInterval(() => {
      this.props.getStoremanDelegatorInfo()
    }, 60000)
  }

  componentWillUnmount() {
    clearInterval(this.timer)
  }

  getColumns() {
    const { osmDelegateListColumns } = this.props;
    return [
      {
        ...osmDelegateListColumns[0]
      },
      {
        ...osmDelegateListColumns[1],
      },
      {
        ...osmDelegateListColumns[2],
        render: (text, record) =>
          <div>
            {record.storeman.replace(/^(0x[a-zA-z0-9]{4})[a-zA-z0-9]{32}([a-zA-z0-9]{4})$/, '$1...$2')}
          </div>
      },
      {
        ...osmDelegateListColumns[3],
      },
      {
        ...osmDelegateListColumns[4],
      },
      {
        ...osmDelegateListColumns[5],
      },
      {
        ...osmDelegateListColumns[6],
        render: (text, record) =>
          <div style={{ paddingTop: '5px' }}>
            <Row>
              <Col span={8} align="center"><DelegateAppendAndExit enableButton={record.quited} record={record} modifyType='top-up' /></Col>
              <Col span={8} align="center"><DelegateAppendAndExit enableButton={!(record.canDelegateOut && !record.quited) || record.canDelegateClaim} record={record} modifyType='exit' /></Col>
              <Col span={8} align="center"><OsmDelegateClaim record={record} /></Col>
            </Row>
            <Row>
              <Col span={8} className={style.modifyBtnText} align="center">{intl.get('staking.table.topup')}</Col>
              <Col span={8} className={style.modifyBtnText} align="center">{intl.get('staking.table.exit')}</Col>
              <Col span={8} className={style.modifyBtnText} align="center">{intl.get('staking.table.claim')}</Col>
            </Row>
          </div>
      }
    ];
  }

  render() {
    let scrollObj = this.props.delegatorListData.length ? { x: 1200 } : {};
    return (
      <div className={style['OsmDelegateList']}>
        <Table scroll={scrollObj} columns={this.getColumns()} dataSource={this.props.delegatorListData} pagination={{ pageSize: 5, hideOnSinglePage: true }} />
      </div>
    );
  }
}

export default OsmDelegateList;
