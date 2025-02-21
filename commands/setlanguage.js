const { SlashCommandBuilder } = require("@discordjs/builders");
const languageManager = require("../utils/languageManager");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("setlanguage")
        .setDescription("Set your preferred language for messages")
        .addStringOption((option) =>
            option
                .setName("language")
                .setDescription("Language code (e.g., en, es, fr, de)")
                .setRequired(true),
        ),
    async execute(interaction) {
        const language = interaction.options
            .getString("language")
            .toLowerCase();
        languageManager.setUserPreference(interaction.user.id, language);

        await interaction.reply({
            content: `Your preferred language has been set to: ${language}`,
            ephemeral: true,
        });
    },
};
