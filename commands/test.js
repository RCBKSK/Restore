
const { SlashCommandBuilder } = require('@discordjs/builders');
const lotteryManager = require('../utils/lotteryManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test')
        .setDescription('Test database connection'),
    async execute(interaction) {
        await interaction.deferReply();
        const isConnected = await lotteryManager.testDatabaseConnection();
        
        await interaction.editReply({
            content: isConnected 
                ? '✅ Successfully connected to database!' 
                : '❌ Failed to connect to database. Check your environment variables.'
        });
    }
};
