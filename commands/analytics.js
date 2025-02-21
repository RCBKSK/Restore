const { SlashCommandBuilder } = require('@discordjs/builders');
const analyticsManager = require('../utils/analyticsManager');
const messageTemplates = require('../utils/messageTemplates');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('an')
        .setDescription('View lottery analytics')
        .addSubcommand(subcommand =>
            subcommand
                .setName('global')
                .setDescription('View global lottery statistics'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('user')
                .setDescription('View statistics for a specific user')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('User to view statistics for')
                        .setRequired(true))),

    async execute(interaction) {
        // Check if user has admin role
        if (!interaction.member.roles.cache.has(config.adminRoleId)) {
            await interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'global') {
            const globalStats = analyticsManager.getGlobalStats();
            const topParticipants = analyticsManager.getMostActiveParticipants(10);

            // Fetch user mentions
            const userMentions = new Map();
            for (const participant of topParticipants) {
                try {
                    const user = await interaction.client.users.fetch(participant.userId);
                    userMentions.set(participant.userId, user.toString());
                } catch (error) {
                    console.error(`Failed to fetch user ${participant.userId}:`, error);
                    userMentions.set(participant.userId, 'Unknown User');
                }
            }

            const embed = messageTemplates.createAnalyticsEmbed(globalStats, topParticipants, userMentions);
            await interaction.reply({ embeds: [embed], ephemeral: true });
        } else if (subcommand === 'user') {
            const user = interaction.options.getUser('user');
            const userStats = analyticsManager.getParticipantStats(user.id);
            const embed = messageTemplates.createUserStatsEmbed(user.id, userStats, user.toString());
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
