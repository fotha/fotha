document.querySelectorAll('.form-group').forEach(group => {
    group.addEventListener('click', e => {
        if (e.target.tagName === 'INPUT') {
            window.api.selectFolder(e.target.id);
        }
    });
});

window.api.onFolderSelected((inputId, path) => {
    const input = document.querySelector('#' + inputId);
    input.value = path;
});

document.querySelector('.form-button').addEventListener('click', e => {

    hideMessage();

    let ready = true;

    const inputs = document.querySelectorAll('.form-input');
    inputs.forEach(input => {
        if (!input.value) {
            ready = false;
            input.classList.add('input-empty');
            setTimeout(() => input.classList.remove('input-empty'), 2000);
            showMessage('Select media and backup folders');
        }
    });

    if (inputs[0].value && inputs[1].value && inputs[0].value == inputs[1].value) {
        ready = false;
        showMessage('Select a different folder for backup');
    }

    if (!ready) return;

    startBackuping();

    window.api.startBackup(inputs[0].value, inputs[1].value);
});

window.api.onProgressChanged((newPercent) => {
    const button = document.querySelector('.form-button-inprogress');
    const currentPercent = button.dataset.percent;
    if (newPercent > currentPercent) {
        button.dataset.percent = newPercent;
        button.style.setProperty('--percent', `${newPercent}%`);
    }
    if (newPercent == 100) {
        endBackuping();
        showMessage('<span class="link" onclick="openBackupFolder()">Backup completed '
            + 'successfully. Click here to open backup folder</a>');
    }
});

window.api.onBackupError(error => {
    endBackuping();
    showMessage(error);
});

function showMessage(text) {
    const message = document.querySelector('.message');
    message.innerHTML = text;
    message.style.visibility = 'visible';
}

function hideMessage() {
    const message = document.querySelector('.message');
    message.style.visibility = '';
}

function openBackupFolder() {
    const backupFolder = document.querySelector('#select-backup-folder').value;
    window.api.openBackupFolder(backupFolder);
}

function startBackuping() {
    document.body.classList.add('body-disabled');

    const button = document.querySelector('.form-button');
    button.innerHTML = 'Backup in progress...';
    button.classList.add('form-button-inprogress');
}

function endBackuping() {
    document.body.classList.remove('body-disabled');

    const button = document.querySelector('.form-button-inprogress');
    button.innerHTML = 'Backup files';
    button.classList.remove('form-button-inprogress');
    button.dataset.percent = 0;
    button.style.setProperty('--percent', '0%');
}