import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

async function main() {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) {
        console.log('No firebase config found.');
        return;
    }
    const envPath = path.join(process.cwd(), '.env');
    const dotenv = await import('dotenv');
    dotenv.config();

    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

    if (!email || !privateKey) {
        console.log('Credentials missing in env.');
        return;
    }
    privateKey = privateKey.replace(/\\n/g, '\n');

    const auth = new google.auth.JWT(
        email,
        undefined,
        privateKey,
        ['https://www.googleapis.com/auth/spreadsheets.readonly']
    );

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '128y-JrUDPVWbvarLzKH4pSkNgmK25ouUM26aswWHKiU';

    try {
        const metadata = await sheets.spreadsheets.get({ spreadsheetId });
        console.log('Sheets in this spreadsheet:');
        metadata.data.sheets?.forEach(s => {
            console.log(`- Title: "${s.properties?.title}", SheetID: ${s.properties?.sheetId}`);
        });
    } catch (e: any) {
        console.error('Error fetching metadata:', e.message);
    }
}

main();
