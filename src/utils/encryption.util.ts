import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY || '12345678901234567890123456789012'; // Must be 32 bytes
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const ITERATIONS = 100000;
const KEYLEN = 32;
const DIGEST = 'sha512';

export const encryptField = (text: string | null | undefined): string | null => {
    if (!text) return null;
    
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const salt = crypto.randomBytes(SALT_LENGTH);
        const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, ITERATIONS, KEYLEN, DIGEST);
        
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        
        const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        
        // Formato: salt:iv:tag:encryptedData
        return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
    } catch (e) {
        console.error('Error encrypting field', e);
        return text; // Fallback to plain text if error occurs
    }
};

export const decryptField = (encryptedText: string | null | undefined): string | null => {
    if (!encryptedText) return null;
    
    // Check if it's actually base64 encrypted text (basic heuristic)
    if (!encryptedText.includes('=') && encryptedText.length < 64) {
        return encryptedText; // Probably plain text from before encryption
    }

    try {
        const buffer = Buffer.from(encryptedText, 'base64');
        
        const salt = buffer.subarray(0, SALT_LENGTH);
        const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
        const tag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
        const textData = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
        
        const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, ITERATIONS, KEYLEN, DIGEST);
        
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);
        
        return decipher.update(textData) + decipher.final('utf8');
    } catch (e) {
        // console.error('Error decrypting field (maybe it was plain text)', e);
        return encryptedText; // If it fails, assume it was plain text
    }
};
