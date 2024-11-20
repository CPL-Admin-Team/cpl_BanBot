import { ObjectId, Collection } from 'mongodb';
import { getSuspensionCollection, getBanDueCollection, getSuspDueCollection, getUserDataCollection } from './mongo';
import { CommandInteraction } from 'discord.js';

interface SuspensionDetails {
    ends: Date | null; 
    tier: number;
    decays?: Date; 
}

interface Member {
    _id: ObjectId;
    quit?: SuspensionDetails;
    minor?: SuspensionDetails;
    moderate?: SuspensionDetails;
    major?: SuspensionDetails;
    extreme?: SuspensionDetails;
    smurf?: SuspensionDetails;
    comp?: SuspensionDetails;
    overSub?: SuspensionDetails;
    suspended?: boolean;
}

interface SuspensionResponse {
    tier: number;
    ends: Date | null;
    pendingBan: boolean;
}

class PunishmentHandler {
    private _susp: Collection;
    private _banDue: Collection;
    private _suspensionDue: Collection;
    private _player: Collection;

    constructor() {
        this._susp = getSuspensionCollection() as Collection;
        this._suspensionDue = getSuspDueCollection() as Collection;
        this._banDue = getBanDueCollection() as Collection;
        this._player = getUserDataCollection() as Collection
    }

    private async getMember(memberId: ObjectId): Promise<Member | null> {
        return this._susp.findOne({ _id: memberId });
    }

    private async setSuspension(
        memberId: ObjectId,
        category: keyof Member,
        ends: Date | null,
        tier: number,
        decays: Date | null,
        suspended: boolean = true
    ): Promise<void> {
        await this._susp.updateOne(
            { _id: memberId },
            {
                $set: {
                    [`${category}.ends`]: ends,
                    [`${category}.tier`]: tier,
                    [`${category}.decays`]: decays,
                    suspended,
                },
            },
            { upsert: true }
        );
    }

    private async handleSuspension(
        memberId: ObjectId,
        category: keyof Member,
        tierIncrements: number[],
        decayDays: number
    ): Promise<SuspensionResponse> {
        const member = await this.getMember(memberId);
        const currentTier = (member?.[category] as any)?.tier ?? 0;

        const tier = Math.min(currentTier + 1, tierIncrements.length);
        const isFinalTier = tier === tierIncrements.length;

        const { ends, decays } = isFinalTier
            ? { ends: null, decays: new Date() } // Indefinite suspension
            : this.calculateEndsAndDecays(tierIncrements[tier - 1], decayDays);

        await this.setSuspension(memberId, category, ends, tier, decays);
        return { tier, ends, pendingBan: isFinalTier };
    }

    private calculateEndsAndDecays (increment: number, days: number) {
        const ends = new Date()
        let decays = new Date()
        decays.setDate(decays.getDate() + 90)
        ends.setDate(ends.getDate() + increment)

        return { ends, decays }
    }

    private async handleFixedSuspension(
        memberId: ObjectId,
        category: keyof Member,
        days: number
    ): Promise<SuspensionResponse> {
        const ends = new Date();
        ends.setDate(ends.getDate() + days);
        await this.setSuspension(memberId, category, ends, 0, null, true);
        return { tier: 0, ends, pendingBan: false };
    }

    async rmTier(memberId: ObjectId, category: keyof Member): Promise<number> {
        const member = await this.getMember(memberId);
        const currentTier = (member?.[category] as any)?.tier ?? 0;
        if (currentTier < 1) {
            return -1; // No tier to remove
        }
        await this._susp.updateOne(
            { _id: memberId },
            { $inc: { [`${category}.tier`]: -1 } }
        );
        const updatedMember = await this.getMember(memberId);
        return (updatedMember?.[category] as any)?.tier ?? 0; // Return updated tier
    }

    async addDays(memberId: ObjectId, num: number): Promise<Date | null> {
        const member = await this.getMember(memberId);
        let ends = new Date();

        if (member?.quit?.ends && member.quit.ends > ends) {
            ends = new Date(member.quit.ends);
        }

        ends.setDate(ends.getDate() + num);

        await this._susp.updateOne(
            { _id: memberId },
            {
                $set: {
                    suspended: true,
                    [`quit.ends`]: ends,
                },
            },
            { upsert: true }
        );
        return ends;
    }

    async rmDays(memberId: ObjectId, num: number): Promise<Date | null> {
        const member = await this.getMember(memberId);
        if (!member?.quit?.ends) {
            return null; // No existing end date to modify
        }

        const ends = new Date(member.quit.ends);
        ends.setDate(ends.getDate() - num);

        await this._susp.updateOne(
            { _id: memberId },
            {
                $set: {
                    [`quit.ends`]: ends,
                },
            }
        );
        return ends;
    }

    async unsuspend(memberId: ObjectId): Promise<void> {
        await this._susp.updateOne(
            { _id: memberId },
            {
                $set: {
                    suspended: false,
                    ends: null,
                },
            }
        );
    }

    private async logDue(collection: Collection, memberId: ObjectId): Promise<void> {
        try {
            await collection.insertOne({ _id: memberId });
        } catch (err) {
            console.error(`Error inserting into collection ${collection.collectionName}:`, err);
        }
    }

    async banDue(memberId: ObjectId): Promise<void> {
        await this.logDue(this._banDue, memberId);
    }

    async suspensionDue(memberId: ObjectId): Promise<void> {
        await this.logDue(this._suspensionDue, memberId);
    }

    private async checkDue(collection: Collection, memberId: ObjectId): Promise<boolean> {
        const result = await collection.deleteOne({ _id: memberId });
        return result.deletedCount > 0; 
    }

    async isSuspensionDue(memberId: ObjectId): Promise<boolean> {
        return await this.checkDue(this._suspensionDue, memberId);
    }

    async isBanDue(memberId: ObjectId): Promise<boolean> {
        return await this.checkDue(this._banDue, memberId);
    }

    // Punishment methods
    async quit(memberId: ObjectId): Promise<SuspensionResponse> {
        return this.handleSuspension(memberId, 'quit', [1, 3, 7, 14, 30, 180], 90);
    }

    async minor(memberId: ObjectId): Promise<SuspensionResponse> {
        return this.handleSuspension(memberId, 'minor', [1, 2, 3, 5, 7], 90);
    }

    async moderate(memberId: ObjectId): Promise<SuspensionResponse> {
        return this.handleSuspension(memberId, 'moderate', [1, 4, 7, 14, 30, 180], 90);
    }

    async major(memberId: ObjectId): Promise<SuspensionResponse> {
        return this.handleSuspension(memberId, 'major', [7, 14, 30, 180], 90);
    }

    async extreme(memberId: ObjectId): Promise<SuspensionResponse> {
        return this.handleSuspension(memberId, 'extreme', [7, 180], 1460);
    }

    async smurf(memberId: ObjectId): Promise<SuspensionResponse> {
        return this.handleFixedSuspension(memberId, 'smurf', 30);
    }

    async comp(memberId: ObjectId): Promise<SuspensionResponse> {
        return this.handleFixedSuspension(memberId, 'comp', 14);
    }

    async overSub(memberId: ObjectId): Promise<SuspensionResponse> {
        return this.handleFixedSuspension(memberId, 'overSub', 3);
    }

    async getUserByDiscord(discord_id: string) {
        return this._player.findOne({ discord_id })
    }

    async getUserTier(_id: ObjectId) {
        const suspension = await this._susp.findOne({ _id })
        return suspension
    }
}

export default PunishmentHandler;
