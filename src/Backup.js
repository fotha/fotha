'use strict';

const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const exifReader = require('exifreader')

const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static-electron').path;
const ffprobePath = require('ffprobe-static-electron').path;
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

module.exports = class Backup {
    photosDir = 'photos';
    imagesDir = 'images'
    videosDir = 'videos';

    excludedFileNames = ['.', '..', 'Thumbs.db', 'Thumbs.db:encryptable', 'desktop.ini'];

    videoFileExtensions = ['.mov', '.mp4'];
    imageFileExtensions = ['.jpg', '.jpeg', '.gif', '.png', '.heic', '.heif'];
    exifExtensions = ['.jpg', '.jpeg', '.png', '.heic', '.heif'];

    progress = 0;

    hashesFileName = '.hashes';

    fileHexLength = 8;

    constructor(mediaPath, backupPath, progressChangedCallback) {
        this.mediaPath = mediaPath;
        this.backupPath = backupPath;
        this.progressChangedCallback = progressChangedCallback;
    }

    async make() {
        await this.isValidFolders();

        const backupHashes = await this.getBackupHashes();

        const mediaFiles = [];
        await this.readDir(this.mediaPath, mediaFiles);

        const copiedFilesHashes = {};

        for (let i = 0, len = mediaFiles.length; i < len; i++) {
            const filePath = mediaFiles[i];

            const fileData = await fs.readFile(filePath);
            const sha1 = crypto.createHash('sha1').update(fileData).digest('hex');

            if (backupHashes.hasOwnProperty(sha1)) {
                this.calcProgress(i, len);
                continue;
            }

            await this.copyFile(filePath, fileData);

            copiedFilesHashes[sha1] = true;

            this.calcProgress(i, len);
        }

        await this.saveHashes(backupHashes, copiedFilesHashes);

        if (this.progress !== 100) {
            this.setProgress(100);
        }
    }

    async isValidFolders() {
        if (!this.mediaPath || !this.backupPath) {
            throw 'Select media and backup folders';
        }
        if (this.mediaPath == this.backupPath) {
            throw 'Select a different folder for backup';
        }

        let isValidMediaPath = false;
        let isValidBackupPath = false;

        try {
            isValidMediaPath = await this.isDirectory(this.mediaPath);
            isValidBackupPath = await this.isDirectory(this.backupPath);
        } catch (e) {
            throw 'Folders do not exist or access is denied';
        }

        if (!isValidMediaPath || !isValidBackupPath) {
            throw 'Folders do not exist or access is denied';
        }
    }

    setProgress(progress) {
        this.progress = progress;
        this.progressChangedCallback(progress);
    }

    async getBackupHashes() {
        const backupHashes = {};

        const filePath = path.join(this.backupPath, this.hashesFileName);
        const isFileExists = await this.isFileExists(filePath);

        if (!isFileExists) {
            return backupHashes;
        }

        const data = await fs.readFile(filePath);
        const hashes = data.toString().split(/\r\n|\n/);
        hashes.forEach(hash => {
            backupHashes[hash] = true;
        });

        return backupHashes;
    }

    // recursive
    async readDir(dirPath, filesList) {
        const ls = await fs.readdir(dirPath);

        for (let i = 0, len = ls.length; i < len; i++) {
            const file = ls[i];

            const filePath = path.join(dirPath, file);

            const isDirectory = await this.isDirectory(filePath);
            if (isDirectory) {
                await this.readDir(filePath, filesList);
                continue;
            }

            if (this.excludedFileNames.includes(file)) {
                continue;
            }

            if (this.isSupportedFileExtension(file)) {
                filesList.push(filePath);
            }
        }
    }

    calcProgress(current, total) {
        current++;
        const percent = Math.floor(current * 100 / total);
        if (percent > this.progress) {
            this.setProgress(percent);
        }
    }

    isSupportedFileExtension(file) {
        const ext = this.getFileExtension(file);
        return this.isImageExtension(ext) || this.isVideoExtension(ext);
    }

    isImageExtension(ext) {
        return ext && this.imageFileExtensions.includes(ext);
    }

    isVideoExtension(ext) {
        return ext && this.videoFileExtensions.includes(ext);
    }

    getFileExtension(file) {
        return path.extname(file).toLowerCase();
    }

    getExifDate(fileData) {
        let exif = undefined;

        try {
            exif = exifReader.load(fileData)
        } catch (e) {
            return exif;
        }

        const dateTimeOriginal = exif['DateTimeOriginal']?.description;
        const makeCondition = true; //this.isExifMakeApple(exif);
        if (dateTimeOriginal && makeCondition) {
            const d = dateTimeOriginal.split(/\D/);
            return new Date(d[0], d[1] - 1, d[2], d[3], d[4], d[5]);
        }
    }

    // It is not used
    isExifMakeApple(exif) {
        return String(exif['Make']?.description).toLowerCase() == 'apple';
    }

    async getFileCopyPath(filePath, fileData) {
        let copyPath;

        const ext = this.getFileExtension(filePath);

        if (this.isVideoExtension(ext)) {
            copyPath = await this.getVideoFileCopyPath(filePath, ext);
        } else {
            copyPath = this.getImageFileCopyPath(fileData, ext);
        }

        return copyPath;
    }

    async getVideoFileCopyPath(filePath, ext) {
        const date = await this.getVideoDate(filePath);
        const copyPath = date ? this.getDateFileName(date, ext) : this.getFileName(ext);
        const dir = date ? this.videosDir : path.join(this.videosDir, 'unsorted');

        return path.join(dir, copyPath);
    }

    getImageFileCopyPath(fileData, ext) {
        const date = this.exifExtensions.includes(ext) ? this.getExifDate(fileData) : null;
        const copyPath = date ? this.getDateFileName(date, ext) : this.getFileName(ext);
        const dir = date ? this.photosDir : this.imagesDir;

        return path.join(dir, copyPath);
    }

    getDateFileName(date, ext) {
        const year = date.getFullYear().toString();
        const fileName = this.getFileDate(date) + this.getRandomString(4) + ext;

        return path.join(year, fileName);
    }

    getFileName(ext) {
        return this.getRandomString(this.fileHexLength) + ext;
    }

    getRandomString(size) {
        return crypto.randomBytes(size / 2).toString('hex');
    }

    getFileDate(date) {
        const year = date.getFullYear();
        const month = this.padZeroDatePart(date.getMonth() + 1);
        const day = this.padZeroDatePart(date.getDate());
        const hours = this.padZeroDatePart(date.getHours());
        const minutes = this.padZeroDatePart(date.getMinutes());

        return `${year}-${month}-${day}-${hours}-${minutes}_`;
    }

    padZeroDatePart(datePart) {
        if (datePart < 10) {
            return '0' + datePart.toString();
        }
        return datePart.toString();
    }

    async copyFile(filePath, fileData) {
        let fileCopyPath = await this.getFileCopyPath(filePath, fileData);
        let copyPath = path.join(this.backupPath, fileCopyPath);

        let isFileExists = await this.isFileExists(copyPath);
        while (isFileExists) {
            fileCopyPath = await this.getFileCopyPath(filePath, fileData);
            copyPath = path.join(this.backupPath, fileCopyPath);
            isFileExists = await this.isFileExists(copyPath);
        }

        const copyDirPath = path.dirname(copyPath);

        const isDirExists = await this.isFileExists(copyDirPath);
        if (!isDirExists) {
            await fs.mkdir(copyDirPath, { mode: '0755', recursive: true });
        }

        await fs.writeFile(copyPath, fileData, { 'mode': '0755' });
    }

    async saveHashes(backupHashes, copiedFilesHashes) {
        const hashes = Object.keys(Object.assign(backupHashes, copiedFilesHashes));
        const data = hashes.join(os.EOL);
        const filePath = path.join(this.backupPath, this.hashesFileName);

        await fs.writeFile(filePath, data, { 'mode': '0755' });
    }

    async getFileStat(filePath) {
        let stat;

        try {
            stat = await fs.stat(filePath)
        } catch (error) {
            if (error.code != 'ENOENT') {
                throw error;
            }
        }

        return stat;
    }

    async isFileExists(filePath) {
        const stat = await this.getFileStat(filePath);

        return !!stat;
    }

    async isDirectory(filePath) {
        let isDirectory = false;
        const stat = await fs.stat(filePath);
        if (stat) {
            isDirectory = stat.isDirectory();
        }

        return isDirectory;
    }

    async getVideoDate(filePath) {
        return new Promise(resolve => {
            ffmpeg.ffprobe(filePath, (error, metadata) => {
                let date;
                const creationTime = metadata?.format?.tags?.['creation_time'];
                if (creationTime) {
                    date = new Date(creationTime);
                }
                resolve(date);
            });
        });
    }
}
