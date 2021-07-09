const path = require('path');
const { app, BrowserWindow, Menu, ipcMain, dialog, Notification, shell } = require('electron');
const Backup = require('./Backup');

let win;

app.on('ready', () => {
    win = new BrowserWindow({
        useContentSize: true,
        height: process.platform == 'win32' ? 370 : 350, // hack
        width: 600,
        resizable: false,
        title: '',
        icon: path.join(__dirname, 'assets', 'icon.png'),
        webPreferences: {
            backgroundThrottling: false,
            preload: path.join(__dirname, 'preload.js'),
        }
    });

    win.loadFile(path.join(__dirname, 'main.html'));
    win.on('closed', () => app.quit());

    const menu = new Menu()
    Menu.setApplicationMenu(menu)
});

ipcMain.on('select-folder', (event, inputId) => {
    const dir = dialog.showOpenDialogSync(win, { properties: ['openDirectory', 'createDirectory'] })
    if (dir) {
        win.webContents.send('folder-was-selected', inputId, dir[0]);
    }
});

ipcMain.on('start-backup', (event, mediaPath, backupPath) => {
    const progressChangedCallback = progress => {
        win.webContents.send('progress-changed', progress);

        const progressNumber = progress == 100 ? -1 : progress / 100;
        win.setProgressBar(progressNumber);

        if (progress == 100) {
            const notification = new Notification({ title: 'Fotha Backup', body: 'Backup completed successfully' });
            notification.onclick = () => shell.openPath(backupPath);
            notification.show();
        }
    };

    const backuper = new Backup(mediaPath, backupPath,progressChangedCallback);

    try {
        backuper.make();
    } catch (error) {
        win.webContents.send('backup-error', error);
    }
});

ipcMain.on('open-backup-folder', (event, backupPath) => {
    shell.openPath(backupPath);
});