// Storage facade — delegates to the active driver selected by STORAGE_DRIVER env.
// Callers import from this file exactly as before; the driver is swapped here only.
import { activeDriver } from './storage/index.js';

export const uploadFile = async (file, objectName) => {
  await activeDriver.put(file, objectName);
  return getFileUrl(objectName);
};

export const copyFile = (srcObjectName, destObjectName) =>
  activeDriver.copy(srcObjectName, destObjectName);

export const getFileStream = (objectName) => activeDriver.get(objectName);

export const deleteFile = (objectName) => activeDriver.delete(objectName);

export const deleteFiles = (objectNames) => activeDriver.deleteMany(objectNames);

export const getFileUrl = (objectName, expiry = 7 * 24 * 60 * 60) =>
  activeDriver.presign(objectName, expiry);

export const ensureBucketExists = () => activeDriver.ensureBucket();
