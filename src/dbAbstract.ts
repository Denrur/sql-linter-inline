export abstract class DatabaseConnect {
    public tables: { table_name: string; columns: string[] }[] = [];
    abstract sqlForTables: string;
    abstract connect(): Promise<void>;
    abstract query(query: string): Promise<any>;
    abstract disconnect(): Promise<void>;
    async getTables() {
        try {
            this.connect();
            const res = await this.query(this.sqlForTables);
            for (let i = 0; i < res!.rows.length; i++) {
                let table = {
                    table_name: res?.rows[i].table_name,
                    columns: res?.rows[i].columns.map((column_name: string) => column_name),
                };
                this.tables.push(table);
            }
        } catch (err) {
            console.error("Error connecting to the database:", err);
        } finally {
            await this.disconnect();
        }
    }
}
