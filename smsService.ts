import dotenv from 'dotenv';

dotenv.config();

export interface OTPRecord {
    username: string;
    otp: string;
    expiresAt: number;
    attempts: number;
    mobileNumber: string;
    lastSentAt: number;
}

// In-memory OTP storage dictionary
const otpStore = new Map<string, OTPRecord>();

// Log database for security audits
export interface SMSLog {
    timestamp: string;
    username: string;
    mobileNumber: string;
    status: 'delivered' | 'failed' | 'simulated';
    message: string;
    details?: string;
}
export const smsLogs: SMSLog[] = [];

/**
 * Clears any country code, spaces, dashes in Nepal mobile numbers to yield raw 10 digits
 */
export function cleanNepalMobile(phone: string): string {
    let clean = String(phone || '').trim().replace(/[\s\-\(\)\+]/g, '');
    if (clean.startsWith('977')) {
        clean = clean.substring(3);
    }
    return clean;
}

/**
 * Validates standard Nepal mobile network number.
 * Must be active prefix 98xxx, 97xxx, 96xxx, or 99xxx, and exactly 10 digits.
 */
export function isValidNepalMobile(phone: string): boolean {
    const cleaned = cleanNepalMobile(phone);
    const regex = /^(98|97|96|99)\d{8}$/;
    return regex.test(cleaned);
}

/**
 * Generates secure random 6-digit numeric OTP.
 */
export function generateOTP(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Sends OTP SMS using either Sparrow SMS, Aakash SMS, or Simulated Gateway.
 */
export async function sendOtpSms(username: string, mobileNumber: string): Promise<{
    status: 'delivered' | 'failed' | 'simulated';
    message: string;
    expiresInSeconds: number;
}> {
    const targetMobile = cleanNepalMobile(mobileNumber);
    if (!isValidNepalMobile(targetMobile)) {
        throw new Error(`गलत नेपाली मोबाइल नम्बर हालियो! ${mobileNumber} must be 10 digits Nepal mobile prefix.`);
    }

    const now = Date.now();
    const existing = otpStore.get(username.toLowerCase());
    
    // Antispam limit protection: prevent resending within 15 seconds
    if (existing && (now - existing.lastSentAt) < 15000) {
        throw new Error('OTP Spam protection activated. Please wait 15 seconds before resending.');
    }

    const otpCode = generateOTP();
    const expirationMs = 120 * 1000; // 120 seconds (2 minute timer)
    const expiresAt = now + expirationMs;

    // Save/update OTP record
    otpStore.set(username.toLowerCase(), {
        username: username.toLowerCase(),
        otp: otpCode,
        expiresAt,
        attempts: 0,
        mobileNumber: targetMobile,
        lastSentAt: now
    });

    const smsMessage = `LRMS Verification Code is: ${otpCode}. Valid for 2 minutes. Do not share.`;
    const gatewayUrl = process.env.SMS_API_GATEWAY_URL;
    const apiKey = process.env.SMS_API_KEY;

    // If real SMS gateway URL or config is defined
    if (gatewayUrl && apiKey) {
        let attempt = 0;
        const maxRetries = 2;
        let success = false;
        let errorMsg = '';

        while (attempt <= maxRetries && !success) {
            try {
                attempt++;
                let finalUrl = '';
                
                if (gatewayUrl.includes('sparrowsms.com')) {
                    // Sparrow SMS layout
                    finalUrl = `${gatewayUrl}?token=${encodeURIComponent(apiKey)}&from=Demo&to=${encodeURIComponent(targetMobile)}&text=${encodeURIComponent(smsMessage)}`;
                } else if (gatewayUrl.includes('aakashsms.com')) {
                    // Aakash SMS layout
                    finalUrl = `${gatewayUrl}?auth_token=${encodeURIComponent(apiKey)}&to=${encodeURIComponent(targetMobile)}&text=${encodeURIComponent(smsMessage)}`;
                } else {
                    // Generic Gateway
                    const joiner = gatewayUrl.includes('?') ? '&' : '?';
                    finalUrl = `${gatewayUrl}${joiner}apiKey=${encodeURIComponent(apiKey)}&to=${encodeURIComponent(targetMobile)}&message=${encodeURIComponent(smsMessage)}`;
                }

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 6000);
                
                const response = await fetch(finalUrl, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (response.ok) {
                    success = true;
                } else {
                    errorMsg = `Server returned status: ${response.status}`;
                }
            } catch (err: any) {
                errorMsg = err.message;
            }
        }

        if (success) {
            const logEntry: SMSLog = {
                timestamp: new Date().toISOString(),
                username,
                mobileNumber: targetMobile,
                status: 'delivered',
                message: smsMessage,
                details: `Gateway acknowledged delivery on attempt ${attempt}`
            };
            smsLogs.push(logEntry);
            console.log(`📡 [SMS SUCCESS] OTP sent to ${targetMobile}: ${smsMessage}`);
            return {
                status: 'delivered',
                message: `OTP sent successfully to ${targetMobile}`,
                expiresInSeconds: 120
            };
        } else {
            const logEntry: SMSLog = {
                timestamp: new Date().toISOString(),
                username,
                mobileNumber: targetMobile,
                status: 'failed',
                message: smsMessage,
                details: `Gateway error after ${attempt} attempts: ${errorMsg}`
            };
            smsLogs.push(logEntry);
            console.error(`❌ [SMS GATEWAY FAILED]: ${errorMsg}`);
            
            // Auto fallback to local simulated logs, so it does NOT crash login
            console.warn(`💡 [SMS Fallback Logged] Since gateway failed, code was logged: OTP CODE: ${otpCode}`);
            return {
                status: 'simulated',
                message: `SMS Gateway Error (${errorMsg}). Dispatch simulated successfully in logs.`,
                expiresInSeconds: 120
            };
        }
    } else {
        // Mock Gateway Simulation
        const logEntry: SMSLog = {
            timestamp: new Date().toISOString(),
            username,
            mobileNumber: targetMobile,
            status: 'simulated',
            message: smsMessage,
            details: 'Credentials absent in .env, simulated in-app.'
        };
        smsLogs.push(logEntry);
        console.log(`📱 [SIMULATED SMS GATEWAY] To: ${targetMobile} => "${smsMessage}"`);
        return {
            status: 'simulated',
            message: `OTP logged on terminal. Code: ${otpCode}`,
            expiresInSeconds: 120
        };
    }
}

/**
 * Checks and clears OTP entry record if valid match found.
 */
export function verifyOtpCode(username: string, inputCode: string): boolean {
    const record = otpStore.get(username.toLowerCase());
    if (!record) return false;

    // Check expiration
    if (Date.now() > record.expiresAt) {
        otpStore.delete(username.toLowerCase());
        throw new Error('नेपाली समय: OTP को समय सीमा सकियो। (OTP code has expired!)');
    }

    // Check brute force limits (max 3 tries per generated OTP)
    if (record.attempts >= 3) {
        otpStore.delete(username.toLowerCase());
        throw new Error('OTP को प्रयास सीमा नाघ्यो! नयाँ थप्नुहोस् (Too many false OTP attempts. Code invalidated.)');
    }

    if (record.otp === inputCode.trim()) {
        otpStore.delete(username.toLowerCase()); // verified, delete
        return true;
    } else {
        record.attempts++;
        throw new Error(`गलत OTP कोड! (Invalid OTP. Match comparison failed! Attempts: ${record.attempts}/3)`);
    }
}

/**
 * Helper to retrieve current simulated/logged OTP status (for debug or frontend rendering fallback)
 */
export function getSimulatedOtpForUser(username: string): string | null {
    const record = otpStore.get(username.toLowerCase());
    if (record && Date.now() < record.expiresAt) return record.otp;
    return null;
}
