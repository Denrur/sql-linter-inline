import { Client } from 'pg';
import * as config from './config';

const client = new Client({
    host: config.get<string>('dbHost'),
    port: config.get<number>('dbPort'),
    user: config.get<string>('dbUser'),
    password: config.get<string>('dbPassword'),
    database: config.get<string>('dbName'),
});

async function connectToDatabase(query: string) {
    try {
        await client.connect();
        const res = await client.query(query);
    } catch (err) {
        console.error('Error connecting to the database:', err);
    } finally {
        await client.end();
    }
}

