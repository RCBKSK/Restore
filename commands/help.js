const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hlp')
        .setDescription('Display help information about SoulDraw commands'),

    async execute(interaction) {
        // Check if user has admin role
        const isAdmin = interaction.member.roles.cache.has(config.adminRoleId);

        const helpEmbed = new EmbedBuilder()
            .setTitle('SoulDraw Bot Commands')
            .setColor('#00FFFF')
            .setDescription('Here are all available commands for SoulDraw:')
            .addFields(
                {
                    name: '📊 Lottery Commands',
                    value: 
                        '`/sd [time] [prize] [winners] [ticket_price] [max_tickets] [min_participants] [terms]`\n' +
                        'Start a standard lottery with optional ticket system\n' +
                        'Example: `/sd 1h "100 USDT" 1 1 100 5 "Must follow Twitter"`\n\n' +

                        '`/rsd [time] [prize] [winners] [ticket_price] [max_tickets] [min_participants] [terms]`\n' +
                        'Start a raffle with mandatory ticket system\n' +
                        'Example: `/rsd 1h "100 USDT" 2 5 10 5 "Must follow Twitter"`\n' +
                        '(5 skulls/ticket, max 10 tickets/user, min 5 participants)\n\n' +

                        `Time format: Use 1h for 1 hour, ${Math.floor(config.minTimeLimit/60000)}m for ${Math.floor(config.minTimeLimit/60000)} minutes\n` +
                        `Minimum duration: ${Math.floor(config.minTimeLimit/60000)} minutes, Maximum: 24 hours`
                },
                {
                    name: '💀 Skull Commands',
                    value: 
                        '`/skulls balance` - Check your skull balance\n' +
                        '`/skulls gift @user amount` - Gift skulls to another user\n' +
                        (isAdmin ? '`/skulls add @user amount` - Add skulls to a user (Admin only)\n' +
                        '`/skulls remove @user amount` - Remove skulls from a user (Admin only)\n' : '') +
                        'Contact an admin to purchase skulls'
                },
                {
                    name: '🎮 Management Commands',
                    value: 
                        '`/cnl [lottery_id]` - Cancel an ongoing lottery\n' +
                        '`/rm [lottery_id] [user]` - Remove a participant\n' +
                        '`/draw [lottery_id]` - Manually draw winners (manual mode only)\n' +
                        '`/st` - Show status of all active lotteries and raffles'
                },
                {
                    name: '📈 Analytics Commands',
                    value: 
                        '`/an global` - View overall statistics and top participants\n' +
                        '`/an user [@user]` - View detailed stats for a specific user'
                },
                {
                    name: '❓ Help Command',
                    value: '`/hlp` - Show this help message'
                }
            )
            .setFooter({ 
                text: `Note: Minimum lottery duration is ${Math.floor(config.minTimeLimit/60000)} minutes • Admin commands are restricted` 
            });

        await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
    }
};