/**
 * pig.storage.ts
 * Simple file-based storage for pig names
 * In production, replace with a real database (PostgreSQL, MongoDB, etc.)
 */

import fs from 'fs';
import path from 'path';

const STORAGE_FILE = path.join(process.cwd(), 'data', 'pigs.json');

interface PigData {
  [pigId: string]: {
    name: string;
    namedAt: string;
  };
}

// Ensure data directory exists
function ensureDataDir() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Read all pig data
function readPigData(): PigData {
  ensureDataDir();
  
  if (!fs.existsSync(STORAGE_FILE)) {
    return {};
  }
  
  try {
    const content = fs.readFileSync(STORAGE_FILE, 'utf-8');
    // Strip BOM if present
    const cleanContent = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
    return cleanContent.trim() === '' ? {} : JSON.parse(cleanContent);
  } catch (err) {
    console.error('Error reading pig data:', err);
    return {};
  }
}

// Write all pig data
function writePigData(data: PigData): void {
  ensureDataDir();
  
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing pig data:', err);
    throw new Error('Failed to save pig data');
  }
}

/**
 * Get a pig's name by pigId
 */
export function getPigName(pigId: string): string | null {
  const data = readPigData();
  return data[pigId]?.name || null;
}

/**
 * Save a pig's name
 */
export function savePigName(pigId: string, name: string): void {
  const data = readPigData();
  data[pigId] = {
    name,
    namedAt: new Date().toISOString(),
  };
  writePigData(data);
}

/**
 * Check if a pig has been named
 */
export function isPigNamed(pigId: string): boolean {
  const data = readPigData();
  return !!data[pigId];
}

/**
 * Delete a pig's name (for testing/admin purposes)
 */
export function deletePigName(pigId: string): void {
  const data = readPigData();
  delete data[pigId];
  writePigData(data);
}
