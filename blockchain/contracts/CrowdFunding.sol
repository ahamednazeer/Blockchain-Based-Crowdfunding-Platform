// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title CrowdFunding
 * @dev Decentralized crowdfunding platform smart contract.
 *      Supports campaign launch, donations, admin moderation, monetization,
 *      pause/resume controls, and emergency shutdown.
 */
contract CrowdFunding {
    // ── Structs ──────────────────────────────────────────────────────
    struct Campaign {
        uint256 id;
        address owner;
        string title;
        string description;
        string category;
        uint256 goal;
        uint256 deadline;
        string bannerCID;
        uint256 amountCollected;
        uint256 createdAt;
        bool isActive;
        address[] donators;
        uint256[] donations;
        uint256[] donationTimestamps;
    }

    struct Contribution {
        uint256 campaignId;
        uint256 amount;
        uint256 timestamp;
    }

    // ── State Variables ──────────────────────────────────────────────
    address public admin;
    uint256 public numberOfCampaigns = 0;
    uint256 public campaignCreationFee;
    uint256 public totalCommissionsCollected;
    bool public paused;
    bool public emergencyStopped;

    mapping(uint256 => Campaign) public campaigns;
    mapping(address => Contribution[]) private contributionHistory;

    // ── Events ───────────────────────────────────────────────────────
    event CampaignCreated(
        uint256 indexed id,
        address indexed owner,
        string title,
        string category,
        uint256 goal,
        uint256 deadline,
        uint256 creationFeePaid
    );

    event DonationReceived(
        uint256 indexed campaignId,
        address indexed donor,
        uint256 amount
    );

    event CampaignDeleted(
        uint256 indexed campaignId,
        address indexed deletedBy
    );

    event CampaignReactivated(
        uint256 indexed campaignId,
        address indexed reactivatedBy
    );

    event CommissionWithdrawn(
        address indexed to,
        uint256 amount
    );

    event ContractPauseToggled(
        bool paused
    );

    event EmergencyShutdown(
        address indexed to,
        uint256 amount
    );

    // ── Modifiers ────────────────────────────────────────────────────
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    modifier whenOperational() {
        require(!paused, "Contract is paused");
        require(!emergencyStopped, "Contract permanently stopped");
        _;
    }

    modifier whenNotEmergencyStopped() {
        require(!emergencyStopped, "Contract permanently stopped");
        _;
    }

    // ── Constructor ──────────────────────────────────────────────────
    constructor(address _admin, uint256 _campaignCreationFee) {
        require(_admin != address(0), "Admin address cannot be zero");
        admin = _admin;
        campaignCreationFee = _campaignCreationFee;
    }

    // ── User: Campaign Creation ──────────────────────────────────────
    function createCampaign(
        string memory _title,
        string memory _description,
        string memory _category,
        uint256 _goal,
        uint256 _deadline,
        string memory _bannerCID
    ) public payable whenOperational returns (uint256) {
        require(bytes(_title).length > 0, "Title cannot be empty");
        require(bytes(_description).length > 0, "Description cannot be empty");
        require(bytes(_category).length > 0, "Category cannot be empty");
        require(_goal > 0, "Goal must be greater than zero");
        require(_deadline > block.timestamp, "Deadline must be in the future");
        require(msg.value == campaignCreationFee, "Incorrect creation fee");

        Campaign storage campaign = campaigns[numberOfCampaigns];
        campaign.id = numberOfCampaigns;
        campaign.owner = msg.sender;
        campaign.title = _title;
        campaign.description = _description;
        campaign.category = _category;
        campaign.goal = _goal;
        campaign.deadline = _deadline;
        campaign.bannerCID = _bannerCID;
        campaign.amountCollected = 0;
        campaign.createdAt = block.timestamp;
        campaign.isActive = true;

        totalCommissionsCollected += msg.value;

        emit CampaignCreated(
            numberOfCampaigns,
            msg.sender,
            _title,
            _category,
            _goal,
            _deadline,
            msg.value
        );

        numberOfCampaigns++;
        return numberOfCampaigns - 1;
    }

    // ── User: Donate ─────────────────────────────────────────────────
    function donateToCampaign(uint256 _id) public payable whenOperational {
        require(_id < numberOfCampaigns, "Campaign does not exist");
        require(msg.value > 0, "Donation must be greater than zero");

        Campaign storage campaign = campaigns[_id];
        require(campaign.isActive, "Campaign is no longer active");
        require(block.timestamp < campaign.deadline, "Campaign deadline has passed");

        (bool sent, ) = payable(campaign.owner).call{value: msg.value}("");
        require(sent, "Failed to send Ether to campaign owner");

        campaign.donators.push(msg.sender);
        campaign.donations.push(msg.value);
        campaign.donationTimestamps.push(block.timestamp);
        campaign.amountCollected += msg.value;

        contributionHistory[msg.sender].push(
            Contribution({
                campaignId: _id,
                amount: msg.value,
                timestamp: block.timestamp
            })
        );

        emit DonationReceived(_id, msg.sender, msg.value);
    }

    // ── Admin: Moderation & Controls ─────────────────────────────────
    function deleteCampaign(uint256 _id) public onlyAdmin whenNotEmergencyStopped {
        require(_id < numberOfCampaigns, "Campaign does not exist");
        Campaign storage campaign = campaigns[_id];
        require(campaign.isActive, "Campaign is already inactive");
        campaign.isActive = false;
        emit CampaignDeleted(_id, msg.sender);
    }

    function reactivateCampaign(uint256 _id) public onlyAdmin whenNotEmergencyStopped {
        require(_id < numberOfCampaigns, "Campaign does not exist");
        Campaign storage campaign = campaigns[_id];
        require(!campaign.isActive, "Campaign is already active");
        campaign.isActive = true;
        emit CampaignReactivated(_id, msg.sender);
    }

    function pauseContract() public onlyAdmin whenNotEmergencyStopped {
        require(!paused, "Contract already paused");
        paused = true;
        emit ContractPauseToggled(true);
    }

    function resumeContract() public onlyAdmin whenNotEmergencyStopped {
        require(paused, "Contract is not paused");
        paused = false;
        emit ContractPauseToggled(false);
    }

    function updateCampaignCreationFee(uint256 _newFee) public onlyAdmin whenNotEmergencyStopped {
        campaignCreationFee = _newFee;
    }

    function withdrawCommissions(address payable _to, uint256 _amount) public onlyAdmin whenNotEmergencyStopped {
        require(_to != address(0), "Invalid recipient");
        require(_amount > 0, "Amount must be greater than zero");
        require(_amount <= address(this).balance, "Insufficient contract balance");

        (bool sent, ) = _to.call{value: _amount}("");
        require(sent, "Commission withdrawal failed");

        emit CommissionWithdrawn(_to, _amount);
    }

    function emergencyWithdrawAndStop(address payable _to) public onlyAdmin whenNotEmergencyStopped {
        require(_to != address(0), "Invalid recipient");

        emergencyStopped = true;
        paused = true;

        uint256 balance = address(this).balance;
        if (balance > 0) {
            (bool sent, ) = _to.call{value: balance}("");
            require(sent, "Emergency withdrawal failed");
        }

        emit EmergencyShutdown(_to, balance);
    }

    // ── View Functions ───────────────────────────────────────────────
    function getCampaigns()
        public
        view
        returns (
            uint256[] memory ids,
            address[] memory owners,
            string[] memory titles,
            string[] memory descriptions,
            string[] memory categories,
            uint256[] memory goals,
            uint256[] memory deadlines,
            string[] memory bannerCIDs,
            uint256[] memory amountsCollected,
            uint256[] memory createdAts,
            bool[] memory isActives
        )
    {
        uint256 total = numberOfCampaigns;

        ids = new uint256[](total);
        owners = new address[](total);
        titles = new string[](total);
        descriptions = new string[](total);
        categories = new string[](total);
        goals = new uint256[](total);
        deadlines = new uint256[](total);
        bannerCIDs = new string[](total);
        amountsCollected = new uint256[](total);
        createdAts = new uint256[](total);
        isActives = new bool[](total);

        for (uint256 i = 0; i < total; i++) {
            Campaign storage c = campaigns[i];
            ids[i] = c.id;
            owners[i] = c.owner;
            titles[i] = c.title;
            descriptions[i] = c.description;
            categories[i] = c.category;
            goals[i] = c.goal;
            deadlines[i] = c.deadline;
            bannerCIDs[i] = c.bannerCID;
            amountsCollected[i] = c.amountCollected;
            createdAts[i] = c.createdAt;
            isActives[i] = c.isActive;
        }
    }

    function getCampaign(uint256 _id)
        public
        view
        returns (
            uint256 id,
            address owner,
            string memory title,
            string memory description,
            string memory category,
            uint256 goal,
            uint256 deadline,
            string memory bannerCID,
            uint256 amountCollected,
            uint256 createdAt,
            bool isActive,
            address[] memory donators,
            uint256[] memory donations,
            uint256[] memory donationTimestamps
        )
    {
        require(_id < numberOfCampaigns, "Campaign does not exist");
        Campaign storage c = campaigns[_id];
        return (
            c.id,
            c.owner,
            c.title,
            c.description,
            c.category,
            c.goal,
            c.deadline,
            c.bannerCID,
            c.amountCollected,
            c.createdAt,
            c.isActive,
            c.donators,
            c.donations,
            c.donationTimestamps
        );
    }

    function getDonors(uint256 _id)
        public
        view
        returns (
            address[] memory donators,
            uint256[] memory donations,
            uint256[] memory donationTimestamps
        )
    {
        require(_id < numberOfCampaigns, "Campaign does not exist");
        Campaign storage c = campaigns[_id];
        return (c.donators, c.donations, c.donationTimestamps);
    }

    function getUserContributions(address _user)
        public
        view
        returns (
            uint256[] memory campaignIds,
            uint256[] memory amounts,
            uint256[] memory timestamps
        )
    {
        Contribution[] storage records = contributionHistory[_user];
        uint256 total = records.length;

        campaignIds = new uint256[](total);
        amounts = new uint256[](total);
        timestamps = new uint256[](total);

        for (uint256 i = 0; i < total; i++) {
            campaignIds[i] = records[i].campaignId;
            amounts[i] = records[i].amount;
            timestamps[i] = records[i].timestamp;
        }
    }

    function getPlatformState()
        public
        view
        returns (
            uint256 creationFeeWei,
            uint256 contractBalanceWei,
            uint256 campaignCount,
            uint256 commissionsCollectedWei,
            bool isPaused,
            bool isEmergencyStopped
        )
    {
        return (
            campaignCreationFee,
            address(this).balance,
            numberOfCampaigns,
            totalCommissionsCollected,
            paused,
            emergencyStopped
        );
    }

    function getCampaignCount() public view returns (uint256) {
        return numberOfCampaigns;
    }

    receive() external payable {}
}
