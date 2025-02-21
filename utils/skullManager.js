
const supabase = require('./supabaseClient');

class SkullManager {
    constructor() {}

    async getBalance(userId) {
        const { data, error } = await supabase
            .from('skulls')
            .select('balance')
            .eq('user_id', userId);
            
        if (error) throw error;
        return data?.[0]?.balance || 0;
    }

    async addSkulls(userId, amount) {
        const { data, error } = await supabase
            .from('skulls')
            .upsert({ 
                user_id: userId, 
                balance: amount 
            }, { 
                onConflict: 'user_id',
                target: ['user_id'],
                update: {
                    balance: `skulls.balance + ${amount}`
                }
            })
            .select()
            .single();
            
        if (error) throw error;
        return data.balance;
    }

    async removeSkulls(userId, amount) {
        const currentBalance = await this.getBalance(userId);
        if (currentBalance < amount) {
            return false;
        }
        
        const newBalance = currentBalance - amount;
        const { error } = await supabase
            .from('skulls')
            .update({ balance: newBalance })
            .eq('user_id', userId);
            
        if (error) throw error;
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
