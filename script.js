// Load zxcvbn for passphrase strength checking from a CDN
const zxcvbnScript = document.createElement('script');
zxcvbnScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/zxcvbn/4.4.2/zxcvbn.js';
document.head.appendChild(zxcvbnScript);

// --- Key Derivation ---
// Turns a user-entered key into a secure AES key using PBKDF2
async function deriveKey(key, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(key),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );
    return window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 1000000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

// --- Checksum Calculation ---
// Generates a SHA-256 hash to verify file integrity
async function calculateChecksum(data) {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hashBuffer);
}

// --- File Encryption ---
// Encrypts a file with AES-GCM, embedding salt, IV, checksum, and filetype
async function encryptFile(file, key) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const cryptoKey = await deriveKey(key, salt);
    
    const fileData = await file.arrayBuffer();
    const encryptedData = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        cryptoKey,
        fileData
    );

    const checksum = await calculateChecksum(fileData);
    const fileType = file.type || 'application/octet-stream';
    const fileTypeArray = new TextEncoder().encode(fileType);
    const fileTypeLength = new Uint16Array([fileTypeArray.length]);

    const combinedData = new Uint8Array(
        16 + 12 + 32 + 2 + fileTypeArray.length + encryptedData.byteLength
    );
    let offset = 0;
    combinedData.set(salt, offset); offset += 16;
    combinedData.set(iv, offset); offset += 12;
    combinedData.set(checksum, offset); offset += 32;
    combinedData.set(new Uint8Array(fileTypeLength.buffer), offset); offset += 2;
    combinedData.set(fileTypeArray, offset); offset += fileTypeArray.length;
    combinedData.set(new Uint8Array(encryptedData), offset);

    return combinedData;
}

// --- File Decryption ---
// Decrypts a file, verifies checksum, and returns data with original filetype
async function decryptFile(fileData, key) {
    let offset = 0;
    const salt = new Uint8Array(fileData.slice(offset, offset + 16)); offset += 16;
    const iv = new Uint8Array(fileData.slice(offset, offset + 12)); offset += 12;
    const checksum = new Uint8Array(fileData.slice(offset, offset + 32)); offset += 32;
    const fileTypeLength = new Uint16Array(fileData.slice(offset, offset + 2))[0]; offset += 2;
    const fileType = new TextDecoder().decode(fileData.slice(offset, offset + fileTypeLength)); offset += fileTypeLength;
    const encryptedData = fileData.slice(offset);

    const cryptoKey = await deriveKey(key, salt);
    try {
        const decryptedData = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            cryptoKey,
            encryptedData
        );

        const decryptedChecksum = await calculateChecksum(decryptedData);
        if (!decryptedChecksum.every((val, idx) => val === checksum[idx])) {
            throw new Error('Checksum mismatch—file may be corrupted.');
        }

        return { data: decryptedData, type: fileType };
    } catch (error) {
        console.error('Decryption error:', error);
        throw error;
    }
}

// --- Key Generation ---
// Creates a random 16-byte key, encoded as base64
function generateRandomKey() {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array));
}

// --- Progress Animation ---
// Shows an illustrative progress bar animation during encrypt/decrypt
function showProgress(progressBar, callback) {
    progressBar.style.width = '0%';
    let width = 0;
    const interval = setInterval(() => {
        width += 10;
        progressBar.style.width = `${width}%`;
        if (width >= 100) clearInterval(interval);
    }, 50);
    callback().finally(() => setTimeout(() => width = 100, 500));
}

// --- Download Trigger ---
// Programmatically triggers a file download since we’re using a button
function triggerDownload(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- File Selection Handler ---
// Updates UI when a file is selected, shows clear text
function handleFileSelect(file) {
    const fileInput = document.getElementById('fileInput');
    const dropText = document.getElementById('fileDropText');
    const selectedText = document.getElementById('fileSelectedText');
    const clearText = document.getElementById('clearSelection');
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;
    dropText.style.display = 'none';
    selectedText.textContent = `Selected: ${file.name}`;
    selectedText.style.display = 'block';
    clearText.style.display = 'block';
}

// --- Event Listeners ---

// Generate a random key and show copy icon
document.getElementById('generateKeyButton').addEventListener('click', () => {
    const key = generateRandomKey();
    document.getElementById('keyInput').value = key;
    const warning = document.createElement('div');
    warning.id = 'keyWarning';
    warning.textContent = 'Save this key securely! Lost keys mean lost files.';
    warning.style.color = '#ff4444';
    document.getElementById('keyMessage').innerHTML = '';
    document.getElementById('keyMessage').appendChild(warning);
    setTimeout(() => warning.remove(), 5000);
    document.getElementById('copyKey').style.display = 'inline-block';
});

// Validate key input and show strength with zxcvbn
document.getElementById('keyInput').addEventListener('input', function() {
    const keyMessage = document.getElementById('keyMessage');
    const copyIcon = document.getElementById('copyKey');
    keyMessage.innerHTML = '';
    this.classList.toggle('error', this.value.length < 16);
    if (this.value.length < 16) {
        keyMessage.textContent = 'Key must be at least 16 characters.';
        copyIcon.style.display = 'none';
    } else {
        if (window.zxcvbn) {
            const result = zxcvbn(this.value);
            const strength = ['Weak', 'Fair', 'Good', 'Strong', 'Very Strong'][result.score];
            keyMessage.textContent = `Strength: ${strength}`;
            keyMessage.style.color = ['#ff4444', '#ffbb33', '#00bb00', '#00dd00', '#00ff00'][result.score];
        }
        copyIcon.style.display = 'inline-block';
    }
});

// Copy key to clipboard with feedback
document.getElementById('copyKey').addEventListener('click', () => {
    const keyInput = document.getElementById('keyInput');
    navigator.clipboard.writeText(keyInput.value).then(() => {
        const keyMessage = document.getElementById('keyMessage');
        const prevMessage = keyMessage.textContent;
        keyMessage.textContent = 'Key copied!';
        keyMessage.style.color = '#00ff00';
        setTimeout(() => {
            keyMessage.textContent = prevMessage;
            keyMessage.style.color = prevMessage.includes('Weak') ? '#ff4444' : '#8b949e';
        }, 2000);
    });
});

// Handle file input changes (click selection)
document.getElementById('fileInput').addEventListener('change', (event) => {
    if (event.target.files[0]) handleFileSelect(event.target.files[0]);
});

// Drag-and-drop handlers for file input
const fileInputContainer = document.getElementById('fileInputContainer');
fileInputContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileInputContainer.classList.add('dragover');
});
fileInputContainer.addEventListener('dragleave', () => {
    fileInputContainer.classList.remove('dragover');
});
fileInputContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
    fileInputContainer.classList.remove('dragover');
});

// Clear file selection when clicking the text
document.getElementById('clearSelection').addEventListener('click', () => {
    const fileInput = document.getElementById('fileInput');
    const dropText = document.getElementById('fileDropText');
    const selectedText = document.getElementById('fileSelectedText');
    const clearText = document.getElementById('clearSelection');
    fileInput.value = '';
    dropText.style.display = 'block';
    selectedText.style.display = 'none';
    clearText.style.display = 'none';
});

// Encrypt button: encrypts file and sets up download
document.getElementById('encryptButton').addEventListener('click', async () => {
    const fileInput = document.getElementById('fileInput');
    const keyInput = document.getElementById('keyInput');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const downloadLink = document.getElementById('downloadLink');
    
    if (!fileInput.files.length || keyInput.value.length < 16) {
        alert('Please select a file and enter a key (16+ characters).');
        return;
    }

    const file = fileInput.files[0];
    progressContainer.style.display = 'block';
    downloadLink.style.display = 'none';

    showProgress(progressBar, async () => {
        try {
            const combinedData = await encryptFile(file, keyInput.value);
            const blob = new Blob([combinedData], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            downloadLink.style.display = 'block';
            downloadLink.textContent = 'Download Encrypted File';
            downloadLink.onclick = () => triggerDownload(url, 'encrypted.enc');
        } catch (error) {
            alert('Encryption failed: ' + error.message);
        } finally {
            setTimeout(() => progressContainer.style.display = 'block', 1000);
        }
    });
});

// Decrypt button: decrypts file and sets up download
document.getElementById('decryptButton').addEventListener('click', async () => {
    const fileInput = document.getElementById('fileInput');
    const keyInput = document.getElementById('keyInput');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const downloadLink = document.getElementById('downloadLink');
    
    if (!fileInput.files.length || keyInput.value.length < 16) {
        alert('Please select an encrypted file and enter a key (16+ characters).');
        return;
    }

    const file = fileInput.files[0];
    const fileData = await file.arrayBuffer();
    progressContainer.style.display = 'block';
    downloadLink.style.display = 'none';

    showProgress(progressBar, async () => {
        try {
            const { data, type } = await decryptFile(fileData, keyInput.value);
            const blob = new Blob([data], { type });
            const url = URL.createObjectURL(blob);
            downloadLink.style.display = 'block';
            downloadLink.textContent = 'Download Decrypted File';
            downloadLink.onclick = () => triggerDownload(url, 'decrypted');
        } catch (error) {
            alert('Decryption failed: ' + error.message);
        } finally {
            setTimeout(() => progressContainer.style.display = 'block', 1000);
        }
    });
});