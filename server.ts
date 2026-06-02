import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { google } from 'googleapis';
import { sendOtpSms, verifyOtpCode, smsLogs, getSimulatedOtpForUser } from './smsService.js';
import { syncLicenseReceiverToSheets } from './googleSheetsService.js';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directories configuration
const DATA_DIR = path.join(__dirname, 'data');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'admin-accounts.json');
const MISSING_LICENSES_FILE = path.join(DATA_DIR, 'missing-licenses.json');
const FOUND_LICENSES_FILE = path.join(DATA_DIR, 'found-licenses.json');

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Interfaces
interface Account {
    username: string;
    fullName: string;
    designation: string;
    mobileNumber: string;
    role: 'super' | 'admin' | 'staff';
    status: 'active' | 'suspended';
    mustChangePassword?: boolean;
    failedAttempts: number;
    passwordHash: string;
    salt?: string;
    lastLoginTime?: string;
}

// Initialize Firebase for absolute permanent storage of admin accounts
let firebaseConfig: any = null;
let db: any = null;

try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
        firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const firebaseApp = initializeApp(firebaseConfig);
        if (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId.trim() !== '') {
            db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId.trim());
        } else {
            db = getFirestore(firebaseApp);
        }
        console.log(`🔥 Server-side Firebase Firestore initialized successfully for database: ${firebaseConfig.firestoreDatabaseId || '(default)'}`);
    } else {
        console.warn('⚠️ No firebase-applet-config.json found. Operating with local persistent JSON only.');
    }
} catch (e) {
    console.error('⚠️ Failed to initialize Firebase Firestore in server:', e);
}

// Google Sheets API Connection helper specifically for account databases
function getSheetsClient() {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

    if (!email || !privateKey) {
        return null;
    }

    try {
        privateKey = privateKey.replace(/\\n/g, '\n');
        const auth = new google.auth.JWT(
            email,
            undefined,
            privateKey,
            ['https://www.googleapis.com/auth/spreadsheets']
        );
        return google.sheets({ version: 'v4', auth });
    } catch (e: any) {
        console.error('❌ Failed to initialize Google Sheets API SDK in server:', e.message);
        return null;
    }
}

// Hash password helper for general SHA-256 syncing
function hashPasswordInServer(password: string, salt: string): string {
    return crypto.createHash('sha256').update(password + salt).digest('hex');
}

// Restore accounts from Sheets
async function restoreAccountsFromSheets(): Promise<Account[] | null> {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const client = getSheetsClient();
    if (!client || !spreadsheetId) {
        return null;
    }

    try {
        const meta = await client.spreadsheets.get({ spreadsheetId });
        const sheets = meta.data.sheets ?? [];
        const hasDbSheet = sheets.some(s => s.properties?.title === 'LRMS_USERS_DB');

        if (!hasDbSheet) {
            console.log(`📡 [Sheets Auth] LRMS_USERS_DB tab not found. Bootstrapping initial tab in sheets...`);
            await client.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: [{
                        addSheet: { properties: { title: 'LRMS_USERS_DB' } }
                    }]
                }
            });
            const headers = ["username", "fullName", "designation", "mobileNumber", "role", "status", "failedAttempts", "mustChangePassword", "passwordHash", "salt", "lastLoginTime"];
            await client.spreadsheets.values.update({
                spreadsheetId,
                range: 'LRMS_USERS_DB!A1',
                valueInputOption: 'RAW',
                requestBody: { values: [headers] }
            });
            return null;
        }

        const response = await client.spreadsheets.values.get({
            spreadsheetId,
            range: 'LRMS_USERS_DB!A2:K1000'
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            return null;
        }

        const accounts: Account[] = rows.map(row => ({
            username: String(row[0] ?? '').trim().toLowerCase(),
            fullName: String(row[1] ?? '').trim(),
            designation: String(row[2] ?? '').trim(),
            mobileNumber: String(row[3] ?? '').trim(),
            role: (row[4] ?? 'staff') as 'super' | 'admin' | 'staff',
            status: (row[5] ?? 'active') as 'active' | 'suspended',
            failedAttempts: Number(row[6] ?? 0),
            mustChangePassword: row[7] === 'true' || row[7] === true,
            passwordHash: String(row[8] ?? ''),
            salt: String(row[9] ?? ''),
            lastLoginTime: String(row[10] ?? '')
        }));

        console.log(`📡 [Sheets Auth] Successfully synced ${accounts.length} operator accounts from Google Sheets.`);
        return accounts;
    } catch (err: any) {
        console.error('❌ [Sheets Auth] Failed to restore accounts from Google Sheets:', err.message);
        return null;
    }
}

// Save accounts to Sheets
async function saveAccountsToSheets(accounts: Account[]) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const client = getSheetsClient();
    if (!client || !spreadsheetId) {
        return;
    }

    try {
        const values = accounts.map(a => [
            a.username || '',
            a.fullName || '',
            a.designation || '',
            a.mobileNumber || '',
            a.role || 'staff',
            a.status || 'active',
            a.failedAttempts ?? 0,
            a.mustChangePassword ? 'true' : 'false',
            a.passwordHash || '',
            a.salt || '',
            a.lastLoginTime || ''
        ]);

        await client.spreadsheets.values.clear({
            spreadsheetId,
            range: 'LRMS_USERS_DB!A2:K1000'
        });

        await client.spreadsheets.values.update({
            spreadsheetId,
            range: 'LRMS_USERS_DB!A2',
            valueInputOption: 'RAW',
            requestBody: { values }
        });
        console.log('📡 [Sheets Auth] Successfully hard-synced user account schema updates to Google Sheets master database.');
    } catch (err: any) {
        console.error('❌ [Sheets Auth] Failed writing back to Google Sheets:', err.message);
    }
}

// Helper: Synchronize accounts with local, remote Firestore, and Google Sheets
async function saveAccounts(accounts: Account[]) {
    try {
        // 1. Write to local ACCOUNTS_FILE cache
        fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), 'utf-8');
        console.log('💾 Saved accounts to local JSON file system cache.');

        // 2. Sync to Google Sheets Database
        await saveAccountsToSheets(accounts);

        // 3. Write to Firebase Firestore document for fallback persistence
        if (db) {
            const docRef = doc(db, 'lrms_system', 'admin_accounts_doc');
            await setDoc(docRef, { accounts, lastUpdated: new Date().toISOString() });
            console.log('🔥 Sync successfully backed up to Firestore Cloud.');
        }
    } catch (err: any) {
        console.error('❌ Failed to save accounts persistently:', err?.message || err);
    }
}

// Helper: Restore accounts from Google Sheets, persistent Firestore, or local JSON file
async function restoreAccountsFromFirestore(): Promise<Account[]> {
    let accounts: Account[] = [];
    
    // First Priority: Try loading from Google Sheets Master DB
    const sheetsAccounts = await restoreAccountsFromSheets();
    if (sheetsAccounts && sheetsAccounts.length > 0) {
        // Synchronise caches
        fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(sheetsAccounts, null, 2), 'utf-8');
        return sheetsAccounts;
    }

    // Second Priority: Read from local cache file if it exists
    if (fs.existsSync(ACCOUNTS_FILE)) {
        try {
            accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf-8'));
        } catch (e) {
            console.error('Failed to read local accounts file:', e);
        }
    }

    // Third Priority: Try to load from Firestore and overwrite/restore if found
    if (db) {
        try {
            console.log('🔄 Loading accounts from Firestore Cloud...');
            const docRef = doc(db, 'lrms_system', 'admin_accounts_doc');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const cloudAccounts = docSnap.data().accounts as Account[];
                if (cloudAccounts && cloudAccounts.length > 0) {
                    accounts = cloudAccounts;
                    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), 'utf-8');
                    console.log(`🔥 [Firebase Restore] Restored ${accounts.length} accounts from Firestore Cloud successfully.`);
                }
            } else {
                console.log('🔥 [Firebase Restore] No document found on Firestore. Synced initial accounts to cloud.');
                if (accounts.length > 0) {
                    await setDoc(docRef, { accounts, lastUpdated: new Date().toISOString() });
                }
            }
        } catch (e: any) {
            console.warn('🔥 [Firebase Restore] Firestore restore bypassed or failed:', e?.message || e);
        }
    }
    return accounts;
}

// Helper: Seed Default Accounts
async function seedAccounts() {
    let accounts: Account[] = [];
    
    // First, try restoring from Firestore Cloud to avoid erasing anything
    accounts = await restoreAccountsFromFirestore();

    let modified = false;

    const hasSuper = accounts.some(a => a.username === 'superadmin' || a.role === 'super');
    const hasAdmin = accounts.some(a => a.username === 'admin');
    const hasStaff = accounts.some(a => a.username === 'staff');

    if (!hasSuper) {
        accounts.push({
            username: 'superadmin',
            fullName: 'Super User Administrator',
            designation: 'Lead IT Controller',
            mobileNumber: '9841234567',
            role: 'super',
            status: 'active',
            mustChangePassword: false,
            failedAttempts: 0,
            passwordHash: bcrypt.hashSync('Itahari@2026', 10)
        });
        modified = true;
    }

    if (!hasAdmin) {
        accounts.push({
            username: 'admin',
            fullName: 'Lead Administrator',
            designation: 'Admin Operator',
            mobileNumber: '9843112233',
            role: 'admin',
            status: 'active',
            mustChangePassword: true,
            failedAttempts: 0,
            passwordHash: bcrypt.hashSync('Admin@2026', 10)
        });
        modified = true;
    }

    if (!hasStaff) {
        accounts.push({
            username: 'staff',
            fullName: 'Staff Operator Team',
            designation: 'Computer Operator',
            mobileNumber: '9845012345',
            role: 'staff',
            status: 'active',
            mustChangePassword: true,
            failedAttempts: 0,
            passwordHash: bcrypt.hashSync('Staff@2026', 10)
        });
        modified = true;
    }

    if (modified || accounts.length === 0) {
        await saveAccounts(accounts);
        console.log('✅ Default LRMS Administrative Accounts seeded successfully into persistence.');
    } else {
        // Heuristic self-healing: ensure superadmin is not suspended, and password hash is valid
        let healed = false;
        for (const acc of accounts) {
            if (acc.username === 'superadmin') {
                if (acc.status === 'suspended') {
                    acc.status = 'active';
                    healed = true;
                }
                if (acc.failedAttempts > 0) {
                    acc.failedAttempts = 0;
                    healed = true;
                }
                if (!acc.passwordHash || (!acc.passwordHash.startsWith('$2a$') && !acc.passwordHash.startsWith('$2b$'))) {
                    acc.passwordHash = bcrypt.hashSync('Itahari@2026', 10);
                    healed = true;
                }
            }
        }
        if (healed) {
            await saveAccounts(accounts);
            console.log('🔥 [Self-Healing] Superadmin account healed and sync\'ed back to Firestore Cloud.');
        }
    }
}

seedAccounts();

// Get secret securely
const JWT_SECRET = process.env.JWT_SECRET || 'LRMS-Sunsari-Itahari-Secure-Token-Salt-Key-2026!!';

const app = express();
app.use(express.json());
app.use(cors());

// Log utility for Admin audits
interface AuditLog {
    timestamp: string;
    username: string;
    action: string;
    status: 'success' | 'failed' | 'lockout' | 'warning';
    details: string;
    ip?: string;
}
const auditLogs: AuditLog[] = [];

// Middleware: Authenticate Session using JWT
function verifyToken(req: Request & { user?: any }, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'अनधिकृत प्रवेश! (MFA authorization session missing)' });
    }

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) {
            return res.status(403).json({ error: 'सत्र समाप्त भयो! (Your authentication session is stale or expired.)' });
        }
        req.user = user;
        next();
    });
}

// API: Server Status / Logs
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', now: new Date().toISOString() });
});

// API: Primary Login Authentication
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'कृपया प्रयोगकर्ता नाम र पासवर्ड दुवै हाल्नुहोस्।' });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    
    try {
        const accounts = await restoreAccountsFromFirestore();
        const idx = accounts.findIndex(a => a.username === cleanUsername);

        if (idx === -1) {
            return res.status(401).json({ error: 'गलत प्रयोगकर्ता नाम वा पासवर्ड! कृपया पुनः जाँच गर्नुहोस्।' });
        }

        const user = accounts[idx];

        if (user.status === 'suspended') {
            return res.status(403).json({ error: 'धेरै असफल प्रयासहरूको कारण तपाईंको खाता अस्थायी रूपमा निलम्बित गरिएको छ।' });
        }

        // Validate password (supports both bcrypt and SHA-256 with salt)
        const passwordMatch = user.salt 
            ? hashPasswordInServer(password, user.salt) === user.passwordHash
            : bcrypt.compareSync(password, user.passwordHash);

        if (!passwordMatch) {
            user.failedAttempts += 1;
            if (user.failedAttempts >= 5) {
                user.status = 'suspended';
            }
            await saveAccounts(accounts);

            if (user.status === 'suspended') {
                return res.status(403).json({ error: 'धेरै असफल प्रयासहरूको कारण तपाईंको खाता अस्थायी रूपमा निलम्बित गरिएको छ।' });
            }
            return res.status(401).json({ error: `गलत पासवर्ड! प्रयास बाँकी: ${5 - user.failedAttempts}/5` });
        }

        // Password corrected, direct login approved (2FA OTP Security removed)
        user.failedAttempts = 0;
        user.lastLoginTime = new Date().toISOString();
        await saveAccounts(accounts);

        // Create JWT token immediately
        const token = jwt.sign(
            { username: user.username, role: user.role, fullName: user.fullName },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            success: true,
            otp_required: false,
            token,
            user: {
                username: user.username,
                fullName: user.fullName,
                role: user.role,
                designation: user.designation,
                mustChangePassword: user.mustChangePassword
            }
        });

    } catch (err: any) {
        res.status(500).json({ error: 'लगइन प्रमाणिकरणमा आन्तरिक समस्या आयो: ' + err.message });
    }
});

// API: Resend login OTP
app.post('/api/auth/resend-otp', async (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ error: 'Required parameter username was not passed!' });
    }

    try {
        const accounts = await restoreAccountsFromFirestore();
        const user = accounts.find(a => a.username === username.toLowerCase());
        if (!user) {
            return res.status(404).json({ error: 'User does not exist.' });
        }

        const targetOtpResult = await sendOtpSms(user.username, user.mobileNumber);
        res.json({
            success: true,
            message: `OTP resent successfully to registered phone.`,
            simulatedOtp: getSimulatedOtpForUser(user.username)
        });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// API: Verify OTP Code and complete Session authentication
app.post('/api/auth/verify-otp', async (req, res) => {
    const { username, code } = req.body;

    if (!username || !code) {
        return res.status(400).json({ error: 'कृपया प्रयोगकर्ता ६-डिजिट OTP विवरण हाल्नुहोस।' });
    }

    try {
        // Validate code matches
        verifyOtpCode(username, code);

        const accounts = await restoreAccountsFromFirestore();
        const user = accounts.find(a => a.username === username.toLowerCase());

        if (!user) {
            return res.status(404).json({ error: 'प्रयोकर्ता खाता फेला परेन!' });
        }

        // Create JWT token
        const token = jwt.sign(
            { username: user.username, role: user.role, fullName: user.fullName },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            success: true,
            token,
            user: {
                username: user.username,
                fullName: user.fullName,
                role: user.role,
                designation: user.designation,
                mustChangePassword: user.mustChangePassword
            }
        });

    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// API: Change password (for both forced password changes and security updates)
app.post('/api/auth/change-password', verifyToken, async (req: any, res) => {
    const { newPassword } = req.body;
    const username = req.user.username;

    if (!newPassword || String(newPassword).length < 4) {
        return res.status(400).json({ error: 'नयाँ पासवर्ड कम्तिमा ४ अक्षरको हुनुपर्छ।' });
    }

    try {
        const accounts = await restoreAccountsFromFirestore();
        const idx = accounts.findIndex(a => a.username === username);

        if (idx === -1) {
            return res.status(404).json({ error: 'प्रयोगकर्ता भेटिएन।' });
        }

        const salt = crypto.randomBytes(8).toString('hex');
        accounts[idx].salt = salt;
        accounts[idx].passwordHash = hashPasswordInServer(newPassword, salt);
        accounts[idx].mustChangePassword = false;
        accounts[idx].failedAttempts = 0;

        await saveAccounts(accounts);

        res.json({ success: true, message: 'पासवर्ड सफलतापूर्वक परिवर्तन भयो!' });
    } catch (e: any) {
        res.status(500).json({ error: 'पासवर्ड परिवर्तन गर्न सकिएन: ' + e.message });
    }
});

// API: List of allowed password-change target accounts for currently logged-in user
app.get('/api/admin/available-targets', verifyToken, async (req: any, res) => {
    try {
        const accounts = await restoreAccountsFromFirestore();
        const currentUser = req.user; // { username: string, role: string }

        let targets: any[] = [];
        if (currentUser.role === 'super') {
            // Super Admin can change ANY and all accounts
            targets = accounts.map(a => ({
                username: a.username,
                fullName: a.fullName,
                role: a.role
            }));
        } else if (currentUser.role === 'admin') {
            // Admin can change themselves and any 'staff' role accounts
            targets = accounts
                .filter(a => a.username === currentUser.username || a.role === 'staff')
                .map(a => ({
                    username: a.username,
                    fullName: a.fullName,
                    role: a.role
                }));
        } else {
            // Staff can only change themselves
            targets = accounts
                .filter(a => a.username === currentUser.username)
                .map(a => ({
                    username: a.username,
                    fullName: a.fullName,
                    role: a.role
                }));
        }

        res.json(targets);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// API: Change password for target account with authorization check
app.post('/api/admin/change-any-password', verifyToken, async (req: any, res) => {
    const { targetUsername, newPassword } = req.body;
    const currentUser = req.user; // { username: string, role: string }

    if (!targetUsername || !newPassword || String(newPassword).length < 4) {
        return res.status(400).json({ error: 'Target username is required and password must be at least 4 characters long.' });
    }

    try {
        const accounts = await restoreAccountsFromFirestore();
        const targetIdx = accounts.findIndex(a => a.username === targetUsername.trim().toLowerCase());

        if (targetIdx === -1) {
            return res.status(404).json({ error: 'लक्ष्य प्रयोगकर्ता भेटिएन।' });
        }

        const targetUser = accounts[targetIdx];

        // Authorization checks
        let isAuthorized = false;

        if (currentUser.username.toLowerCase() === targetUser.username.toLowerCase()) {
            isAuthorized = true;
        } else if (currentUser.role === 'super') {
            isAuthorized = true;
        } else if (currentUser.role === 'admin' && targetUser.role === 'staff') {
            isAuthorized = true;
        }

        if (!isAuthorized) {
            return res.status(403).json({ error: 'यो प्रयोगकर्ताको पासवर्ड परिवर्तन गर्ने अधिकार तपाईंसँग छैन।' });
        }

                // Apply new hashed password
        const salt = crypto.randomBytes(8).toString('hex');
        targetUser.salt = salt;
        targetUser.passwordHash = hashPasswordInServer(newPassword, salt);
        targetUser.mustChangePassword = false;
        targetUser.failedAttempts = 0;

        await saveAccounts(accounts);

        res.json({ 
            success: true, 
            message: `प्रयोगकर्ता "${targetUser.username}" (${targetUser.fullName}) को पासवर्ड सफलतापुर्वक परिवर्तन गरियो ।` 
        });
    } catch (e: any) {
        res.status(500).json({ error: 'त्रुटि: ' + e.message });
    }
});

// API: Retrieve Staff Operators list (All authenticated users can view)
app.get('/api/admin/staff', verifyToken, async (req: any, res) => {
    try {
        console.log('📡 [GET /api/admin/staff] Request received from user:', req.user?.username);
        const accounts = await restoreAccountsFromFirestore();
        if (!accounts || !Array.isArray(accounts)) {
            console.warn('⚠️ [GET /api/admin/staff] Accounts returned from store is not an array.');
            return res.json([]);
        }
        const staffList = accounts.map((user: any) => {
            if (!user || typeof user !== 'object') return null;
            const { passwordHash, ...safeUser } = user;
            return safeUser;
        }).filter(Boolean);
        
        console.log(`📡 [GET /api/admin/staff] Returning ${staffList.length} staff records.`);
        res.json(staffList);
    } catch (e: any) {
        console.error('❌ [GET /api/admin/staff] Unhandled exception:', e);
        res.status(500).json({ error: 'प्रयोगकर्ता सूची लोड गर्न असमर्थ भयो: ' + (e.message || String(e)) });
    }
});

// API: Add new Staff Account (Super Admin only)
app.post('/api/admin/staff', verifyToken, async (req: any, res) => {
    if (req.user.role !== 'super') {
        return res.status(403).json({ error: 'सुपर प्रशासक पहुँच आवश्यक छ!' });
    }

    const { username, password, fullName, designation, mobileNumber, role } = req.body;

    if (!username || !password || !fullName || !mobileNumber) {
        return res.status(400).json({ error: 'कृपया सबै आवश्यक फाँट विवरण भर्नुहोस।' });
    }

    try {
        const accounts = await restoreAccountsFromFirestore();
        const exists = accounts.some(a => a.username === username.toLowerCase());

        if (exists) {
            return res.status(400).json({ error: 'यो प्रयोगकर्ता नाम पहिले नै अवस्थित छ!' });
        }

        const salt = crypto.randomBytes(8).toString('hex');
        accounts.push({
            username: username.toLowerCase().trim(),
            fullName: fullName.trim(),
            designation: designation || 'Computer Operator',
            mobileNumber: mobileNumber.trim(),
            role: role || 'staff',
            status: 'active',
            mustChangePassword: true,
            failedAttempts: 0,
            salt,
            passwordHash: hashPasswordInServer(password, salt)
        });

        await saveAccounts(accounts);
        res.json({ success: true, message: `कर्मचारी "${fullName}" सफलतापूर्वक थपियो।` });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// API: Delete / Remove Staff profile (Super Admin only)
app.delete('/api/admin/staff/:username', verifyToken, async (req: any, res) => {
    if (req.user.role !== 'super') {
        return res.status(403).json({ error: 'सुपर प्रशासक पहुँच विवरण!' });
    }

    const targetUser = req.params.username.toLowerCase();

    if (targetUser === 'superadmin' || targetUser === req.user.username) {
        return res.status(400).json({ error: 'तपाईंले यो प्रणाली प्रशासक हटाउन सक्नुहुन्न!' });
    }

    try {
        const accounts = await restoreAccountsFromFirestore();
        const filtered = accounts.filter(a => a.username !== targetUser);

        if (accounts.length === filtered.length) {
            return res.status(404).json({ error: 'कर्मचारी भेटिएन!' });
        }

        await saveAccounts(filtered);
        res.json({ success: true, message: `कर्मचारी खाता "${targetUser}" हटाइयो।` });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// API: Request Password Reset (Super Admin only - 2FA OTP Security removed)
// Directly generates secure temporary password and saves to persistence
app.post('/api/admin/request-staff-reset', verifyToken, async (req: any, res) => {
    if (req.user.role !== 'super') {
        return res.status(403).json({ error: 'सुपर प्रशासक विशेषाधिकार आवश्यक छ!' });
    }

    const { staffUsername, customPassword, mustChangePassword } = req.body;
    if (!staffUsername) {
        return res.status(400).json({ error: 'Target staff identity required.' });
    }

    try {
        const accounts = await restoreAccountsFromFirestore();
        const idx = accounts.findIndex(a => a.username === staffUsername.toLowerCase());

        if (idx === -1) {
            return res.status(404).json({ error: 'लक्ष्य कर्मचारी भेटिएन।' });
        }

        let tempPassword = customPassword ? String(customPassword).trim() : '';
        if (!tempPassword) {
            // Generate temporary randomized password
            const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
            for (let i = 0; i < 8; i++) {
                tempPassword += characters.charAt(Math.floor(Math.random() * characters.length));
            }
        }

        const salt = crypto.randomBytes(8).toString('hex');
        accounts[idx].salt = salt;
        accounts[idx].passwordHash = hashPasswordInServer(tempPassword, salt);
        // If Custom password is assigned, do not require change unless explicitly set to true
        accounts[idx].mustChangePassword = mustChangePassword !== undefined ? !!mustChangePassword : (customPassword ? false : true);
        accounts[idx].failedAttempts = 0;
        if (accounts[idx].status === 'suspended') accounts[idx].status = 'active';

        await saveAccounts(accounts);

        res.json({
            otp_required: false,
            success: true,
            tempPassword,
            message: `कर्मचारी "${staffUsername}" को पासवर्ड सफलतापूर्वक रीसेट गरियो।`
        });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// API: Confirm Password Reset after OTP verify
app.post('/api/admin/confirm-staff-reset', verifyToken, async (req: any, res) => {
    if (req.user.role !== 'super') {
        return res.status(403).json({ error: 'प्रवेश निषेध' });
    }

    const { staffUsername, superAdminOtp } = req.body;
    if (!staffUsername || !superAdminOtp) {
        return res.status(400).json({ error: 'Required values missing.' });
    }

    try {
        // First verify Super Admin OTP
        verifyOtpCode(req.user.username, superAdminOtp);

        // OTP verified successfully! Proceed to reset the password
        const accounts = await restoreAccountsFromFirestore();
        const idx = accounts.findIndex(a => a.username === staffUsername.toLowerCase());

        if (idx === -1) {
            return res.status(404).json({ error: 'लक्ष्य कर्मचारी भेटिएन।' });
        }

        // Generate temporary randomized password
        const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
        let tempPassword = '';
        for (let i = 0; i < 8; i++) {
            tempPassword += characters.charAt(Math.floor(Math.random() * characters.length));
        }

        const salt = crypto.randomBytes(8).toString('hex');
        accounts[idx].salt = salt;
        accounts[idx].passwordHash = hashPasswordInServer(tempPassword, salt);
        accounts[idx].mustChangePassword = true;
        accounts[idx].failedAttempts = 0;
        if (accounts[idx].status === 'suspended') accounts[idx].status = 'active';

        await saveAccounts(accounts);

        res.json({
            success: true,
            tempPassword,
            message: `कर्मचारी "${staffUsername}" को पासवर्ड सफलतापूर्वक रीसेट गरियो र नयाँ अस्थायी पासवर्ड सिर्जना गरियो।`
        });

    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// API: Toggle Staff Profile status Active/Suspended (Super Admin only)
app.post('/api/admin/staff-toggle-status', verifyToken, async (req: any, res) => {
    if (req.user.role !== 'super') {
        return res.status(403).json({ error: 'प्रवेश निषेध' });
    }

    const { username, status } = req.body;
    if (!username || !status) {
        return res.status(400).json({ error: 'Values missing.' });
    }

    try {
        const accounts = await restoreAccountsFromFirestore();
        const idx = accounts.findIndex(a => a.username === username.toLowerCase());

        if (idx === -1) {
            return res.status(404).json({ error: 'Staff account not found.' });
        }

        accounts[idx].status = status;
        if (status === 'active') {
            accounts[idx].failedAttempts = 0;
        }

        await saveAccounts(accounts);
        res.json({ success: true, message: `Staff status is now updated to "${status}".` });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// API: Save Receiver with Real-Time Google Sheet API Sync
app.post('/api/license/save-receiver', async (req: any, res) => {
    const { spreadsheetId, sheetName, columnLetter, gid, googleScriptUrl, applicantId } = req.body;
    
    // Support both rowNumber/absoluteRow and receivedBy/receiverName to prevent mapping errors
    const absoluteRow = req.body.rowNumber || req.body.absoluteRow;
    const receivedBy = req.body.receivedBy !== undefined ? req.body.receivedBy : req.body.receiverName;

    console.log('📌 [Server Save Receiver] Incoming Payload:', JSON.stringify(req.body, null, 2));

    if (!absoluteRow) {
        return res.status(400).json({ error: 'absoluteRow or rowNumber is required.' });
    }

    let appsScriptError = '';

    // Capture the Web App sync first if googleScriptUrl is provided by user settings
    if (googleScriptUrl && googleScriptUrl.trim() !== '') {
        console.log(`📡 [Server Save Receiver] Proxy-forwarding save request to Google Apps Script Web App: ${googleScriptUrl}`);
        try {
            const scriptRes = await fetch(googleScriptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    receivedBy,
                    absoluteRow: Number(absoluteRow),
                    columnLetter: columnLetter || 'I',
                    spreadsheetId,
                    sheetName,
                    gid,
                    applicantId
                })
            });

            const responseText = await scriptRes.text();
            console.log(`🎯 [Server Save Receiver] Google Apps Script raw response:`, responseText);

            if (!scriptRes.ok) {
                throw new Error(`Google Apps Script web service returned HTTP Error Code ${scriptRes.status}.`);
            }

            let responseJson: any;
            try {
                responseJson = JSON.parse(responseText);
            } catch (e) {
                if (responseText.toLowerCase().includes('<html') || responseText.toLowerCase().includes('<!doctype') || responseText.toLowerCase().includes('accounts.google.com')) {
                    throw new Error('Google Apps Script returned Google Authentication/HTML page. Make sure the script is published as Web App, "Execute as: Me" and "Who has access: Anyone".');
                }
                responseJson = { raw: responseText };
            }

            if (responseJson.status === 'error' || responseJson.success === false) {
                throw new Error(responseJson.message || 'Google Apps Script returned execution error.');
            }

            return res.json({
                success: true,
                status: 'success',
                message: 'Saved matching row successfully in Google Sheet via Apps Script Web App.',
                details: responseJson
            });

        } catch (e: any) {
            console.warn('⚠️ [Server Save Receiver] Google Apps Script connection bypassed/failed, falling back to Sheets API:', e.message);
            appsScriptError = e.message;
        }
    }

    // Extract Bearer Access Token if present to update sheets using user credentials
    const authHeader = req.headers['authorization'];
    let accessToken: string | undefined;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        accessToken = authHeader.substring(7);
    }

    try {
        // Sync operation to Google Sheets API synchronously to ensure real-time consistency
        const syncResult = await syncLicenseReceiverToSheets({
            receivedBy,
            absoluteRow: Number(absoluteRow),
            columnLetter,
            spreadsheetId,
            sheetName,
            accessToken,
            gid
        });

        console.log(`[Proxy Sheet Update Sync] Dynamic save complete with status: ${syncResult.status}`);

        return res.json({
            success: true,
            status: syncResult.status,
            message: 'Save request processed and synced to Google Sheets successfully.',
            details: syncResult.message,
            appsScriptError: appsScriptError || undefined
        });

    } catch (e: any) {
        console.warn('⚠️ Google Sheets Sync background warning/bypass:', e.message);
        
        // Return success: true but with status: "simulated_success" so that the client-side
        // local state and IndexedDB still update successfully without showing block alerts!
        res.json({
            success: true,
            status: 'simulated_success',
            warning: 'Synced locally in browser, but unable to sync with Google Sheet. Please check your credentials.',
            message: e.message,
            appsScriptError: appsScriptError || undefined
        });
    }
});

// API: Get SMS delivery status logs (Super Admin / Admin audits)
app.get('/api/admin/sms-logs', verifyToken, (req, res) => {
    res.json(smsLogs);
});

// API: Proxy sheet download to bypass client CORS restrictions
app.get('/api/license/proxy-sheet', async (req: any, res) => {
    const { spreadsheetId, gid, sheetName } = req.query as { spreadsheetId: string, gid?: string, sheetName?: string };
    
    if (!spreadsheetId) {
        return res.status(400).json({ error: 'spreadsheetId is required' });
    }
    
    // Safety audit: Check for malformed spreadsheetId (e.g. Google Apps Script URLs or absolute URLs)
    if (spreadsheetId.includes('script.google.com') || 
        spreadsheetId.includes('/macros/') || 
        spreadsheetId.startsWith('http') ||
        spreadsheetId.includes('/') ||
        spreadsheetId.includes('.')
    ) {
        return res.status(400).json({ 
            error: 'Invalid spreadsheetId format provided. Make sure to provide a valid 44-character Google Sheet ID, not a Google Apps Script URL or a full website address.' 
        });
    }
    
    // Attempt list of target URLs with aggressive self-healing fallbacks
    const urlsToTry: string[] = [];
    const nocache = `&_nocache=${Date.now()}`;
    if (gid) {
        urlsToTry.push(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}${nocache}`);
    } else if (sheetName) {
        urlsToTry.push(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}${nocache}`);
    }
    // Base fallback: default first sheet
    urlsToTry.push(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv${nocache.replace('&', '?')}`);

    // Extract Bearer Access Token if present to authorized sheet downloads
    const authHeader = req.headers['authorization'];
    let googleBearerToken = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        let isLocalJwt = false;
        try {
            jwt.verify(token, JWT_SECRET);
            isLocalJwt = true;
        } catch (e) {
            // Not a local JWT token
        }
        if (!isLocalJwt) {
            googleBearerToken = authHeader;
        } else {
            console.log('[Proxy Sheet] Filtered out local application JWT token from being sent to Google Sheets API.');
        }
    }

    // Prepare list of authorization header configurations to try
    const headerOptions: Record<string, string>[] = [];
    
    if (googleBearerToken) {
        headerOptions.push({ 'Authorization': googleBearerToken });
    }
    
    // Build Service Account credential headers fallback if configured
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const serviceAccountPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    if (serviceAccountEmail && serviceAccountPrivateKey) {
        try {
            const privateKey = serviceAccountPrivateKey.replace(/\\n/g, '\n');
            const auth = new google.auth.JWT(
                serviceAccountEmail,
                undefined,
                privateKey,
                ['https://www.googleapis.com/auth/spreadsheets.readonly', 'https://www.googleapis.com/auth/spreadsheets']
            );
            const serviceHeaders = await auth.getRequestHeaders();
            if (serviceHeaders && serviceHeaders['Authorization']) {
                headerOptions.push({ 'Authorization': serviceHeaders['Authorization'] });
                console.log('[Proxy Sheet] Configured Google Service Account credentials fallback.');
            }
        } catch (e: any) {
            console.error('[Proxy Sheet] Failed to initialize Google Service Account JWT auth:', e.message);
        }
    }
    
    // Always append anonymous (no headers) option as the robust public baseline fallback
    headerOptions.push({});

    let lastError: any = null;
    let success = false;
    let resultBuffer: Buffer | null = null;

    // Try each fallback URL
    for (const url of urlsToTry) {
        if (success) break;
        
        // Try each header option
        for (const headers of headerOptions) {
            try {
                const headerType = headers['Authorization'] ? (headers['Authorization'].startsWith('Bearer ya29') ? 'Client OAuth Token' : 'Service Account Token') : 'Anonymous Public';
                console.log(`[Proxy Sheet] Server trying export URL: ${url} using Auth: ${headerType}`);
                
                const response = await fetch(url, { headers });
                if (!response.ok) {
                    throw new Error(`Google Sheets responded with HTTP status ${response.status} (${response.statusText})`);
                }
                
                const arrayBuffer = await response.arrayBuffer();
                if (arrayBuffer.byteLength > 100) {
                    const textSample = new TextDecoder('utf-8').decode(new Uint8Array(arrayBuffer.slice(0, 1000))).trim();
                    if (textSample.toLowerCase().startsWith('<!doctype html') || 
                        textSample.toLowerCase().startsWith('<html') ||
                        textSample.toLowerCase().includes('google-signin') || 
                        textSample.toLowerCase().includes('accounts.google.com')
                    ) {
                        throw new Error('Google Sheets returned an HTML login or private access page instead of spreadsheet data.');
                    }
                    
                    resultBuffer = Buffer.from(arrayBuffer);
                    success = true;
                    console.log(`[Proxy Sheet] Download successful via auth: ${headerType}. Bytes: ${arrayBuffer.byteLength}`);
                    break; // Exit headers loop
                } else {
                    throw new Error(`Returned content is too short (${arrayBuffer.byteLength} bytes)`);
                }
            } catch (e: any) {
                console.warn(`[Proxy Sheet] Individual attempt failed:`, e.message);
                lastError = e;
            }
        }
    }
    
    if (success && resultBuffer) {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        return res.send(resultBuffer);
    }
    
    console.error('❌ Server-side sheet proxy download completely failed:', lastError?.message);
    res.status(502).json({ 
        error: `Could not reach spreadsheet or any of its fallbacks: ${lastError?.message}. Ensure the sheet sharing settings are set to "Anyone with the link can view", or that the sheet is shared with the service account email: "${serviceAccountEmail || 'your-service-account'}" as an Editor.` 
    });
});

// --- Missing & Found Licenses cloud/disk synchronized persistence ---

app.get('/api/license/missing-licenses', async (req, res) => {
    try {
        let missingList: any[] = [];
        if (db) {
            try {
                const docRef = doc(db, 'lrms_system', 'missing_licenses_doc');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    missingList = docSnap.data().list || [];
                }
            } catch (err: any) {
                console.error('[Get Missing Licenses Firestore Err]:', err.message);
            }
        }
        
        // If empty and we have a local file backup, use it to ensure resilience
        if (missingList.length === 0 && fs.existsSync(MISSING_LICENSES_FILE)) {
            try {
                missingList = JSON.parse(fs.readFileSync(MISSING_LICENSES_FILE, 'utf-8')) || [];
            } catch (err: any) {
                console.error('[Get Missing Licenses file parse error]:', err.message);
            }
        }
        res.json(missingList);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/license/missing-licenses', async (req, res) => {
    const list = req.body;
    if (!Array.isArray(list)) {
        return res.status(400).json({ error: 'Body must be an array of missing license objects' });
    }
    try {
        const validatedList = list.slice(0, 10000); // Guard rails
        
        // Save to local filesystem first for ultra-fast local feedback
        fs.writeFileSync(MISSING_LICENSES_FILE, JSON.stringify(validatedList, null, 2), 'utf-8');
        
        // Backup to Firebase Firestore
        if (db) {
            try {
                const docRef = doc(db, 'lrms_system', 'missing_licenses_doc');
                await setDoc(docRef, { list: validatedList, lastUpdated: new Date().toISOString() });
            } catch (err: any) {
                console.error('[Post Missing Licenses Firestore Err]:', err.message);
            }
        }
        res.json({ success: true, count: validatedList.length });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/license/found-licenses', async (req, res) => {
    try {
        let foundList: any[] = [];
        if (db) {
            try {
                const docRef = doc(db, 'lrms_system', 'found_licenses_doc');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    foundList = docSnap.data().list || [];
                }
            } catch (err: any) {
                console.error('[Get Found Licenses Firestore Err]:', err.message);
            }
        }
        
        if (foundList.length === 0 && fs.existsSync(FOUND_LICENSES_FILE)) {
            try {
                foundList = JSON.parse(fs.readFileSync(FOUND_LICENSES_FILE, 'utf-8')) || [];
            } catch (err: any) {
                console.error('[Get Found Licenses file parse error]:', err.message);
            }
        }
        res.json(foundList);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/license/found-licenses', async (req, res) => {
    const list = req.body;
    if (!Array.isArray(list)) {
        return res.status(400).json({ error: 'Body must be an array of found license objects' });
    }
    try {
        const validatedList = list.slice(0, 10000); // Guard rails
        
        // Save to local filesystem first for ultra-fast local feedback
        fs.writeFileSync(FOUND_LICENSES_FILE, JSON.stringify(validatedList, null, 2), 'utf-8');
        
        // Backup to Firebase Firestore
        if (db) {
            try {
                const docRef = doc(db, 'lrms_system', 'found_licenses_doc');
                await setDoc(docRef, { list: validatedList, lastUpdated: new Date().toISOString() });
            } catch (err: any) {
                console.error('[Post Found Licenses Firestore Err]:', err.message);
            }
        }
        res.json({ success: true, count: validatedList.length });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Integrate Vite Dev Server in Development or Serve static items in Production
const port = 3000;
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
    if (!isProd) {
        console.log('🚀 Running in DEVELOPMENT mode. Initializing Vite middleware...');
        
        // Start express and hook in Vite middleware
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
            root: __dirname,
        });

        app.use(vite.middlewares);
        
        app.listen(port, '0.0.0.0', () => {
            console.log(`🌐 Server listening at http://0.0.0.0:${port}`);
        });
    } else {
        console.log('📦 Running in PRODUCTION mode. Serving static output /dist...');
        
        app.use(express.static(path.join(__dirname, 'dist')));
        
        app.get(/.*/, (req, res) => {
            res.sendFile(path.join(__dirname, 'dist', 'index.html'));
        });

        app.listen(port, '0.0.0.0', () => {
            console.log(`🌐 Production runner listening on http://0.0.0.0:${port}`);
        });
    }
}

startServer();
