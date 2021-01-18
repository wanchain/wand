import intl from 'react-intl-universal';
import { BigNumber } from 'bignumber.js';
import React, { useState, useContext, useMemo } from 'react';
import { observer, MobXProviderContext } from 'mobx-react';
import { Button, Modal, Form, Input, Icon, Checkbox, message, Spin } from 'antd';

import style from '../index.less';
import { checkAmountUnit, checkXRPAddr } from 'utils/helper';
import ConfirmForm from 'components/NormalTransForm/XRPNormalTrans/XRPConfirmForm.js';

const MINBALANCE = '20';
const DEFAULTFEE = '0.000012';
const Confirm = Form.create({ name: 'NormalTransForm' })(ConfirmForm);

const XRPNormalTransForm = observer(({ spin, from, form, onCancel, balance, onSend }) => {
  const { languageIntl, session: { reinput_pwd }, sendTransParams: { updateXRPTransParams } } = useContext(MobXProviderContext)
  const [disabledAmount, setDisabledAmount] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const { getFieldDecorator } = form;

  const handleNext = () => {
    form.validateFields(err => {
      if (err) {
        console.log('handleNext', err);
        return;
      };
      let { pwd, amount, to, tag } = form.getFieldsValue(['pwd', 'amount', 'to', 'tag']);
      if (new BigNumber(balance).lt(20)) {
        message.warn(intl.get('NormalTransForm.overBalance'));
        return;
      }
      if (reinput_pwd) {
        if (!pwd) {
          message.warn(intl.get('Backup.invalidPassword'));
          return;
        }
        wand.request('phrase_checkPwd', { pwd }, err => {
          if (err) {
            message.warn(intl.get('Backup.invalidPassword'));
          } else {
            updateXRPTransParams({ to, value: amount, tag });
            setConfirmVisible(true);
          }
        })
      } else {
        updateXRPTransParams({ to, value: amount, tag })
        setConfirmVisible(true);
      }
    });
  }

  const useAvailableBalance = useMemo(() => {
    let tmp = new BigNumber(balance).minus(DEFAULTFEE).minus(MINBALANCE);
    return tmp.lt(0) ? '0' : tmp.toString(10);
  }, [balance])

  const checkToXRPAddr = (rule, value, callback) => {
    if (value) {
      checkXRPAddr(value).then(ret => {
        ret ? callback() : callback(rule.message)
      }).catch(err => {
        console.log('checkToXRPAddrErr:', err);
        callback(rule.message);
      })
    } else {
      callback(rule.message);
    }
  }

  const checkAmount = (rule, value, callback) => {
    if (value === undefined) {
      callback(rule.message);
      return;
    }
    if (new BigNumber(value).lte(0) || !checkAmountUnit(6, value)) {
      callback(rule.message);
      return;
    }
    if (new BigNumber(useAvailableBalance).minus(value).lt(0)) {
      callback(rule.message);
      return;
    }
    callback();
  }

  const sendAllAmount = e => {
    if (e.target.checked) {
      form.setFieldsValue({
        amount: new BigNumber(useAvailableBalance).toString(10)
      });
      setDisabledAmount(true)
    } else {
      form.setFieldsValue({ amount: 0 });
      setDisabledAmount(false)
    }
  }

  const checkDestinationTag = (rule, value, callback) => {
    if (value && !Number.isInteger(Number(value))) {
      callback(rule.message);
      return;
    }
    callback();
  }

  const handleConfirmCancel = () => {
    setConfirmVisible(false);
  }

  return (
    <React.Fragment>
      <Modal
        visible
        wrapClassName={style.ETHNormalTransFormModal}
        destroyOnClose={true}
        closable={false}
        title={intl.get('NormalTransForm.transaction')}
        onCancel={onCancel}
        footer={[
          <Button key="back" className="cancel" onClick={onCancel}>{intl.get('Common.cancel')}</Button>,
          <Button disabled={spin} key="submit" type="primary" onClick={handleNext}>{intl.get('Common.next')}</Button>,
        ]}
      >
        <Spin spinning={spin} size="large">
          <Form labelCol={{ span: 24 }} wrapperCol={{ span: 24 }} className={style.transForm}>
            <Form.Item label={intl.get('Common.from')}>
              {getFieldDecorator('from', { initialValue: from })
                (<Input disabled={true} prefix={<Icon type="wallet" className="colorInput" />} />)}
            </Form.Item>
            <Form.Item label={intl.get('Common.balance')}>
              {getFieldDecorator('balance', { initialValue: balance })
                (<Input disabled={true} prefix={<Icon type="wallet" className="colorInput" />} />)}
            </Form.Item>
            <Form.Item label={intl.get('NormalTransForm.to')}>
              {getFieldDecorator('to', { rules: [{ required: true, message: intl.get('NormalTransForm.addressIsIncorrect'), validator: checkToXRPAddr }] })
                (<Input placeholder={intl.get('NormalTransForm.recipientAddress')} prefix={<Icon type="wallet" className="colorInput" />} />)}
            </Form.Item>
              <Form.Item label={intl.get('NormalTransForm.fee')}>
                {getFieldDecorator('fee', { initialValue: DEFAULTFEE })
                  (<Input disabled={true} prefix={<Icon type="wallet" className="colorInput" />} />)}
              </Form.Item>
            <Form.Item label={intl.get('Common.amount')}>
              {getFieldDecorator('amount', { rules: [{ required: true, message: intl.get('NormalTransForm.amountIsIncorrect'), validator: checkAmount }] })
                (<Input disabled={disabledAmount} min={0} placeholder={intl.get('Common.availableBalance', { availableBalance: useAvailableBalance })} prefix={<Icon type="credit-card" className="colorInput" />} />)}
              <Checkbox onChange={sendAllAmount}>{intl.get('NormalTransForm.sendAll')}</Checkbox>
            </Form.Item>
            <Form.Item label={intl.get('Xrp.destinationTag')}>
              {getFieldDecorator('tag', { rules: [{ message: intl.get('NormalTransForm.amountIsIncorrect'), validator: checkDestinationTag }] })
                (<Input disabled={disabledAmount} min={0} placeholder='0' prefix={<Icon type="credit-card" className="colorInput" />} />)}
            </Form.Item>
            {
              reinput_pwd &&
              <Form.Item label={intl.get('NormalTransForm.password')}>
                {getFieldDecorator('pwd', { rules: [{ required: true, message: intl.get('NormalTransForm.pwdIsIncorrect') }] })
                (<Input.Password placeholder={intl.get('Backup.enterPassword')} prefix={<Icon type="lock" className="colorInput" />} />)}
              </Form.Item>
            }
          </Form>
        </Spin>
      </Modal>
      {
        confirmVisible &&
        <Confirm visible={true} onCancel={handleConfirmCancel} sendTrans={onSend} from={from} fee={DEFAULTFEE}/>
      }
    </React.Fragment>
  )
})

export default XRPNormalTransForm;
