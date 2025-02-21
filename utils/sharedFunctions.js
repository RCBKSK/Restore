
const { lotteryManager } = require('./lotteryManager');
const { updateLotteryMessage } = require('./messageUpdater');

module.exports = {
    getLottery: (lotteryId) => lotteryManager.getLottery(lotteryId),
    updateLotteryMessage
};
