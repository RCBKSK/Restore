const { SlashCommandBuilder } = require('@discordjs/builders');
const lotteryManager = require('../utils/lotteryManager');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cnl')
        .setDescription('Cancel an ongoing lottery')
        .addStringOption(option =>
            option.setName('lottery_id')
                .setDescription('ID of the lottery to cancel')
                .setRequired(true)),

    async execute(interaction) {
        // Check if user has admin role
        if (!interaction.member.roles.cache.has(config.adminRoleId)) {
            await interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
            return;
        }

        const lotteryId = interaction.options.getString('lottery_id');
        const lottery = lotteryManager.getLottery(lotteryId);

        if (!lottery) {
            await interaction.reply({ content: 'Lottery not found!', ephemeral: true });
            return;
        }

        if (lottery.status !== 'active') {
            await interaction.reply({ content: 'This lottery is not active!', ephemeral: true });
            return;
        }

        const success = lotteryManager.cancelLottery(lotteryId);
        if (success) {
            await interaction.reply({ content: `Lottery for ${lottery.prize} has been cancelled.`, ephemeral: true });

            // Send a message to the channel where lottery was created
            if (lottery.channelid) {  // Note: using channelid instead of channelId
                try {
                    const channel = await interaction.client.channels.fetch(lottery.channelid);
                    if (channel) {
                        await channel.send(`🚫 The lottery for ${lottery.prize} has been cancelled by an administrator.`);
                    }
                } catch (error) {
                    console.error('Failed to send cancellation message:', error);
                }
            }
        } else {
            await interaction.reply({ content: 'Failed to cancel the lottery.', ephemeral: true });
        }
    }
};
