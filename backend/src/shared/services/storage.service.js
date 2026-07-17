// Storage facade — delegates to the active driver resolved from app_settings (DB-first, env fallback).
// uploadFile automatically falls back to local FS when no remote is configured or a remote write fails.
import { getActiveDriver, makeDriver } from './storage/index.js';
import { getStorageConfig } from './storage/config.js';
import { makeLocalDriver } from './storage/drivers/local.driver.js';
import { logger } from '../utils/logger.js';

export const uploadFile = async (file, objectName) => {
  const config = await getStorageConfig();
  const driver = await getActiveDriver();

  if (config.provider === 'local') {
    await driver.put(file, objectName);
    return driver.presign(objectName);
  }

  try {
    await driver.put(file, objectName);
    return driver.presign(objectName);
  } catch (err) {
    logger.warn(`storage: remote upload failed for "${objectName}" (${err.message}) — falling back to local`);
    const local = makeLocalDriver();
    try {
      await local.put(file, objectName);
      return local.presign(objectName);
    } catch (localErr) {
      logger.error(`storage: local fallback upload also failed: ${localErr.message}`);
      throw Object.assign(
        new Error('Storage unavailable — remote and local both failed'),
        { status: 503 }
      );
    }
  }
};

export const copyFile = async (srcObjectName, destObjectName) => {
  const driver = await getActiveDriver();
  return driver.copy(srcObjectName, destObjectName);
};

export const getFileStream = async (objectName) => {
  const driver = await getActiveDriver();
  return driver.get(objectName);
};

export const deleteFile = async (objectName) => {
  const driver = await getActiveDriver();
  return driver.delete(objectName);
};

export const deleteFiles = async (objectNames) => {
  if (!objectNames.length) return;
  const driver = await getActiveDriver();
  return driver.deleteMany(objectNames);
};

export const getFileUrl = async (objectName, expiry = 7 * 24 * 60 * 60) => {
  const driver = await getActiveDriver();
  return driver.presign(objectName, expiry);
};

export const ensureBucketExists = async () => {
  const driver = await getActiveDriver();
  return driver.ensureBucket();
};

// One-off driver for a given config (used by Test Connection API).
export const makeDriverFromConfig = (config) => makeDriver(config);
