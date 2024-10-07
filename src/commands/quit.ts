import { CommandInteraction, PermissionFlagsBits, SlashCommandBuilder, GuildMember } from 'discord.js';
import PunishmentHandler from '../util/punishmentHandler';

// Define the command data
export const data = new SlashCommandBuilder()
    .setName('quit')
    .setDescription('Applies a quit infraction to a user.')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(option =>
        option.setName('target')
            .setDescription('The user to apply the punishment to')
            .setRequired(true)
    );

// Array of punishment messages
const punishmentMessages: string[] = [
    '1 day suspension.',
    '3 day suspension.',
    '7 day suspension.',
    '14 day suspension.',
    '30 day suspension.',
    'Banned from server.'
];

// Execute function when the slash command is used
export const execute = async (interaction: CommandInteraction): Promise<void> => {
    const punishmentHandler = new PunishmentHandler();
    const user = interaction.options.getUser('target');
    const target = user ? await interaction.guild?.members.fetch(user.id) : null;

    if (!target) {
        await interaction.reply({ content: 'Invalid target.', ephemeral: true });
        return;
    }

    const tier = await getTier(target.id, interaction);
    if (tier === null) return;

    // Prepare messages
    const dmMessage = `You have been suspended for ${punishmentMessages[tier - 1]} Please check the server for further details.`;
    const channelMessage = `User: ${target.user.tag}\nTier: ${tier}\nReason: Quit infraction applied.`;

    // Send DM to the user
    try {
        await target.send(dmMessage);
    } catch (error) {
        console.error(`Could not send DM to ${target.user.tag}:`, error);
        await interaction.reply({ content: 'Failed to send DM to the user.', ephemeral: true });
        return;
    }

    // Send the channel message
    if (interaction.channel) {
        await interaction.channel.send(channelMessage);
    } else {
        console.warn('No channel found to send the quit message.');
    }

    await interaction.reply({ content: 'Quit infraction applied successfully.', ephemeral: true });
};

// Function to get the user's tier
const getTier = async (userId: string, interaction: CommandInteraction): Promise<number | null> => {
    let tier = 1; // Default tier
    try {
        const userData = await PunishmentHandler.getUserTier(userId, interaction);
        if (userData?.quit?.tier) {
            tier = userData.quit.tier;
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
        await interaction.reply({ content: 'There was an error fetching the user data.', ephemeral: true });
        return null;
    }
    return tier;
};