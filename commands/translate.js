const { SlashCommandBuilder } = require("@discordjs/builders");
const { translate } = require("@vitalets/google-translate-api");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("translate")
        .setDescription("Translate text to another language")
        .addStringOption((option) =>
            option
                .setName("text")
                .setDescription("Text to translate")
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName("target")
                .setDescription("Target language (e.g., es, fr, de, ja)")
                .setRequired(true),
        ),
    async execute(interaction) {
        const text = interaction.options.getString("text");
        const target = interaction.options.getString("target");

        try {
            const result = await translate(text, { to: target });
            await interaction.reply({
                embeds: [
                    {
                        color: 0x0099ff,
                        title: "🌐 Translation",
                        fields: [
                            { name: "Original", value: text },
                            {
                                name: `Translation (${target})`,
                                value: result.text,
                            },
                        ],
                    },
                ],
            });
        } catch (error) {
            console.error("Translation error:", error);
            await interaction.reply({
                content: "Sorry, there was an error translating your text.",
                ephemeral: true,
            });
        }
    },
};
