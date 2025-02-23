// Solana tipping functionality

// Your Solana SNS address
const SOL_ADDRESS = 'localoptimum.sol';

// Display the Solana address and set up copy functionality
document.addEventListener('DOMContentLoaded', () => {
    const solAddressElement = document.getElementById('solAddress');
    const copySolButton = document.getElementById('copySol');
    const solMessage = document.getElementById('solMessage');

    // Show the full SNS address
    solAddressElement.textContent = SOL_ADDRESS;

    // Copy address to clipboard when clicking the icon
    copySolButton.addEventListener('click', (e) => {
        e.preventDefault(); // Prevent any default behavior
        navigator.clipboard.writeText(SOL_ADDRESS).then(() => {
            solMessage.textContent = 'Address copied! Send via your Solana wallet.';
            solMessage.style.color = '#00ff00';
            setTimeout(() => {
                solMessage.textContent = '';
                solMessage.style.color = '#8b949e';
            }, 2000);
        }).catch((err) => {
            console.error('Copy failed:', err);
            solMessage.textContent = 'Failed to copy address.';
            solMessage.style.color = '#f4212e';
        });
    });
});