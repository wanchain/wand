import React, { useMemo } from 'react';
import { Tooltip } from 'antd';
import ToolTipIcon from 'static/image/tooltip.png';
import { BigNumber } from 'bignumber.js';

export default function ToolTipCus({
  minOperationFeeLimit,
  maxOperationFeeLimit,
  percentOperationFee,
  isPercentOperationFee,
  wanBridgeDiscounts,
  discountPercentOperationFee,
  symbol
}) {
  const handleClick = () => {
    wand.shell.openExternal('https://docs.wanchain.org')
  }

  const rate = useMemo(() => {
    if (isPercentOperationFee) {
      const ret = new BigNumber(percentOperationFee).multipliedBy(discountPercentOperationFee).multipliedBy(100).toString()
      return `${ret}%`;
    } else {
      return 'N/A'
    }
  }, [isPercentOperationFee, percentOperationFee, discountPercentOperationFee])

  const minOperationFee = useMemo(() => {
    return new BigNumber(minOperationFeeLimit).multipliedBy(discountPercentOperationFee).toString(10);
  }, [minOperationFeeLimit, discountPercentOperationFee])

  const maxOperationFee = useMemo(() => {
    return new BigNumber(maxOperationFeeLimit).multipliedBy(discountPercentOperationFee).toString(10);
  }, [maxOperationFeeLimit, discountPercentOperationFee])

  const Content = () => {
    return (
      <div style={{ backgroundColor: '#3D3E53' }}>
        <p style={{ marginBottom: '15px' }}>There are two types of fees: a Network Fee and a Service Fee. The Network Fee covers the on-chain gas fees incurred by the Wanchain Bridge. The Service Fee is calculated as a percentage of your cross-chain transaction value.</p>
        <p style={{ color: '#F1754B' }}>Discounts for WAN Holders</p>
        <p style={{ marginTop: '10px' }}>WAN holders receive discounts — the more WAN you have, the greater the discount.</p>
        <p style={{ marginTop: '10px' }}>If either your sending or receiving address has enough WAN, including WAN staked or delegated to a Wanchain Bridge Node, you are entitled to a discount on the Service Fee as outlined below:</p>
        <p style={{ marginTop: '10px', color: '#F1754B' }}>Discount Tiers Based on WAN Holdings</p>
        {
          wanBridgeDiscounts.map((i, index) => <p key={index}>{i.amount} WAN | {i.discount}% off</p>)
        }
        <p style={{ marginTop: '10px' }}>
          <span style={{ color: '#F1754B', display: 'block' }}>Your Service Fee Details:</span>
          <span style={{ display: 'block' }}>- Rate: {rate}</span>
          <span style={{ display: 'block' }}>- Minimum: {minOperationFee} {symbol}</span>
          <span style={{ display: 'block' }}>- Maximum: {maxOperationFee} {symbol}</span>
        </p>
        <p style={{ marginTop: '10px' }}>
          <span style={{ display: 'block' }}>To ensure your discount is applied, keep a stable balance of WAN in your address until your cross-chain transaction is complete. Stake WAN to a Wanchain Bridge Node using XStake. For full details, visit <span style={{ color: '#2fbdf4', cursor: 'pointer' }} onClick={handleClick}>Wanchain Online Documentation</span></span>
        </p>
      </div>
    )
  }

  return (
    <Tooltip
      placement="top"
      title={<Content />}
      overlayClassName="ccToolTips"
      overlayStyle={{ borderRadius: '12px', fontSize: '12px' }}
    >
      <img src={ToolTipIcon} alt="1" width={18} />
    </Tooltip>
  );
}
