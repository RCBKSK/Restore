const { SlashCommandBuilder } = require('@discordjs/builders');
const lotteryManager = require('../utils/lotteryManager');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rm')
        .setDescription('Remove a participant from a lottery')
        .addStringOption(option =>
            option.setName('lottery_id')
                .setDescription('ID of the lottery')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to remove from the lottery')
                .setRequired(true)),

    async execute(interaction) {
        // Check if user has admin role
        if (!interaction.member.roles.cache.has(config.adminRoleId)) {
            await interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
            return;
        }

        const lotteryId = interaction.options.getString('lottery_id');
        const user = interaction.options.getUser('user');

        const lottery = lotteryManager.getLottery(lotteryId);
        if (!lottery) {
            await interaction.reply({ content: 'Lottery not found!', ephemeral: true });
            return;
        }

        if (lottery.status !== 'active') {
            await interaction.reply({ content: 'This lottery is not active!', ephemeral: true });
            return;
        }

        const success = lotteryManager.removeParticipant(lotteryId, user.id);
        if (success) {
            await interaction.reply({ 
                content: `Successfully removed ${user.toString()} from the lottery.`,
                ephemeral: true 
            });

            // Notify the removed user
            try {
                await user.send(`You have been removed from the lottery for ${lottery.prize} by an administrator.`);
            } catch (error) {
                console.error('Failed to send DM to removed user:', error);
            }
        } else {
            await interaction.reply({ 
                content: `${user.toString()} is not participating in this lottery.`,
                ephemeral: true 
            });
        }
    }
};
