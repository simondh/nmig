/*
 * This file is a part of "NMIG" - the database migration tool.
 *
 * Copyright (C) 2016 - present, Anatoly Khaytovich <anatolyuss@gmail.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program (please see the "LICENSE.md" file).
 * If not, see <http://www.gnu.org/licenses/gpl.txt>.
 *
 * @author Anatoly Khaytovich <anatolyuss@gmail.com>
 */
import log from './Logger';
import Conversion from './Conversion';
import DBAccess from './DBAccess';
import DBAccessQueryResult from './DBAccessQueryResult';
import DBVendors from './DBVendors';
import { PoolClient } from 'pg';

/**
 * Decodes binary data from from textual representation in string.
 */
export default async function (conversion: Conversion): Promise<Conversion> {
    const logTitle: string = 'BinaryDataDecoder::decodeBinaryData';
    log(conversion, `\t--[${ logTitle }] Decodes binary data from textual representation in string.`);

    const dbAccess: DBAccess = new DBAccess(conversion);
    const sql: string = `SELECT table_name, column_name 
        FROM information_schema.columns
        WHERE table_catalog = '${ conversion._targetConString.database }' 
          AND table_schema = '${ conversion._schema }' 
          AND data_type IN ('bytea', 'geometry');`;

    const result: DBAccessQueryResult = await dbAccess.query(logTitle, sql, DBVendors.PG, false, false);

    if (result.error) {
        // No need to continue if no 'bytea' or 'geometry' columns found.
        dbAccess.releaseDbClient(<PoolClient>result.client);
        return conversion;
    }

    const decodePromises: Promise<void>[] = result.data.rows.map(async (row: any) => {
        const tableName: string = row.table_name;
        const columnName: string = row.column_name;
        const sqlDecode: string = `UPDATE ${ conversion._schema }."${ tableName }"
                SET "${ columnName }" = DECODE(ENCODE("${ columnName }", 'escape'), 'hex');`;

        await dbAccess.query(logTitle, sqlDecode, DBVendors.PG, false, false);
    });

    await Promise.all(decodePromises);
    return conversion;
}
