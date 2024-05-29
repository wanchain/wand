import _ from 'lodash';
import Identicon from 'identicon.js';
import intl from 'react-intl-universal';
import { BigNumber } from 'bignumber.js';
import { observable, action, computed, runInAction, toJS, makeObservable } from 'mobx';

import wanAddress from './wanAddress';
import { getInfoByAddress, checkAddrType, getValueByAddrInfo } from 'utils/helper';
import { hexCharCodeToStr, fromWei, timeFormat, formatNum, floorFun, wandWrapper, toWeiData } from 'utils/support';
import { OSMSTAKEACT, WANPATH, OSMDELEGATIONACT, WALLETID } from 'utils/settings'
import languageIntl from './languageIntl';

const INIT_GROUPID = '0x0000000000000000000000000000000000000000000000000000000000000000';
const storemanGroupStatus = ['None', 'Initializing', 'Selecting', 'Failed', 'Selected', 'Ready', 'Quitting', 'Quitted'];

class OpenStoreman {
  @observable storemanGroupList = [];

  @observable storemanListInfo = [];

  @observable missingGroupListInfo = [];

  @observable storemanDelegatorInfo =[];

  @observable storemanMemberList = [];

  @observable storemanConf = {};

  @observable rewardRatio = '0';

  @observable rewardRatioReady = false;

  @observable selectedStoremanInfo = {};

  @observable storemanStakeTotalIncentive = [];

  @observable storemanDelegatorTotalIncentive = [];

  @observable storemanListInfoInfoReady = false;

  @observable storemanDelegatorInfoInfoReady = false;

  @observable storemanStakeTotalIncentiveInfoReady = false;

  @observable storemanDelegatorTotalIncentiveInfoReady = false;

  constructor() {
    makeObservable(this);
  }

  @computed get groupListData () {
    let data = [];
    this.storemanGroupList.filter(v => v.canStakeIn).forEach((item, index) => {
      data.push({
        key: index,
        minStakeIn: fromWei(item.minStakeIn),
        groupId: item.groupId,
        groupIdName: hexCharCodeToStr(item.groupId),
        startTime: timeFormat(item.registerTime),
        endTime: timeFormat(item.endRegisterTime),
        crosschain: `${item.chain1[2]} <-> ${item.chain2[2]}`,
        delegationFee: item.delegateFee / 100 + '%',
        action: 'Register',
      })
    });
    return data;
  }

  @computed get storemanListData () {
    let data = [];
    try {
      this.storemanListInfo.forEach((item, index) => {
        let accountInfo = getInfoByAddress(item.from, ['name', 'path'], wanAddress.addrInfo);
        let groupInfo = this.storemanGroupList.find(v => v.groupId === item.groupId);
        if (!groupInfo) {
          groupInfo = this.missingGroupListInfo.find(v => v.groupId === item.groupId);
        }
        let nextGroupInfo = this.storemanGroupList.find(v => v.groupId === item.nextGroupId)
        if (accountInfo && groupInfo && accountInfo.type) {
          accountInfo.path = accountInfo.type !== 'normal' ? getValueByAddrInfo(accountInfo.addr, 'path', wanAddress.addrInfo) : `${WANPATH}${accountInfo.path}`;
          accountInfo.walletID = accountInfo.type !== 'normal' ? WALLETID[accountInfo.type.toUpperCase()] : WALLETID.NATIVE;
          let rank;
          let status = storemanGroupStatus[groupInfo.status];
          let nextRank = this.selectedStoremanInfo[item.nextGroupId];
          if (item.nextGroupId !== INIT_GROUPID && nextRank && nextGroupInfo) {
            status = storemanGroupStatus[nextGroupInfo.status];
            let index = nextRank.findIndex(v => v.toLowerCase() === item.wkAddr.toLowerCase());
            rank = [index === -1 ? index : index + 1, nextRank.length];
          } else {
            rank = [item.rank, item.selectedCount];
          }
          if (status !== 'Selecting' && rank[0] !== undefined && rank[0].toString() === '-1') {
            status = 'Unselected';
          }
          let unclaimedData = item.canStakeClaim ? new BigNumber(fromWei(item.incentive)).plus(fromWei(item.deposit)).toString(10) : fromWei(item.incentive);
          data.push({
            rank,
            key: index,
            quited: item.quited,
            account: accountInfo.name,
            myAddress: accountInfo,
            stake: fromWei(item.deposit),
            groupId: item.groupId,
            groupIdName: hexCharCodeToStr(item.groupId),
            nextGroupIdName: item.nextGroupId === INIT_GROUPID ? null : hexCharCodeToStr(item.nextGroupId),
            slash: item.slashedCount,
            activity: item.activity,
            reward: floorFun(fromWei(item.incentive), 2),
            unclaimed: floorFun(unclaimedData, 2),
            unclaimedData,
            crosschain: `${groupInfo.chain1[2]} <-> ${groupInfo.chain2[2]}`,
            status: languageIntl.language && intl.get(`Storeman.${status.toLowerCase()}`),
            oriStatus: status.toLowerCase(),
            wkAddr: item.wkAddr,
            canStakeOut: item.canStakeOut,
            canStakeClaim: item.canStakeClaim,
            minStakeIn: fromWei(groupInfo.minStakeIn),
          })
        }
      });
    } catch (error) {
      console.log('get storemanListData', error);
    }
    return data;
  }

  @computed get delegatorListData () {
    let data = [];
    this.storemanDelegatorInfo.forEach((item, index) => {
      let accountInfo = getInfoByAddress(item.from, ['name', 'path'], wanAddress.addrInfo);
      let groupInfo = this.storemanGroupList.find(i => i.groupId === item.groupId);
      if (accountInfo && accountInfo.type) {
        let minDelegateIn = groupInfo ? groupInfo.minDelegateIn : '0';
        accountInfo.path = accountInfo.type !== 'normal' ? getValueByAddrInfo(accountInfo.addr, 'path', wanAddress.addrInfo) : `${WANPATH}${accountInfo.path}`;
        accountInfo.walletID = accountInfo.type !== 'normal' ? WALLETID[accountInfo.type.toUpperCase()] : WALLETID.NATIVE;
        let unclaimedData = item.canDelegateClaim ? new BigNumber(fromWei(item.incentive)).plus(fromWei(item.deposit)).toString(10) : fromWei(item.incentive);
        data.push({
          key: index,
          account: accountInfo.name,
          myAddress: accountInfo,
          stake: floorFun(fromWei(item.deposit)),
          groupId: item.groupId,
          groupIdName: hexCharCodeToStr(item.groupId),
          reward: floorFun(fromWei(item.incentive), 2),
          unclaimed: floorFun(unclaimedData, 2),
          unclaimedData,
          storeman: item.wkAddr,
          crosschain: `${item.chain1[2]} <-> ${item.chain2[2]}`,
          wkAddr: item.wkAddr,
          quited: item.quited,
          canDelegateClaim: item.canDelegateClaim,
          canDelegateOut: item.canDelegateOut,
          deposit: item.wkStake.deposit,
          partnerDeposit: item.wkStake.partnerDeposit,
          delegateDeposit: item.wkStake.delegateDeposit,
          minDelegateIn: fromWei(minDelegateIn),
        })
      }
    });
    return data;
  }

  @computed get storemanHistoryList () {
    let historyList = [];
    let histories = wanAddress.transHistory;
    let addrList = Object.keys(Object.assign({}, wanAddress.addrInfo.normal, wanAddress.addrInfo.ledger, wanAddress.addrInfo.trezor));
    Object.keys(wanAddress.transHistory).forEach(item => {
      if (addrList.includes(histories[item].from) && OSMSTAKEACT.includes(histories[item].annotate)) {
        let type = checkAddrType(histories[item].from, wanAddress.addrInfo);
        let { status, annotate } = histories[item];
        historyList.push({
          key: item,
          storeman: histories[item].wkAddr,
          sendTime: histories[item].sendTime,
          time: timeFormat(histories[item].sendTime),
          from: wanAddress.addrInfo[type][histories[item].from].name,
          fromAddress: histories[item].from,
          stakeAmount: histories[item].withdrawValue ? formatNum(floorFun(histories[item].withdrawValue), 2) : formatNum(floorFun(fromWei(histories[item].value), 2)),
          annotate: languageIntl.language && OSMSTAKEACT.includes(annotate) ? intl.get(`TransHistory.${annotate}`) : annotate,
          status: languageIntl.language && ['Failed', 'Success'].includes(status) ? intl.get(`TransHistory.${status.toLowerCase()}`) : intl.get('TransHistory.pending'),
        });
      }
    });

    return historyList.sort((a, b) => b.sendTime - a.sendTime);
  }

  @computed get delegationHistoryList () {
    let historyList = [];
    let histories = wanAddress.transHistory;
    let addrList = Object.keys(Object.assign({}, wanAddress.addrInfo.normal, wanAddress.addrInfo.ledger, wanAddress.addrInfo.trezor));
    Object.keys(wanAddress.transHistory).forEach(item => {
      if (addrList.includes(histories[item].from) && OSMDELEGATIONACT.includes(histories[item].annotate)) {
        let type = checkAddrType(histories[item].from, wanAddress.addrInfo);
        let { status, annotate } = histories[item];
        historyList.push({
          key: item,
          storeman: histories[item].wkAddr,
          sendTime: histories[item].sendTime,
          time: timeFormat(histories[item].sendTime),
          from: wanAddress.addrInfo[type][histories[item].from].name,
          fromAddress: histories[item].from,
          stakeAmount: histories[item].withdrawValue ? formatNum(floorFun(histories[item].withdrawValue, 2)) : formatNum(floorFun(fromWei(histories[item].value), 2)),
          annotate: languageIntl.language && OSMDELEGATIONACT.includes(annotate) ? intl.get(`TransHistory.${annotate}`) : annotate,
          status: languageIntl.language && ['Failed', 'Success'].includes(status) ? intl.get(`TransHistory.${status.toLowerCase()}`) : intl.get('TransHistory.pending'),
        });
      }
    });

    return historyList.sort((a, b) => b.sendTime - a.sendTime);
  }

  @computed get groupChainInfo () {
    return [...new Set(this.storemanGroupList.map(v => `${v.chain1[2]} <-> ${v.chain2[2]}`))];
  }

  @computed get storemanCards () {
    let cardsList = {
      myStake: ['N/A', false],
      delegationStake: ['N/A', false],
      reward: ['N/A', false],
      avgReward: ['N/A', false],
    };
    let unexReward = fromWei(this.storemanListInfo.reduce((prev, curr) => new BigNumber(prev).plus(curr.incentive).toString(10), 0));
    cardsList.myStake[0] = floorFun(fromWei(this.storemanListInfo.reduce((prev, curr) => new BigNumber(prev).plus(curr.deposit).toString(10), 0)), 2);
    cardsList.myStake[1] = this.storemanListInfoInfoReady;
    cardsList.delegationStake[0] = floorFun(fromWei(this.storemanListInfo.reduce((prev, curr) => new BigNumber(prev).plus(curr.delegateDeposit).toString(10), 0)), 2);
    cardsList.delegationStake[1] = this.storemanListInfoInfoReady;
    cardsList.reward[0] = floorFun(new BigNumber(unexReward).toString(10));
    cardsList.reward[1] = this.storemanListInfoInfoReady;
    cardsList.avgReward[0] = this.rewardRatio;
    cardsList.avgReward[1] = this.rewardRatioReady;

    return cardsList;
  }

  @computed get delegationCards () {
    let cardsList = {
      myStake: ['N/A', false],
      myReward: ['N/A', false],
      withdrawableAmount: ['N/A', false],
      avgReward: ['N/A', false],
    };
    let unexReward = fromWei(this.storemanDelegatorInfo.reduce((prev, curr) => new BigNumber(prev).plus(curr.incentive).toString(10), 0));
    let claimableAmount = fromWei(this.delegatorListData.reduce((prev, curr) => new BigNumber(prev).plus(toWeiData(curr.unclaimedData)).toString(10), 0));
    cardsList.myStake[0] = floorFun(fromWei(this.storemanDelegatorInfo.reduce((prev, curr) => new BigNumber(prev).plus(curr.deposit).toString(10), 0)), 2);
    cardsList.myStake[1] = this.storemanDelegatorInfoInfoReady;
    cardsList.myReward[0] = floorFun(new BigNumber(unexReward).toString(10));
    cardsList.myReward[1] = this.storemanDelegatorInfoInfoReady;
    cardsList.withdrawableAmount[0] = floorFun(claimableAmount);
    cardsList.withdrawableAmount[1] = this.storemanDelegatorInfoInfoReady;
    cardsList.avgReward[0] = this.rewardRatio;
    cardsList.avgReward[1] = this.rewardRatioReady;

    return cardsList;
  }

  @action async getOpenStoremanGroupList () {
    try {
      let ret = await wandWrapper('storeman_getOpenStoremanGroupList');
      runInAction(() => {
        this.storemanGroupList = ret;
      })
    } catch (err) {
      console.log(`action_getOpenStoremanGroupList: ${err.message}`);
    }
  }

  @action async getStoremanStakeInfo () {
    let { normal, ledger, trezor } = wanAddress.addrInfo;
    let sender = Object.keys(Object.assign({}, normal, ledger, trezor));
    try {
      let ret = await wandWrapper('storeman_getStoremanStakeInfo', { sender });
      this.storemanListInfo = ret;
      this.storemanListInfoInfoReady = true;
      // Update missingGroupInfo
      let missingGroup = ret.map(v => v.groupId);
      if (missingGroup.length) {
        let oldGroupInfo = await wandWrapper('storeman_getMultiStoremanGroupInfo', { groupId: missingGroup })
        runInAction(() => {
          this.missingGroupListInfo = oldGroupInfo;
        })
      }

      // Update selectedStoremanInfo
      let nextGroupIdArr = new Set(ret.map(v => v.nextGroupId).filter(v => v !== INIT_GROUPID));
      nextGroupIdArr.forEach(async groupId => {
        let selectedStoreman = await wandWrapper('storeman_getSelectedStoreman', { groupId })
        runInAction(() => {
          this.selectedStoremanInfo[groupId] = selectedStoreman;
        })
      });
    } catch (err) {
      console.log(`action_getStoremanStakeInfo: ${err.message}`);
    }
  }

  @action async getStoremanDelegatorInfo () {
    let { normal, ledger, trezor } = wanAddress.addrInfo;
    let sender = Object.keys(Object.assign({}, normal, ledger, trezor));

    try {
      let ret = await wandWrapper('storeman_getStoremanDelegatorInfo', { sender });
      runInAction(() => {
        this.storemanDelegatorInfo = ret;
        this.storemanDelegatorInfoInfoReady = true;
      })
    } catch (err) {
      console.log(`action_getStoremanDelegatorInfo: ${err.message}`);
    }
  }

  @action async getStoremanMemberList () {
    Promise.all([wandWrapper('storeman_getOpenStoremanGroupList'), wandWrapper('storeman_getStoremanConf')]).then(val => {
      let [ret, ret1] = val;
      runInAction(() => {
        this.storemanGroupList = ret;
        this.storemanConf = ret1;
      })
      let groupMemberId = ret.filter(i => i.status >= 4).map(v => v.groupId);
      let groupCandidatesMemberId = ret.filter(i => i.status < 4).map(v => v.groupId);
      return Promise.all([wandWrapper('storeman_getStoremanGroupMember', { groupId: groupMemberId }), wandWrapper('storeman_getStoremanCandidates', { groupId: groupCandidatesMemberId })])
    }).then(ret => {
      runInAction(() => {
        // Re-Duplicates by wkAddr
        let temp = _.unionBy(ret.flat(), 'wkAddr');
        temp = temp.filter(v => {
          let ret = this.storemanGroupList.find(j => [v.groupId, v.nextGroupId].includes(j.groupId));
          return !v.isWhite && !!ret
        });
        temp.forEach(item => {
          let temp = this.storemanGroupList.find(v => [item.groupId, item.nextGroupId].includes(v.groupId));
          item.chain1 = temp.chain1;
          item.chain2 = temp.chain2;
          item.nameShowing = item.name ? item.name : item.wkAddr;
          item.icon = item.iconData ? `data:image/${item.iconType};base64, ${item.iconData}` : ('data:image/png;base64,' + new Identicon(item.wkAddr).toString());
          item.quota = (new BigNumber(fromWei(item.deposit))).plus(fromWei(item.partnerDeposit || '0')).multipliedBy(this.storemanConf.delegationMulti || '1').minus(fromWei(item.delegateDeposit || '0')).toString(10)
        })
        temp.sort((a, b) => b.quota - a.quota)
        this.storemanMemberList = temp;
      })
    }).catch(err => console.log(err))
  }

  @action async getStoremanStakeTotalIncentive () {
    let { normal, ledger, trezor } = wanAddress.addrInfo;
    let sender = Object.keys(Object.assign({}, normal, ledger, trezor));
    try {
      let ret = await wandWrapper('storeman_getStoremanStakeTotalIncentive', { sender });
      ret.sort((a, b) => a - b)
      runInAction(() => {
        this.storemanStakeTotalIncentive = ret;
        this.storemanStakeTotalIncentiveInfoReady = true;
      })
    } catch (err) {
      console.log(`action_getStoremanStakeTotalIncentive: ${err.message}`);
    }
  }

  @action async getStoremanDelegatorTotalIncentive () {
    let { normal, ledger, trezor } = wanAddress.addrInfo;
    let sender = Object.keys(Object.assign({}, normal, ledger, trezor));
    try {
      let ret = await wandWrapper('storeman_getStoremanDelegatorTotalIncentive', { sender });
      ret.sort((a, b) => a - b)
      runInAction(() => {
        this.storemanDelegatorTotalIncentive = ret;
        this.storemanDelegatorTotalIncentiveInfoReady = true;
      })
    } catch (err) {
      console.log(`action_getStoremanDelegatorTotalIncentive: ${err.message}`);
    }
  }

  @action async getStoremanConf () {
    if (!Object.keys(this.storemanConf).length) {
      try {
        let ret = await wandWrapper('storeman_getStoremanConf');
        runInAction(() => {
          this.storemanConf = ret;
        })
      } catch (err) {
        console.log(`action_getStoremanConf: ${err.message}`);
      }
    }
  }

  @action async getRewardRatio () {
    try {
      let ret = await wandWrapper('storeman_getRewardRatio');
      runInAction(() => {
        this.rewardRatio = new BigNumber(ret).multipliedBy(100).toString(10) + '%';
        this.rewardRatioReady = true;
      })
    } catch (err) {
      console.log(`action_getRewardRatio: ${err.message}`);
    }
  }
}

export default new OpenStoreman();
