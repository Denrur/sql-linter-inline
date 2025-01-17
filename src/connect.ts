import { getDB } from "./getDB";

export async function executeSQL(query: string) {
    let client = await getDB();

    try {
        await client.connect();
        const res = await client.query(query);
        return res;
    } catch (err) {
        console.error("Error connecting to the database:", err);
    } finally {
        await client.disconnect();
    }

}
