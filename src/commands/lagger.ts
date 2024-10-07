import { CommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'


export const data = 
  new SlashCommandBuilder()
  .setName('lagger')
  .setDescription('Does something....')
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)


export const execute = async (interaction: CommandInteraction) => {
  await interaction.reply({ content: 'Pong!', ephemeral: true })
}