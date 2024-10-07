import { config as env } from 'dotenv'
import path from 'path'

env({
  path: path.resolve('./.env'),
})

export const MAX_MENTIONS = 1

export const config = {
  clientId: process.env.BOT_CLIENT_ID ?? '',
  guildId: process.env.DISCORD_GUILD_ID ?? '',
  token: process.env.BOT_TOKEN ?? '',
  channels: {
    commands: process.env.DISCORD_SUSPENDED_CHANNEL_ID!,
    testchannel: process.env.DISCORD_BOT_CHANNEL_ID!,
  },
}