import { CommandInteraction, PermissionFlagsBits, SlashCommandBuilder, GuildMember, TextChannel } from 'discord.js';
import PunishmentHandler from '../util/punishmentHandler';
import { ObjectId } from 'mongodb';

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
export const execute = async (interaction: CommandInteraction<undefined>): Promise<void> => {
    const punishmentHandler = new PunishmentHandler();
    const user = (interaction.options as any).getUser('target');
    const target = user ? await interaction.guild?.members.fetch(user.id) : null;

    if (!target) {
        await interaction.reply({ content: 'Invalid target.', ephemeral: true });
        return;
    }

    const discord_user = await punishmentHandler.getUserByDiscord(target.id)
    if (!discord_user) {
        await interaction.reply({ content: 'Could not find user in database.', ephemeral: true})
        return;
    }

    let tier = await getTier(discord_user._id, interaction);
    if (tier === null) return;
    await punishmentHandler.quit(discord_user?._id as any)
    tier += 1
    // Prepare messages
    const dmMessage = `You have been suspended for ${punishmentMessages[tier - 1]} Please check the server for further details.`;
    const channelMessage = `User: ${target.user.tag}\nTier: ${tier}\nReason: Quit infraction applied.`;

    // Send DM to the user
    try {
        const role = interaction.guild?.roles.cache.find((role) => role.id === process.env.DISCORD_SUSPENDED_ROLE_ID)
        if (!role) {
            await interaction.reply({ content: 'Error finding role.', ephemeral: true })
            return
        }
        await target.roles.add(role)
        await target.send(dmMessage);
    } catch (error) {
        console.error(`Could not send DM to ${target.user.tag}:`, error);
        await interaction.reply({ content: 'Failed to send DM to the user.', ephemeral: true });
        return;
    }

    // Send the channel message
    if (interaction.channel) {
        const channel = (interaction.channel as TextChannel)
        await channel.send(channelMessage);
    } else {
        console.warn('No channel found to send the quit message.');
    }

    await interaction.reply({ content: 'Quit infraction applied successfully.', ephemeral: true });
};

// Function to get the user's tier
const getTier = async (userId: ObjectId, interaction: CommandInteraction): Promise<number | null> => {
    let tier = 1; // Default tier
    const handler = new PunishmentHandler()
    try {
        const userData = await handler.getUserTier(userId);
        if (userData?.quit?.tier) {
            tier = userData.quit.tier;
        }
        return tier
    } catch (error) {
        console.error('Error fetching user data:', error);
        await interaction.reply({ content: 'There was an error fetching the user data.', ephemeral: true });
        return null;
    }
};