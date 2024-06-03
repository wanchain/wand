import intl from 'react-intl-universal';
import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { Modal } from 'antd';
import style from './index.less';

@inject(stores => ({
  language: stores.languageIntl.language,
}))

@observer
class HackerAccountVisible extends Component {
  render() {
    const { handleCancel } = this.props;

    return (
      <Modal
        destroyOnClose={true}
        visible={true}
        title={'Cross Chain Transaction'}
        onCancel={handleCancel}
        footer={null}
        className={style['hacker-account-modal']}
        centered={true}
      >
        <div style={{ color: '#DC4D54' }}>Service Unavailable</div>
        <div style={{ color: '#999AA3' }}>This service is currently unavailable.</div>
      </Modal>
    );
  }
}

export default HackerAccountVisible;
