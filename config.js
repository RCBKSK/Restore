module.exports = {
    // Bot configuration
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,

    // Command permissions
    adminRoleId: '1339134803944935426',
    moderatorRoleId: process.env.MODERATOR_ROLE_ID || '1339134803944935427',
    participantRoleId: process.env.PARTICIPANT_ROLE_ID || '1339134803944935428',

    // Role permissions
    rolePermissions: {
        admin: ['sd', 'rsd', 'cnl', 'rm', 'draw', 'st', 'an', 'hlp'],
        moderator: ['st', 'an', 'hlp'],
        participant: ['hlp']
    },

    // Lottery defaults
    defaultMaxTime: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    minTimeLimit: 60 * 1000, // 1 minute in milliseconds
    maxWinners: 10,
};
