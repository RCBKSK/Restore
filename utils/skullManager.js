
const { Pool } = require('pg');
const supabase = require('./supabaseClient');

class SkullManager {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL
        });
    }

    async getBalance(userId) {
        const { rows } = await this.pool.query(
            'SELECT balance FROM skulls WHERE user_id = $1',
            [userId]
        );
        return rows[0]?.balance || 0;
    }

    async addSkulls(userId, amount) {
        const { rows } = await this.pool.query(
            'INSERT INTO skulls (user_id, balance) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET balance = skulls.balance + $2 RETURNING balance',
            [userId, amount]
        );
        return rows[0].balance;
    }

    async removeSkulls(userId, amount) {
        const currentBalance = await this.getBalance(userId);
        if (currentBalance < amount) {
            return false;
        }
        
        await this.pool.query(
            'UPDATE skulls SET balance = balance - $2 WHERE user_id = $1',
            [userId, amount]
        );
        return true;
    }

    async hasEnoughSkulls(userId, amount) {
        const balance = await this.getBalance(userId);
        return balance >= amount;
    }

    async transferSkulls(fromUserId, toUserId, amount) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            
            if (!await this.hasEnoughSkulls(fromUserId, amount)) {
                await client.query('ROLLBACK');
                return false;
            }

            await client.query(
                'UPDATE skulls SET balance = balance - $2 WHERE user_id = $1',
                [fromUserId, amount]
            );
            
            await client.query(
                'INSERT INTO skulls (user_id, balance) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET balance = skulls.balance + $2',
                [toUserId, amount]
            );

            await client.query('COMMIT');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Transfer error:', error);
            return false;
        } finally {
            client.release();
        }
    }
}

module.exports = new SkullManager();
