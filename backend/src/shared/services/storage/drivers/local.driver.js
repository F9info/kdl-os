import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';

const getStorageDir = () =>
  path.resolve(process.env.LOCAL_STORAGE_PATH || 'uploads/media');

const getBaseUrl = () =>
  process.env.LOCAL_STORAGE_BASE_URL ||
  process.env.BACKEND_URL ||
  `http://localhost:${process.env.APP_PORT || 4000}`;

const resolveFilePath = (objectName) =>
  path.join(getStorageDir(), objectName);

export const makeLocalDriver = () => ({
  async put(file, objectName) {
    const dest = resolveFilePath(objectName);
    await fsPromises.mkdir(path.dirname(dest), { recursive: true });
    await fsPromises.writeFile(dest, file.buffer);
  },

  async get(objectName) {
    return fs.createReadStream(resolveFilePath(objectName));
  },

  async delete(objectName) {
    await fsPromises.unlink(resolveFilePath(objectName)).catch((err) => {
      if (err.code !== 'ENOENT') throw err;
    });
  },

  async deleteMany(objectNames) {
    await Promise.all(objectNames.map((n) => this.delete(n)));
  },

  async presign(objectName) {
    return `${getBaseUrl()}/api/storage/local/${objectName}`;
  },

  async copy(srcObjectName, destObjectName) {
    const dest = resolveFilePath(destObjectName);
    await fsPromises.mkdir(path.dirname(dest), { recursive: true });
    await fsPromises.copyFile(resolveFilePath(srcObjectName), dest);
  },

  async ensureBucket() {
    await fsPromises.mkdir(getStorageDir(), { recursive: true });
  },
});
