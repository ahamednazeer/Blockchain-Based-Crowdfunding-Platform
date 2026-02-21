import { ethers } from 'ethers';

// ABI for the CrowdFunding contract (minimal interface for frontend)
const CONTRACT_ABI = [
    "function createCampaign(string memory _title, string memory _description, string memory _category, uint256 _goal, uint256 _deadline, string memory _bannerCID) public payable returns (uint256)",
    "function donateToCampaign(uint256 _id) public payable",
    "function deleteCampaign(uint256 _id) public",
    "function pauseContract() public",
    "function resumeContract() public",
    "function withdrawCommissions(address payable _to, uint256 _amount) public",
    "function emergencyWithdrawAndStop(address payable _to) public",
    "function getCampaigns() public view returns (uint256[] memory, address[] memory, string[] memory, string[] memory, string[] memory, uint256[] memory, uint256[] memory, string[] memory, uint256[] memory, uint256[] memory, bool[] memory)",
    "function getCampaign(uint256 _id) public view returns (uint256, address, string memory, string memory, string memory, uint256, uint256, string memory, uint256, uint256, bool, address[] memory, uint256[] memory, uint256[] memory)",
    "function getDonors(uint256 _id) public view returns (address[] memory, uint256[] memory, uint256[] memory)",
    "function getUserContributions(address _user) public view returns (uint256[] memory, uint256[] memory, uint256[] memory)",
    "function getPlatformState() public view returns (uint256, uint256, uint256, uint256, bool, bool)",
    "function getCampaignCount() public view returns (uint256)",
    "function campaignCreationFee() public view returns (uint256)",
    "function paused() public view returns (bool)",
    "function emergencyStopped() public view returns (bool)",
    "function admin() public view returns (address)",
    "event CampaignCreated(uint256 indexed id, address indexed owner, string title, string category, uint256 goal, uint256 deadline, uint256 creationFeePaid)",
    "event DonationReceived(uint256 indexed campaignId, address indexed donor, uint256 amount)",
    "event CampaignDeleted(uint256 indexed campaignId, address indexed deletedBy)",
];

const NETWORK_HINT = 'Switch MetaMask to the Ganache network and retry.';

function getCombinedErrorMessage(error: any) {
    return [
        error?.reason,
        error?.shortMessage,
        error?.message,
        error?.info?.error?.message,
        error?.info?.error?.data?.reason,
        error?.error?.message,
        error?.data?.message,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}

function isDecodeOrCallFailure(error: any) {
    const code = error?.code || error?.cause?.code;
    const message = getCombinedErrorMessage(error);
    return (
        code === 'BAD_DATA' ||
        code === 'CALL_EXCEPTION' ||
        message.includes('could not decode result data') ||
        message.includes('execution reverted')
    );
}

function mapContractReadError(error: any, fallbackMessage: string) {
    if (!isDecodeOrCallFailure(error)) {
        return error;
    }
    return new Error(`${fallbackMessage} ${NETWORK_HINT}`);
}

function mapContractWriteError(error: any, fallbackMessage: string) {
    const code = error?.code ?? error?.info?.error?.code;
    const message = getCombinedErrorMessage(error);

    if (code === 4001 || code === 'ACTION_REJECTED') {
        return new Error('Transaction rejected in wallet.');
    }

    if (message.includes('contract permanently stopped') || message.includes('permanently stopped')) {
        return new Error('Contract is permanently stopped by emergency shutdown. Donations are disabled.');
    }

    if (message.includes('contract is paused')) {
        return new Error('Contract is paused by admin. Donations are temporarily disabled.');
    }

    if (message.includes('campaign is no longer active')) {
        return new Error('Campaign is inactive and cannot receive donations.');
    }

    if (message.includes('campaign deadline has passed')) {
        return new Error('Campaign deadline has passed. Donations are closed.');
    }

    if (message.includes('campaign does not exist')) {
        return new Error('Campaign does not exist on the current contract.');
    }

    if (message.includes('donation must be greater than zero')) {
        return new Error('Donation amount must be greater than zero.');
    }

    if (message.includes('only admin can perform this action')) {
        return new Error('Connected wallet is not the contract admin.');
    }

    if (message.includes('insufficient funds')) {
        return new Error('Insufficient funds to cover transaction value and gas.');
    }

    if (isDecodeOrCallFailure(error)) {
        return new Error(`${fallbackMessage} ${NETWORK_HINT}`);
    }

    return error instanceof Error ? error : new Error(fallbackMessage);
}

/**
 * Get ethers BrowserProvider from MetaMask.
 */
export function getProvider() {
    if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('MetaMask is not installed');
    }
    return new ethers.BrowserProvider(window.ethereum);
}

/**
 * Get a signer from MetaMask (the connected account).
 */
export async function getSigner() {
    const provider = getProvider();
    return await provider.getSigner();
}

/**
 * Get the contract instance connected to MetaMask signer.
 */
export async function getContract() {
    const signer = await getSigner();
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    if (!contractAddress) {
        throw new Error('Contract address not configured');
    }
    const provider = signer.provider;
    if (provider && typeof provider.getCode === 'function') {
        const code = await provider.getCode(contractAddress);
        if (!code || code === '0x') {
            throw new Error(`No contract deployed at ${contractAddress} on the selected wallet network. ${NETWORK_HINT}`);
        }
    }
    return new ethers.Contract(contractAddress, CONTRACT_ABI, signer);
}

/**
 * Get a read-only contract instance (no signer needed).
 */
export function getReadOnlyContract() {
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    if (!contractAddress) {
        throw new Error('Contract address not configured');
    }
    const provider = getProvider();
    return new ethers.Contract(contractAddress, CONTRACT_ABI, provider);
}

async function resolveCreationFeeWei(contract: ethers.Contract) {
    try {
        return await contract.campaignCreationFee();
    } catch (error) {
        if (!isDecodeOrCallFailure(error)) {
            throw error;
        }
    }

    try {
        const state = await contract.getPlatformState();
        return state[0];
    } catch (error) {
        throw mapContractReadError(error, 'Failed to read campaign creation fee from contract.');
    }
}

/**
 * Create a new campaign via smart contract.
 */
export async function createCampaign(
    title: string,
    description: string,
    category: string,
    goalInEth: string,
    deadline: number,
    bannerCID: string
) {
    try {
        const contract = await getContract();
        const goalInWei = ethers.parseEther(goalInEth);
        const creationFeeWei = await resolveCreationFeeWei(contract);
        const tx = await contract.createCampaign(
            title,
            description,
            category,
            goalInWei,
            deadline,
            bannerCID,
            {
                value: creationFeeWei,
            }
        );
        const receipt = await tx.wait();
        return receipt;
    } catch (error) {
        throw mapContractWriteError(error, 'Failed to create campaign.');
    }
}

/**
 * Donate to a campaign via smart contract.
 */
export async function donateToCampaign(campaignId: number, amountInEth: string) {
    try {
        const contract = await getContract();
        const tx = await contract.donateToCampaign(campaignId, {
            value: ethers.parseEther(amountInEth),
        });
        const receipt = await tx.wait();
        return receipt;
    } catch (error) {
        throw mapContractWriteError(error, 'Failed to donate to campaign.');
    }
}

/**
 * Read campaign creation fee from contract (ETH display value).
 */
export async function getCampaignCreationFeeEth() {
    try {
        const contract = getReadOnlyContract();
        const feeWei = await resolveCreationFeeWei(contract);
        return {
            wei: feeWei.toString(),
            eth: ethers.formatEther(feeWei),
        };
    } catch (error) {
        throw mapContractReadError(error, 'Failed to read campaign creation fee.');
    }
}

export async function pauseContractOnChain() {
    try {
        const contract = await getContract();
        const tx = await contract.pauseContract();
        return await tx.wait();
    } catch (error) {
        throw mapContractWriteError(error, 'Failed to pause contract.');
    }
}

export async function resumeContractOnChain() {
    try {
        const contract = await getContract();
        const tx = await contract.resumeContract();
        return await tx.wait();
    } catch (error) {
        throw mapContractWriteError(error, 'Failed to resume contract.');
    }
}

export async function deleteCampaignOnChain(campaignId: number) {
    try {
        const contract = await getContract();
        const tx = await contract.deleteCampaign(campaignId);
        return await tx.wait();
    } catch (error) {
        throw mapContractWriteError(error, 'Failed to deactivate campaign.');
    }
}

export async function withdrawCommissionsOnChain(amountEth: string, to?: string) {
    try {
        const contract = await getContract();
        const signer = await getSigner();
        const recipient = to || await signer.getAddress();
        if (!ethers.isAddress(recipient)) {
            throw new Error('Invalid recipient address.');
        }
        const amountWei = ethers.parseEther(amountEth);
        const tx = await contract.withdrawCommissions(recipient, amountWei);
        return await tx.wait();
    } catch (error) {
        throw mapContractWriteError(error, 'Failed to withdraw commissions.');
    }
}

export async function emergencyWithdrawAndStopOnChain(to?: string) {
    try {
        const contract = await getContract();
        const signer = await getSigner();
        const recipient = to || await signer.getAddress();
        if (!ethers.isAddress(recipient)) {
            throw new Error('Invalid recipient address.');
        }
        const tx = await contract.emergencyWithdrawAndStop(recipient);
        return await tx.wait();
    } catch (error) {
        throw mapContractWriteError(error, 'Failed to execute emergency stop.');
    }
}

// Ethereum window type declaration
declare global {
    interface Window {
        ethereum?: any;
    }
}
