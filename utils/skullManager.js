
const { Collection } = require('discord.js');

class SkullManager {
    constructor() {
        this.userBalances = new Collection();
    }

    getBalance(userId) {
        return this.userBalances.get(userId) || 0;
    }

    addSkulls(userId, amount) {
        const currentBalance = this.getBalance(userId);
        this.userBalances.set(userId, currentBalance + amount);
        return this.getBalance(userId);
    }

    removeSkulls(userId, amount) {
        const currentBalance = this.getBalance(userId);
        if (currentBalance < amount) {
            return false;
        }
        this.userBalances.set(userId, currentBalance - amount);
        return true;
    }

    hasEnoughSkulls(userId, amount) {
        return this.getBalance(userId) >= amount;
    }

    transferSkulls(fromUserId, toUserId, amount) {
        if (!this.hasEnoughSkulls(fromUserId, amount)) {
            return false;
        }

        const success = this.removeSkulls(fromUserId, amount);
        if (success) {
            this.addSkulls(toUserId, amount);
            return true;
        }
        return false;
    }
}

module.exports = new SkullManager();
