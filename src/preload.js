const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    selectFolder: inputId => {
        ipcRenderer.send('select-folder', inputId)
    },
    onFolderSelected: func => {
        ipcRenderer.on('folder-was-selected', (e, inputId, path) => func(inputId, path));
    },
    startBackup: (mediaPath, backupPath) => {
        ipcRenderer.send('start-backup', mediaPath, backupPath);
    },
    onProgressChanged: func => {
        ipcRenderer.on('progress-changed', (e, percent) => func(percent));
    },
    openBackupFolder: backupPath => {
        ipcRenderer.send('open-backup-folder', backupPath);
    },
    onBackupError: func => {
        ipcRenderer.on('backup-error', (e, errorMessage) => func(errorMessage));
    },
});