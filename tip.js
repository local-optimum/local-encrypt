// Solana tipping functionality

// Your Solana SNS address
const SOL_ADDRESS = 'localoptimum.sol';

// Display the Solana address and set up copy functionality
document.addEventListener('DOMContentLoaded', () => {
    const solAddressElement = document.getElementById('solAddress');
    const copySolButton = document.getElementById('copySol');
    const solMessage = document.getElementById('solMessage');

    // Copy address to clipboard function
    const copyAddress = (e) => {
        e.preventDefault(); // Prevent link navigation
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
    };

    // Attach copy handler to both address and icon
    solAddressElement.addEventListener('click', copyAddress);
    copySolButton.addEventListener('click', copyAddress);
});