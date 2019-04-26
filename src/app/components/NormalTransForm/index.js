import React, { Component } from 'react';
import { Button, Modal, Form, Input, Icon, Radio, InputNumber } from 'antd';
import AdvancedOptionForm from 'components/AdvancedOptionForm';
import { BigNumber } from 'bignumber.js';

import './index.less';

class NormalTransForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      visible: this.props.visible,
      advancedVisible: false,
      gasPrice: 200,
      gasLimit: 21000,
      nonce: 0,
      advanced: false
    };
    this.advancedOptionForm = Form.create({ name: 'NormalTransForm' })(AdvancedOptionForm);
  }

  onAdvanced = () => {
    this.setState({
      advancedVisible: true,
    });
  }

  handleCancel = () => {
    this.setState({
      advancedVisible: false,
    });
  }

  onCancel = () => {
    this.setState({
      advanced: false
    });
    this.props.onCancel();
  }

  handleSave = (gasPrice, gasLimit, nonce) => {
    this.setState({
      advancedVisible: false,
      gasPrice: gasPrice,
      gasLimit: gasLimit,
      nonce: nonce,
      advanced: true
    });
  }

  handleSend = () => {
    let form = this.props.form;
    form.validateFields((err, values) => {
      if (err) {
        return;
      }
      let params = {
        gasPrice: this.state.gasPrice,
        gasLimit: this.state.gasLimit,
        nonce: this.state.nonce,
        from: this.props.from,
        path: this.props.path,
        to: form.getFieldValue("to"),
        amount: form.getFieldValue('amount')
      }

      this.props.onSend(params);

      form.resetFields();
      this.setState({ advanced: false });
    });
  }

  handleClick = (gasPrice, gasLimit, nonce) => {
    this.setState({ gasPrice: gasPrice, gasLimit: gasLimit, nonce: nonce });
  }

  render() {
    const { loading, form, visible, gasPrice, gasLimit, nonce, minGasPrice, maxGasPrice, from } = this.props;
    const { getFieldDecorator } = form;
    const AdvancedOptionForm = this.advancedOptionForm;
    let averageGasPrice = Math.max(minGasPrice, gasPrice);
    let averageFee = new BigNumber(averageGasPrice).times(gasLimit).div(BigNumber(10).pow(9));
    let minFee = new BigNumber(minGasPrice).times(gasLimit).div(BigNumber(10).pow(9));
    let maxFee = averageFee.times(2);
    let savedFee;

    if (this.state.advanced) {
      savedFee = new BigNumber(Math.max(minGasPrice, this.state.gasPrice)).times(this.state.gasLimit).div(BigNumber(10).pow(9));
    }

    return (
      <div>
        <Modal
          destroyOnClose={true}
          closable={false}
          visible={visible}
          title="Transaction"
          onCancel={this.onCancel}
          onOk={this.handleSend}
          footer={[
            <Button key="submit" type="primary" loading={loading} onClick={this.handleSend}>Send</Button>,
            <Button key="back" className="cancel" onClick={this.onCancel}>Cancel</Button>,
          ]}
        >
          <Form labelCol={{ span: 24 }} wrapperCol={{ span: 24 }} className="transForm">
            <Form.Item label="">
              {getFieldDecorator('from', { initialValue: from }, { rules: [{ required: true, message: 'Address is incorrect' }] })
                (<Input disabled={true} placeholder="Sender Address" prefix={<Icon type="wallet" style={{ color: 'rgba(0,0,0,.25)' }} />} />)}
            </Form.Item>
            <Form.Item label="">
              {getFieldDecorator('to', { rules: [{ required: true, message: 'Address is incorrect' }] })(<Input placeholder="Recipient Address" prefix={<Icon type="wallet" style={{ color: 'rgba(0,0,0,.25)' }} />} />)}
            </Form.Item>
            <Form.Item label="Amount">
              {getFieldDecorator('amount', { rules: [{ required: true, message: 'Amount is incorrect' }] })(<InputNumber placeholder="0" prefix={<Icon type="money-collect" style={{ color: 'rgba(0,0,0,.25)' }} />} />)}
            </Form.Item>
            {
              this.state.advanced ?
                <Form.Item label="Fee">
                  {getFieldDecorator('fee', { initialValue: savedFee.toString(10), rules: [{ required: true, message: "Please select transaction fee" }] })(
                    <Input disabled={true} style={{ color: 'rgba(0,0,0,.25)' }} />
                  )}
                </Form.Item> :
                <Form.Item label="Fee">
                  {getFieldDecorator('fixFee', { rules: [{ required: true, message: "Please select transaction fee" }] })(
                    <Radio.Group>
                      <Radio.Button onClick={() => this.handleClick(minGasPrice, gasLimit, nonce)} value="slow">Slow <br /> {minFee.toString(10)} WAN</Radio.Button>
                      <Radio.Button onClick={() => this.handleClick(averageGasPrice, gasLimit, nonce)} value="average">Average <br /> {averageFee.toString(10)} WAN</Radio.Button>
                      <Radio.Button onClick={() => this.handleClick(maxGasPrice, gasLimit, nonce)} value="fast">Fast <br /> {maxFee.toString(10)} WAN</Radio.Button>
                    </Radio.Group>
                  )}
                </Form.Item>
            }
            <p className="onAdvancedT" onClick={this.onAdvanced}>Advanced Options</p>
          </Form>
        </Modal>
        <AdvancedOptionForm
          visible={this.state.advancedVisible}
          minGasPrice={minGasPrice}
          gasPrice={this.state.gasPrice}
          gasLimit={this.state.gasLimit}
          nonce={this.state.nonce}
          onCancel={this.handleCancel}
          onSave={this.handleSave}
        />
      </div>
    );
  }
}

export default NormalTransForm;



