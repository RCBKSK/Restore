const { SlashCommandBuilder } = require('@discordjs/builders');
const lotteryManager = require('../utils/lotteryManager');
const messageTemplates = require('../utils/messageTemplates');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('st')
        .setDescription('Show status of current lotteries'),

    async execute(interaction) {
        // Check if user has admin role
        if (!interaction.member.roles.cache.has(config.adminRoleId)) {
            await interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
            return;
        }

        const activeLotteries = await lotteryManager.getAllActiveLotteries();
        
        if (activeLotteries.length === 0) {
            await interaction.reply({ content: 'There are no active lotteries.', ephemeral: true });
            return;
        }

        const embeds = activeLotteries.map(lottery => messageTemplates.createStatusEmbed(lottery));
        await interaction.reply({ embeds: embeds, ephemeral: true });
    }
};
