import { MongoClient, Collection, Db } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

let _cli: MongoClient | null = null;
let _susp: Collection | null = null;
let _bandue: Collection | null = null;
let _suspdue: Collection | null = null;
let _userData: Collection | null = null;

// MongoDB connection function
export const connectToMongoDB = async (): Promise<void> => {
    const url: string | undefined = process.env.MONGO_URL;
    const dbName: string | undefined = process.env.MONGODB_DB_NAME;

    if (!url || !dbName) {
        console.error('MongoDB URL or Database name is not defined in environment variables.');
        return;
    }

    try {
        const client = new MongoClient(url);
        await client.connect();
        _cli = client;
        const db: Db = _cli.db(dbName);

        _susp = db.collection('suspensions');
        _bandue = db.collection('bans_due');
        _suspdue = db.collection('suspensions_due');
        _userData = db.collection('players');

        console.log('MongoDB connected successfully');
    } catch (err) {
        console.error('Error connecting to MongoDB:', err);
    }
};

// Export collections for external use
export const getSuspensionCollection = () => _susp;
export const getBanDueCollection = () => _bandue;
export const getSuspDueCollection = () => _suspdue;
export const getUserDataCollection = () => _userData;